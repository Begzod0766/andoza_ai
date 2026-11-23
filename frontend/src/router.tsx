import { lazy, Suspense, type ReactNode } from "react";
import {
  createBrowserRouter,
  Navigate,
  useLocation,
  type RouteObject,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/authStore";
import { AppShell } from "@/components/layout/AppShell";
import { RootLayout } from "@/components/layout/RootLayout";
import { BrandLoader } from "@/components/BrandLoader";
import { untilReload } from "@/lib/untilReload";
import { LandingIntro } from "@/components/LandingIntro";

// ---------- Auth guard ----------

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    // The whole address: the app opens the studio with ?phase=, ?app=1 and ?lang=, and a bounce
    // through /login used to come back without them (mobile QA 2026-11-18).
    const from = location.pathname + location.search + location.hash;
    return <Navigate to="/login" state={{ from }} replace />;
  }
  return <>{children}</>;
}

// /studio/:roomId opens its first tab. The query string goes along: the mobile
// app opens a room with ?focus=1 (after a scan) or ?ai_pin=… (a shared pin),
// and a bare <Navigate to="ichkarida"> dropped both.
export function StudioIndexRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: "ichkarida", search }} replace />;
}

// Public landing at "/" for guests; authenticated users skip straight to their
// projects so "/" keeps behaving like the app entry for logged-in users.
function LandingGate() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/projects" replace />;
  return (
    <>
      <LandingIntro />
      {withSuspense(<LandingPage />)}
    </>
  );
}

// ---------- Loading fallback ----------

function withSuspense(node: ReactNode) {
  return <Suspense fallback={<BrandLoader />}>{node}</Suspense>;
}

// ---------- 404 ----------

function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-6xl font-extrabold text-brand">404</h1>
      <p className="text-muted text-lg">{t("common.sahifa_topilmadi")}</p>
      <a
        href="/projects"
        className="bg-brand text-white px-6 py-2.5 rounded-card font-semibold hover:bg-brand/90 transition-colors"
      >
        {t("common.bosh_sahifa")}
      </a>
    </div>
  );
}

// ---------- Lazy pages ----------

const WizardPage = lazy(untilReload(() => import("@/pages/wizard/WizardPage")));
const StudioPage = lazy(untilReload(() => import("@/pages/studio/StudioPage")));
const ThreeDPage = lazy(untilReload(() => import("@/pages/studio/ThreeDPage")));
const PlacementPage = lazy(untilReload(() => import("@/pages/studio/PlacementPage")));
const IsometricPage = lazy(untilReload(() => import("@/pages/studio/IsometricPage")));
const WalkthroughPage = lazy(untilReload(() => import("@/pages/studio/WalkthroughPage")));
const SmetaPage = lazy(untilReload(() => import("@/pages/smeta/SmetaPage")));
const ProjectsPage = lazy(untilReload(() => import("@/pages/projects/ProjectsPage")));
const DokonPage = lazy(untilReload(() => import("@/pages/dokon/DokonPage")));
const UstalarPage = lazy(untilReload(() => import("@/pages/ustalar/UstalarPage")));
const ProfilePage = lazy(untilReload(() => import("@/pages/profile/ProfilePage")));
const RendersPage = lazy(untilReload(() => import("@/pages/renders/RendersPage")));
const SellerPage = lazy(untilReload(() => import("@/pages/seller/SellerPage")));
const LoginPage = lazy(untilReload(() => import("@/pages/auth/LoginPage")));
const SharedRoomPage = lazy(untilReload(() => import("@/pages/share/SharedRoomPage")));
const WorkshopPartPage = lazy(untilReload(() => import("@/pages/mebel/WorkshopPartPage")));
const LidarPage = lazy(untilReload(() => import("@/pages/scan/LidarPage")));
const Photo360Page = lazy(untilReload(() => import("@/pages/scan/Photo360Page")));
const DrawRoomPage = lazy(untilReload(() => import("@/pages/scan/DrawRoomPage")));
const LandingPage = lazy(untilReload(() => import("@/pages/LandingPage")));
const PrivacyPage = lazy(untilReload(() => import("@/pages/PrivacyPage")));
const DeleteAccountPage = lazy(untilReload(() => import("@/pages/DeleteAccountPage")));
const MebelListPage = lazy(untilReload(() => import("@/pages/mebel/MebelListPage")));
const MebelOffcutsPage = lazy(untilReload(() => import("@/pages/mebel/MebelOffcutsPage")));
const MebelProjectPage = lazy(untilReload(() => import("@/pages/mebel/MebelProjectPage")));

