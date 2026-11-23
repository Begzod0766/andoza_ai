import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { FeedbackProvider } from "@/components/ui/FeedbackProvider";
import { ServerUpdatingBanner } from "@/components/ui/ServerUpdatingBanner";
import { AppUpdateBanner } from "@/components/ui/AppUpdateBanner";
import { newVersionFound } from "@/lib/appUpdate";
import { registerSW } from "virtual:pwa-register";
import { installStaleChunkReload } from "@/lib/staleChunkReload";
import "@/i18n";
import "./styles/global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// A new deploy's service worker waits (registerType "prompt", pwaWorkbox.ts) instead of reloading
// the page itself: in the studio that lost the undo history and the stage (phone QA 2026-11-24 #12).
// lib/appUpdate decides: nothing when this page already runs the new build, the update at once
// outside the studio, offered in it (AppUpdateBanner, which saves first).
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => { void newVersionFound(() => { void updateSW(true); }); },
});
// A tab left open across a deploy reloads instead of erroring on a removed chunk (in the studio
// only once its work is kept).
installStaleChunkReload();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>
        <RouterProvider router={router} />
        <ServerUpdatingBanner />
        <AppUpdateBanner />
      </FeedbackProvider>
    </QueryClientProvider>
  </StrictMode>
);
