// Registers jest-dom's custom matchers (toBeInTheDocument, toBeDisabled, ...)
// on vitest's `expect` — without this, every component test using them fails
// with "Invalid Chai property" instead of a real assertion result.
import "@testing-library/jest-dom";

// The suite's texts are Uzbek: pin the interface language so a developer's
// browser or OS language never changes what the tests see.
import { applyLanguage } from "@/i18n";

// Neither jsdom nor Node gives these tests a working Web Storage here: Node's
// own `localStorage` global is inert without --localstorage-file, and this
// jsdom build exposes none on `window`. Zustand's persist middleware reads the
// bare global at module load, so without one the store dies on `.setItem` and
// every test that touches it fails for a reason that has nothing to do with
// the code under test. A plain in-memory Storage is enough — persistence
// across a reload is not what these tests are about.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
  } as Storage;
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  const existing = (() => { try { return window[name]; } catch { return undefined; } })();
  const store = existing ?? memoryStorage();
  for (const target of [window, globalThis] as unknown as Array<Record<string, unknown>>) {
    Object.defineProperty(target, name, { value: store, configurable: true, writable: true });
  }
}

// jsdom has no ResizeObserver, and a component that measures itself (the
// studio tab strip fitting its tabs to the width) throws on mount — taking
// down tests about entirely different things, like which estimate endpoint a
// page calls. The stub only lets those components mount: it never fires, so a
// test that actually depends on a resize has to drive the callback itself.
if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Vitest's jsdom environment replaces AbortController/AbortSignal with jsdom's,
// but leaves Request as Node's own (undici). React Router's data routers build
// each navigation as `new Request(url, { signal })`, and from Node 24 undici
// rejects any signal that is not its own AbortSignal — so every test that
// navigates through a memory router failed on CI (Node 24) but passed locally
// (Node 22). Node's own AbortController is unreachable once replaced, so build
// the Request without the caller's signal and hand that signal back from
// `request.signal`: the router only reads it (`aborted`, "abort" listeners).
{
  // Not detectable up front: undici makes its own `request.signal` from the
  // (replaced) global AbortController, yet validates `init.signal` against
  // the native class it captured at load — so always take the signal aside.
  const NativeRequest = globalThis.Request;
  class BridgedRequest extends NativeRequest {
    private readonly callerSignal?: AbortSignal;
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      const signal = init?.signal ?? undefined;
      super(input, signal ? { ...init, signal: undefined } : init);
      this.callerSignal = signal;
    }
    get signal(): AbortSignal {
      return this.callerSignal ?? super.signal;
    }
  }
  globalThis.Request = BridgedRequest as typeof Request;
}

applyLanguage("uz");
