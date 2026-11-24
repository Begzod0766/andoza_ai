import { useState } from "react";
import { useTranslation } from "react-i18next";
import { appUpdate, useAppUpdateReady } from "@/lib/appUpdate";
import { reloadSafely } from "@/lib/safeReload";

/**
 * A new version is ready (lib/appUpdate) and the studio is open: the user takes it when it suits,
 * the room saved first and its stage and undo history kept (lib/safeReload). Not saved: no update.
 * A pill low over the 3D, above the bottom buttons: a strip across the top covered the studio's
 * undo / redo / ? / ⋮ (phone QA 2026-11-24, #393 #10).
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
      className="fixed left-1/2 z-[1000] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-brand px-4 py-2 text-sm text-white shadow-lg bottom-[calc(env(safe-area-inset-bottom)+6rem)]"
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
