import { useTranslation } from "react-i18next";
import { useServerUpdating } from "@/lib/api/serverStatus";
import { reloadSafely } from "@/lib/safeReload";

/**
 * A strip at the top while the server is being updated (a deploy), in place of requests that just
 * fail: the page stays as it is, and the strip goes once the server answers again. Its retry reloads
 * only once the open work is kept (lib/safeReload); a room that could not be saved stays open.
 */
export function ServerUpdatingBanner() {
  const { t } = useTranslation();
  const updating = useServerUpdating();
  if (!updating) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[1000] flex items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900 shadow dark:bg-amber-900 dark:text-amber-50"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <span>{t("server_updating.banner")}</span>
      <button
        type="button"
        className="rounded-md border border-current px-2 py-0.5 font-medium"
        onClick={() => { void reloadSafely(); }}
      >
        {t("server_updating.retry")}
      </button>
    </div>
  );
}
