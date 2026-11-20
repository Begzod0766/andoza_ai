import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateMyStore, type SellerStore } from "@/lib/api";
import { isUzPhone } from "@/lib/phone";
import { StoreLocationFields, locationDraft, locationPatch } from "@/components/maps/StoreLocationFields";
import { type FormError, formErrorText, localError, requestError } from "@/lib/formError";

export function StoreEditDialog({
  store,
  open,
  onOpenChange,
  onSaved,
}: {
  store: SellerStore;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (store: SellerStore) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(store.name);
  const [district, setDistrict] = useState(store.district ?? "");
  const [phone, setPhone] = useState(store.phone ?? "");
  const [telegram, setTelegram] = useState(store.telegram ?? "");
  const [location, setLocation] = useState(() => locationDraft(store));
  const [error, setError] = useState<FormError>(null);

  const save = useMutation({
    mutationFn: (where: { address: string | null; lat: number | null; lng: number | null }) =>
      updateMyStore({
        name: name.trim(),
        district: district.trim() || null,
        phone: phone.trim() || null,
        telegram: telegram.trim() || null,
        ...where,
      }),
    onSuccess: (saved) => {
      onSaved(saved);
      onOpenChange(false);
    },
    onError: (err) => setError(requestError(err, "seller.save_failed")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("seller.shop_details")} themed>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (phone.trim() && !isUzPhone(phone)) { setError(localError("common.telefon_xato")); return; }
          const where = locationPatch(location);
          if ("error" in where) { setError(localError(where.error as Parameters<typeof localError>[0])); return; }
          if (name.trim()) save.mutate(where);
        }}
        className="space-y-4"
      >
        <Input themed label={t("seller.shop_name")} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input themed label={t("seller.district")} value={district} onChange={(e) => setDistrict(e.target.value)} />
          <Input themed label={t("common.telefon")} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Input themed label="Telegram" value={telegram} onChange={(e) => setTelegram(e.target.value)} />
        <StoreLocationFields value={location} onChange={setLocation} />
        {error && <p role="alert" className="text-sm text-red-500">{formErrorText(t, error)}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="soft" onClick={() => onOpenChange(false)}>{t("common.bekor")}</Button>
          <Button type="submit" disabled={!name.trim()} loading={save.isPending}>{t("common.saqlash")}</Button>
        </div>
      </form>
    </Dialog>
  );
}
