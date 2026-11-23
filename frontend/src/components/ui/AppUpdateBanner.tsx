import { useState } from "react";
import { useTranslation } from "react-i18next";
import { appUpdate, useAppUpdateReady } from "@/lib/appUpdate";
import { reloadSafely } from "@/lib/safeReload";

/**
 * A new version is ready (lib/appUpdate) and the studio is open: the user takes it when it suits,
 * the room saved first and its stage and undo history kept (lib/safeReload). Not saved: no update.
 */
export function AppUpdateBanner() {
  const { t } = useTranslation();
  const ready = useAppUpdateReady();
  const [busy, setBusy] = useState(false);
  const [notSaved, setNotSaved] = useState(false);
  if (!ready) return null;
  const onApply = async () => {
    setBusy(true);
    setNotSaved(false);
    const ok = await reloadSafely({ reload: () => appUpdate.apply() });
    setBusy(false);
    if (!ok) setNotSaved(true);
  };
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[1000] flex items-center justify-center gap-3 bg-brand px-4 py-2 text-sm text-white shadow"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <span>{notSaved ? t("app_update.not_saved") : t("app_update.banner")}</span>
      <button
        type="button"
        disabled={busy}
        className="rounded-md border border-current px-2 py-0.5 font-medium disabled:opacity-60"
        onClick={onApply}
      >
        {t("app_update.apply")}
      </button>
    </div>
  );
}
