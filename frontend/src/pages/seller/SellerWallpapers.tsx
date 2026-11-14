import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { IconBubble, Panel } from "@/components/ui/Panel";
import { deleteMyWallpaper, listMyWallpapers, updateMyWallpaper, type Wallpaper } from "@/lib/api";
import { intlLocale } from "@/i18n";
import { type FormError, formErrorText, requestError } from "@/lib/formError";
import { isRemovedByShop } from "./removedByShop";
import { StatusBadge } from "./StatusBadge";
import { SellerWallpaperFormDialog, WALLPAPERS_KEY } from "./SellerWallpaperFormDialog";

/** The shop's oboy: list, add, edit, remove. New ones wait for an admin. */
export function SellerWallpapers({
  openNew,
  onOpenNewChange,
}: {
  /** Whether the "new wallpaper" dialog is open (the page can open it from the model dialog). */
  openNew: boolean;
  onOpenNewChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Wallpaper | null>(null);
  const [error, setError] = useState<FormError>(null);

  const query = useQuery({ queryKey: WALLPAPERS_KEY, queryFn: listMyWallpapers });
  const items = query.data ?? [];

  const remove = useMutation({
    mutationFn: (w: Wallpaper) => deleteMyWallpaper(w.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WALLPAPERS_KEY }),
    onError: (err) => setError(requestError(err, "seller.wallpapers.remove_failed")),
  });

  // The shop's own removal is undone by saving the row as it is: the server puts it back to approved.
  const restore = useMutation({
    mutationFn: (w: Wallpaper) => updateMyWallpaper(w.id, { name: w.name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WALLPAPERS_KEY }),
    onError: (err) => setError(requestError(err, "seller.wallpapers.restore_failed")),
  });
  const busy = remove.isPending || restore.isPending;

  const num = (n: number) => n.toLocaleString(intlLocale());

  return (
    <section className="space-y-3">
      <Panel className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <IconBubble tone="violet" className="h-10 w-10 rounded-2xl"><ImageIcon size={18} aria-hidden="true" /></IconBubble>
          <h2 className="text-base font-extrabold text-ink">
            {query.data ? t("seller.wallpapers.title_count", { count: items.length }) : t("seller.wallpapers.title")}
          </h2>
        </div>
        <Button size="sm" variant="accent" onClick={() => onOpenNewChange(true)}>{t("seller.wallpapers.new")}</Button>
      </Panel>

      {error && <div role="alert" className="rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm font-medium px-4 py-2.5">{formErrorText(t, error)}</div>}

      {query.isLoading ? (
        <div className="h-40 rounded-3xl bg-card animate-pulse" />
      ) : items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((w) => (
            <Panel key={w.id} className="space-y-2.5 p-3">
              <img src={w.url} alt={w.name} className="w-full aspect-square rounded-2xl object-cover border border-line" />
              <div className="space-y-1">
                <h4 className="font-bold text-ink text-sm leading-tight truncate" title={w.name}>{w.name}</h4>
                <div>
                  {isRemovedByShop(w) ? (
                    <span className="inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-[11px] font-bold text-ink-muted">{t("seller.wallpapers.removed")}</span>
                  ) : (
                    <StatusBadge status={w.status} />
                  )}
                </div>
                {w.price_uzs != null && (
                  <p className="text-sm font-bold text-ink">{t("seller.wallpapers.price_roll", { price: num(w.price_uzs) })}</p>
                )}
                {w.width_cm != null && w.total_length_m != null && (
                  <p className="text-xs text-ink-muted">{t("seller.wallpapers.size", { w: num(w.width_cm), l: num(w.total_length_m) })}</p>
                )}
                {w.status === "rejected" && !isRemovedByShop(w) && w.moderation_note && (
                  <p className="text-xs text-red-500">{t("seller.wallpapers.reason", { note: w.moderation_note })}</p>
                )}
              </div>
              <div className="flex items-center gap-1 pt-1">
                {!isRemovedByShop(w) && (
                <button onClick={() => setEditing(w)} disabled={busy} title={t("dokon.admin.tahrirlash")} aria-label={t("dokon.admin.tahrirlash")}
                  className="h-8 w-8 rounded-full border border-line bg-card-soft flex items-center justify-center text-ink-muted hover:text-accent disabled:opacity-50">
                  <Pencil size={14} />
                </button>
                )}
                {isRemovedByShop(w) ? (
                  <Button size="sm" variant="soft" className="ml-auto" disabled={busy} onClick={() => { setError(null); restore.mutate(w); }}>
                    {t("seller.wallpapers.restore")}
                  </Button>
                ) : (
                <button
                  onClick={async () => {
                    setError(null);
                    if (await confirm({ title: t("seller.wallpapers.delete_title", { name: w.name }), description: t("seller.wallpapers.delete_desc"), destructive: true })) remove.mutate(w);
                  }}
                  disabled={busy} title={t("common.ochirish")} aria-label={t("common.ochirish")}
                  className="ml-auto h-8 w-8 rounded-full border border-line bg-card-soft flex items-center justify-center text-ink-muted hover:text-red-500 disabled:opacity-50">
                  <Trash2 size={14} />
                </button>
                )}
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel className="text-center py-8 px-4 space-y-2">
          <p className="text-sm font-bold text-ink">{t("seller.wallpapers.none")}</p>
          <p className="text-xs text-ink-muted">{t("seller.wallpapers.none_hint")}</p>
        </Panel>
      )}

      {openNew && <SellerWallpaperFormDialog open onOpenChange={onOpenNewChange} />}
      {editing && <SellerWallpaperFormDialog key={editing.id} open wallpaper={editing} onOpenChange={(o) => { if (!o) setEditing(null); }} />}
    </section>
  );
}
