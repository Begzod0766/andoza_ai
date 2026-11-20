import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { isEmbeddedApp } from "@/lib/embedded";

/**
 * Guest mode (spec 2026-11-20 mehmon rejimi): inside the mobile app a person can use the
 * Studio before signing up. Their account is a server-side guest (`AuthUser.is_guest`);
 * every paid or identity endpoint answers a guest with
 * `403 {"detail": {"code": "registration_required", "feature": …, "message": …}}`.
 *
 * Buttons ask `isGuest()` / `gate()` before calling, and map a late 403 through
 * `registrationRequiredFeature`, so a guest gets the app's sign-up sheet instead of an error.
 * The plain website has no guest mode: there `requestRegistration` just goes to /login.
 */

declare global {
  interface Window {
    /** Flutter WebView channel: the app shows its sign-up sheet for `{"feature": …}`. */
    AndozaAuthGate?: { postMessage(message: string): void };
  }
}

export type GuestFeature =
  | "ai_design"
  | "ai_build"
  | "smeta_ask"
  | "render"
  | "photo_model"
  | "mebel_ai"
  | "contact"
  | "order"
  | "workshop_link"
  | "business"
  | "market_prices";

const FEATURES: ReadonlySet<string> = new Set<GuestFeature>([
  "ai_design",
  "ai_build",
  "smeta_ask",
  "render",
  "photo_model",
  "mebel_ai",
  "contact",
  "order",
  "workshop_link",
  "business",
  "market_prices",
]);

/** True only for a server-side guest; old app builds seed no `is_guest`, so they read false. */
export function isGuest(): boolean {
  return useAuthStore.getState().user?.is_guest === true;
}

/**
 * The feature of a `registration_required` 403, or null for any other error. `ApiError`
 * and the AI build stream's plain `Error` both carry the raw response body as `message`.
 */
export function registrationRequiredFeature(err: unknown): GuestFeature | null {
  if (!(err instanceof Error)) return null;
  let body: unknown;
  try {
    body = JSON.parse(err.message);
  } catch {
    return null;
  }
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (!detail || typeof detail !== "object") return null;
  const { code, feature } = detail as { code?: unknown; feature?: unknown };
  if (code !== "registration_required" || typeof feature !== "string") return null;
  return FEATURES.has(feature) ? (feature as GuestFeature) : null;
}

type Navigate = (to: string, opts?: { state: unknown }) => void;

/**
 * Asks for registration: the app's native sheet when embedded and the channel exists,
 * otherwise (plain website, or an old app build without the channel) the login page,
 * which returns here afterwards.
 */
export function requestRegistration(feature: GuestFeature, navigate: Navigate): void {
  const channel = window.AndozaAuthGate;
  if (isEmbeddedApp() && typeof channel?.postMessage === "function") {
    channel.postMessage(JSON.stringify({ feature }));
    return;
  }
  const { pathname, search, hash } = window.location;
  navigate("/login", { state: { from: pathname + search + hash } });
}

/** `gate(feature)` prompts a guest and returns true (the caller stops); false for everyone else. */
export function useGuestGate(): { guest: boolean; gate: (feature: GuestFeature) => boolean } {
  const navigate = useNavigate();
  const guest = useAuthStore((s) => s.user?.is_guest === true);
  const gate = useCallback(
    (feature: GuestFeature) => {
      if (!isGuest()) return false;
      requestRegistration(feature, navigate);
      return true;
    },
    [navigate],
  );
  return { guest, gate };
}
