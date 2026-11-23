import { useSyncExternalStore } from "react";

/**
 * Whether the server looks like it is being updated: the api answered 502/503/504 through the
 * host nginx (a deploy recreating its container, 1-3 minutes) even after apiClient's retries.
 * The next answer that comes through clears it. ServerUpdatingBanner shows it.
 */
let updating = false;
const listeners = new Set<() => void>();

export const serverUpdating = {
  get: (): boolean => updating,
  set(value: boolean): void {
    if (value === updating) return;
    updating = value;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useServerUpdating(): boolean {
  return useSyncExternalStore(serverUpdating.subscribe, serverUpdating.get, serverUpdating.get);
}
