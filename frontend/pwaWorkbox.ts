import type { VitePWAOptions } from "vite-plugin-pwa";

/** The service worker's caching (vite.config.ts VitePWA), kept here so it can be tested. */
export const PWA_WORKBOX: NonNullable<Partial<VitePWAOptions>["workbox"]> = {
  // Activate a freshly-deployed service worker immediately and take
  // control of open tabs, instead of waiting for every tab to close.
  // Combined with registerType:"autoUpdate" above, this means a new
  // deploy reaches users on their next load — no stale cached build,
  // no manual hard refresh.
  clientsClaim: true,
  skipWaiting: true,
  // Not the page itself: a precached index.html answered every navigation, so the first open after a
  // deploy ran the old build (mobile QA 2026-11-16: the Studio WebView). The page goes to the network
  // first (runtimeCaching below; nginx serves it no-cache), the cached copy only offline or when slow.
  globPatterns: ["**/*.{js,css,ico,png,svg,webp}"],
  navigateFallback: null,
  cleanupOutdatedCaches: true,
  // The three-vendor / react-three-vendor chunks (Three.js + R3F
  // ecosystem, 1MB+ combined) are only needed by the lazy-loaded 3D
  // studio pages. Force-precaching them on every first visit — even for
  // someone who only opens a shared room link or a marketing page —
  // costs every visitor a multi-MB download they may never use. Precache
  // everything else as before, but let these two load (and get cached)
  // lazily on first real use via runtimeCaching below.
  globIgnores: [
    "**/assets/three-vendor-*.js",
    "**/assets/react-three-vendor-*.js",
  ],
  runtimeCaching: [
    {
      urlPattern: ({ request }: { request: Request | { mode: string } }) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "pages",
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 20 },
        cacheableResponse: { statuses: [200] },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-cache",
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /\/assets\/(three-vendor|react-three-vendor)-.*\.js$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "three-vendor-cache",
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 60 * 60 * 24 * 365,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
};
