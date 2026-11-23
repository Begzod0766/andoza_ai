// ---------- Shared low-level request layer ----------
//
// Every domain module in this directory builds on top of `apiClient`. This
// file is a faithful relocation of the original single-file implementation —
// no behavioral changes (retry logic, 401 handling, and body parsing are
// unchanged) apart from the Accept-Language header and the gateway retries below.

import i18n, { currentLanguage } from "@/i18n";
import { serverUpdating } from "./serverStatus";

export const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000/api/v1";

const NO_SESSION_RETRY_PATHS = new Set(["/auth/login", "/auth/google"]);

/** For the raw `fetch` calls that bypass `apiClient`: the app's language. */
export function languageHeaders(): Record<string, string> {
  return { "Accept-Language": currentLanguage() };
}

/** A request the server answered with an error: its body (or `HTTP <status>`) as the message, and the status. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------- The server being updated ----------
//
// While a deploy recreates the api (1-3 minutes) the host nginx answers 502/503/504 with its own
// HTML page (phone QA 2026-11-23 #1). A GET or HEAD is tried again a few times a beat apart; a
// write is never sent twice. What still fails throws a readable ApiError instead of nginx's HTML,
// and ServerUpdatingBanner tells the user; the next answer that comes clears it.

/** The waits before each retry of a GET/HEAD the gateway turned away. */
export const GATEWAY_RETRY_DELAYS_MS = [1000, 2000, 4000];
const GATEWAY_STATUSES = new Set([502, 503, 504]);

/** The gateway's own error page, not an answer of the api (which answers in JSON, e.g. a 503 for
 *  a switched-off guest mode). */
function isGatewayError(response: Response): boolean {
  return GATEWAY_STATUSES.has(response.status)
    && !(response.headers.get("Content-Type") ?? "").includes("application/json");
}

function wait(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason ?? new DOMException("Aborted", "AbortError")); return; }
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** fetch, with the retries above. The gateway's last error page comes back as it is. */
async function fetchThroughGateway(url: string, init: RequestInit): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const delays = method === "GET" || method === "HEAD" ? GATEWAY_RETRY_DELAYS_MS : [];
  let response = await fetch(url, init);
  for (const ms of delays) {
    if (!isGatewayError(response)) break;
    await wait(ms, init.signal);
    response = await fetch(url, init);
  }
  serverUpdating.set(isGatewayError(response));
  return response;
}

/** The error a failed answer throws: its body, or a readable line for the gateway's HTML page. */
async function errorOf(response: Response): Promise<ApiError> {
  if (isGatewayError(response)) return new ApiError(i18n.t("server_updating.error"), response.status);
  const errorBody = await response.text();
  return new ApiError(errorBody || `HTTP ${response.status}`, response.status);
}

function handleUnauthorized(): never {
  window.location.href = "/login";
  throw new Error("Unauthorized");
}

// Single in-flight refresh promise guard — prevents parallel token refreshes.
let _refreshPromise: Promise<boolean> | null = null;

export async function tryRefresh(): Promise<boolean> {
  if (_refreshPromise !== null) {
    return _refreshPromise;
  }
  const promise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      return res.status === 200;
    } finally {
      _refreshPromise = null;
    }
  })();
  _refreshPromise = promise;
  return promise;
}

export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // A FormData body must set its own Content-Type: only the browser knows the
  // multipart boundary, and forcing JSON here makes the upload unparseable.
  // The server answers in the language the app is showing, whatever the
  // browser itself would send. Built per request: the retry after a token
  // refresh must carry the language as it is by then.
  const buildHeaders = (): HeadersInit => ({
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
    ...languageHeaders(),
  });

  const response = await fetchThroughGateway(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",   // send HttpOnly cookie on every request
    headers: buildHeaders(),
  });

  // A 401 from a sign-in endpoint means "these credentials were rejected",
  // not "your session expired": refreshing and bouncing to /login would only
  // reload the login page and swallow the error the page wants to show.
  if (response.status === 401 && NO_SESSION_RETRY_PATHS.has(path)) {
    const errorBody = await response.text();
    throw new ApiError(errorBody || `HTTP ${response.status}`, response.status);
  }

  if (response.status === 401) {
    // Do not recurse into the refresh endpoint itself.
    if (path === "/auth/refresh") {
      handleUnauthorized();
    }

    const refreshed = await tryRefresh();
    if (!refreshed) {
      handleUnauthorized();
    }

    // Retry the original request once with the same options.
    const retryResponse = await fetchThroughGateway(`${BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: buildHeaders(),
    });

    if (retryResponse.status === 401) {
      handleUnauthorized();
    }

    if (!retryResponse.ok) throw await errorOf(retryResponse);

    const retryContentType = retryResponse.headers.get("Content-Type") ?? "";
    if (retryContentType.includes("application/json")) {
      return retryResponse.json() as Promise<T>;
    }
    return retryResponse.text() as unknown as T;
  }

  if (!response.ok) throw await errorOf(response);

  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return response.text() as unknown as T;
}

/** Shared handler for endpoints that fetch() directly instead of going
 * through `apiClient` (streaming/blob responses). Exposed so those domain
 * modules can reproduce the original inline 401 handling exactly. */
export { handleUnauthorized };