// ---------- Routes ----------

const routes: RouteObject[] = [
  {
    path: "/",
    element: <LandingGate />,
  },
  {
    path: "/landing",
    element: withSuspense(<LandingPage />),
  },
  // Public privacy policy (linked from the landing footer and the store listing).
  {
    path: "/privacy",
    element: withSuspense(<PrivacyPage />),
  },
  // Public how-to for deleting an account (required by Google Play).
  {
    path: "/delete-account",
    element: withSuspense(<DeleteAccountPage />),
  },
  {
    path: "/login",
    element: withSuspense(<LoginPage />),
  },
  // Public, unauthenticated read-only room view — NOT nested under the
  // RequireAuth-wrapped /studio/:roomId tree below, same sibling-of-the-
  // shell placement as /login above.
  {
    path: "/share/:token",
    element: withSuspense(<SharedRoomPage />),
  },
  // A mebel part label's QR: the worker opens the part without an account.
  {
    path: "/d/:token",
    element: withSuspense(<WorkshopPartPage />),
  },

  // ── Main shell (Uy + Do'kon bottom nav) ──
  {
    element: <AppShell />,
    children: [
      {
        path: "/projects",
        element: withSuspense(<RequireAuth><ProjectsPage /></RequireAuth>),
      },
      {
        path: "/dokon",
        element: withSuspense(<DokonPage />),
      },
      {
        path: "/ustalar",
        element: withSuspense(<UstalarPage />),
      },
      {
        path: "/profile",
        element: withSuspense(<RequireAuth><ProfilePage /></RequireAuth>),
      },
      {
        path: "/renders",
        element: withSuspense(<RequireAuth><RendersPage /></RequireAuth>),
      },
      {
        path: "/seller",
        element: withSuspense(<RequireAuth><SellerPage /></RequireAuth>),
      },
      {
        path: "/mebel",
        element: withSuspense(<RequireAuth><MebelListPage /></RequireAuth>),
      },
      {
        path: "/mebel/qoldiqlar",
        element: withSuspense(<RequireAuth><MebelOffcutsPage /></RequireAuth>),
      },
    ],
  },

  // ── Full-screen flows (no bottom nav) ──
  {
    path: "/mebel/:id",
    element: withSuspense(<RequireAuth><MebelProjectPage /></RequireAuth>),
  },
  {
    path: "/scan/lidar",
    element: withSuspense(<LidarPage />),
  },
  {
    path: "/scan/360",
    element: withSuspense(<Photo360Page />),
  },
  {
    path: "/scan/draw",
    element: withSuspense(<DrawRoomPage />),
  },
  {
    path: "/wizard",
    element: withSuspense(<RequireAuth><WizardPage /></RequireAuth>),
  },
  {
    path: "/studio/:roomId",
    element: withSuspense(<RequireAuth><StudioPage /></RequireAuth>),
    children: [
      {
        index: true,
        element: <StudioIndexRedirect />,
      },
      {
        path: "yuqori",
        element: withSuspense(<IsometricPage />),
      },
      {
        path: "ichkarida",
        element: withSuspense(<ThreeDPage />),
      },
      {
        // Same editor, opened in the furnishing phase (Mebelirovka tab)
        path: "mebel",
        element: withSuspense(<ThreeDPage />),
      },
      {
        // Same editor, opened in the lighting phase (Chiroqlar tab)
        path: "chiroqlar",
        element: withSuspense(<ThreeDPage />),
      },
      {
        path: "elektr",
        element: withSuspense(<PlacementPage />),
      },
      {
        path: "aylanish",
        element: withSuspense(<WalkthroughPage />),
      },
    ],
  },
  {
    path: "/smeta/:roomId",
    element: withSuspense(<RequireAuth><SmetaPage /></RequireAuth>),
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
];

// Every route sits under RootLayout, which holds the one <ScrollRestoration /> for the app.
export const router = createBrowserRouter([{ element: <RootLayout />, children: routes }]);
