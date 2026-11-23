import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { apiClient, ApiError } from "../client";
import { serverUpdating } from "../serverStatus";

// Phone QA 2026-11-23 #1: while a deploy recreates the api, the host nginx answers 502/504 with
// its own HTML page.
const gateway = (status: number) =>
  new Response("<html><body><center><h1>502 Bad Gateway</h1></center><hr><center>nginx</center></body></html>", {
    status,
    headers: { "Content-Type": "text/html" },
  });
const ok = (body: unknown = { ok: true }) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.useFakeTimers();
  serverUpdating.set(false);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  serverUpdating.set(false);
});

describe("apiClient while the server is being updated", () => {
  it("retries a GET on 502/503/504 with a backoff and returns the answer once it comes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(gateway(502))
      .mockResolvedValueOnce(gateway(504))
      .mockResolvedValueOnce(ok({ n: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const p = apiClient<{ n: number }>("/rooms");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toEqual({ n: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(serverUpdating.get()).toBe(false);
  });

  it("gives up after the retries with a readable error, not nginx's HTML, and says the server is updating", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => gateway(502));
    vi.stubGlobal("fetch", fetchMock);
    const p = apiClient("/rooms");
    const caught = p.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    const err = await caught;
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).message).toBe(i18n.t("server_updating.error"));
    expect((err as ApiError).message).not.toContain("nginx");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(serverUpdating.get()).toBe(true);
  });

  it("the next answer that comes clears the updating state", async () => {
    serverUpdating.set(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok()));
    await apiClient("/rooms");
    expect(serverUpdating.get()).toBe(false);
  });

  it("never sends a POST twice: one try, then the readable error", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => gateway(502));
    vi.stubGlobal("fetch", fetchMock);
    const err = await apiClient("/rooms", { method: "POST", body: "{}" }).catch((e: unknown) => e);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((err as ApiError).message).toBe(i18n.t("server_updating.error"));
    expect(serverUpdating.get()).toBe(true);
  });

  it("a 503 the api itself answers in JSON is its real answer: no retry, its body kept", async () => {
    const body = JSON.stringify({ detail: "Guest mode is off" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, { status: 503, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const err = await apiClient("/auth/guest").catch((e: unknown) => e);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((err as ApiError).message).toBe(body);
    expect(serverUpdating.get()).toBe(false);
  });

  it("an aborted request stops waiting", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => gateway(502));
    vi.stubGlobal("fetch", fetchMock);
    const ctrl = new AbortController();
    const caught = apiClient("/rooms", { signal: ctrl.signal }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(0);
    ctrl.abort();
    const err = await caught;
    expect((err as Error).name).toBe("AbortError");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
