import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateMyWallpaper, uploadMyWallpaper, type Wallpaper } from "@/lib/api";
import { type FormError, formErrorText, requestError } from "@/lib/formError";

export const WALLPAPERS_KEY = ["seller", "wallpapers"] as const;

/** Add an oboy to the shop, or edit one. The image can only be replaced while
 *  the wallpaper is still pending or rejected; the server refuses it after. */
export function SellerWallpaperFormDialog({
  open,
  onOpenChange,
  wallpaper,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The wallpaper being edited; absent when adding a new one. */
  wallpaper?: Wallpaper | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const editing = !!wallpaper;
  const canReplaceImage = !wallpaper || wallpaper.status !== "approved";
  const [name, setName] = useState(wallpaper?.name ?? "");
  const [price, setPrice] = useState(wallpaper?.price_uzs != null ? String(wallpaper.price_uzs) : "");
  const [width, setWidth] = useState(wallpaper?.width_cm != null ? String(wallpaper.width_cm) : "");
  const [length, setLength] = useState(wallpaper?.total_length_m != null ? String(wallpaper.total_length_m) : "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<FormError>(null);
  const [done, setDone] = useState(false);

  function reset() {
    setName(""); setPrice(""); setWidth(""); setLength(""); setFile(null); setError(null); setDone(false);
  }

  const complete =
    !!name.trim() && Number(price) > 0 && Number(width) > 0 && Number(length) > 0 && (editing || !!file);

  const save = useMutation({
    mutationFn: () => {
      const fields = { name: name.trim(), priceUzs: Number(price), widthCm: Number(width), totalLengthM: Number(length) };
      if (wallpaper) return updateMyWallpaper(wallpaper.id, { ...fields, ...(file ? { file } : {}) });
      return uploadMyWallpaper({ file: file as File, ...fields });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WALLPAPERS_KEY });
      if (editing) {
        onOpenChange(false);
      } else {
        setDone(true);
      }
    },
    onError: (err) => setError(requestError(err, "seller.wallpapers.save_failed")),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={editing ? t("seller.wallpapers.form_edit") : t("seller.wallpapers.form_new")}
      description={t("seller.wallpapers.form_hint")}
      themed
    >
      {done ? (
        <div className="space-y-4">
          <p role="status" className="text-sm text-ink">{t("seller.wallpapers.saved")}</p>
          <div className="flex justify-end">
            <Button type="button" onClick={() => { reset(); onOpenChange(false); }}>{t("seller.wallpapers.close")}</Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (complete) save.mutate();
          }}
          className="space-y-4"
        >
          {canReplaceImage ? (
            <div>
              <label htmlFor="wp-image" className="block text-sm font-medium text-ink mb-1.5">{t("seller.wallpapers.image")}</label>
              <input id="wp-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs w-full" />
            </div>
          ) : (
            <p className="text-xs text-ink-muted">{t("seller.wallpapers.image_locked")}</p>
          )}

          <Input themed label={t("seller.wallpapers.name")} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("seller.wallpapers.name_ph")} maxLength={120} />
          <Input themed label={t("seller.wallpapers.price")} type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="120000" />
          <div className="grid grid-cols-2 gap-3">
            <Input themed label={t("seller.wallpapers.width")} type="number" min={30} max={150} value={width} onChange={(e) => setWidth(e.target.value)} placeholder="106" />
            <Input themed label={t("seller.wallpapers.length")} type="number" min={1} max={50} step="any" value={length} onChange={(e) => setLength(e.target.value)} placeholder="10" />
          </div>

          {error && <p role="alert" className="text-sm text-red-500">{formErrorText(t, error)}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="soft" onClick={() => onOpenChange(false)}>{t("common.bekor")}</Button>
            <Button type="submit" disabled={!complete} loading={save.isPending}>{t("seller.wallpapers.save")}</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
