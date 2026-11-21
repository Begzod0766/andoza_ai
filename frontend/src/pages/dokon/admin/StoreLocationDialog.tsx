import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { StoreLocationFields, locationDraft, locationPatch } from "@/components/maps/StoreLocationFields";
import { updateAdminStore, type AdminStore } from "@/lib/api";
import { formErrorText, localError, requestError, type FormError } from "@/lib/formError";

/** An admin sets a shop's address and map point (for the estimate's shop cards and map). */
export function StoreLocationDialog({
  store,
  open,
  onOpenChange,
  onSaved,
}: {
  store: AdminStore;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (store: AdminStore) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [location, setLocation] = useState(() => locationDraft(store));
  const [error, setError] = useState<FormError>(null);

  const save = useMutation({
    mutationFn: (where: { address: string | null; lat: number | null; lng: number | null }) => updateAdminStore(store.id, where),
    onSuccess: (saved) => {
      onSaved?.(saved);
      queryClient.invalidateQueries({ queryKey: ["admin", "stores"] });
      onOpenChange(false);
    },
    onError: (err) => setError(requestError(err, "seller.save_failed")),
  });

  return (
    <Dialog themed open={open} onOpenChange={onOpenChange} title={`${t("seller.location.edit")}: ${store.name}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const where = locationPatch(location);
          if ("error" in where) { setError(localError(where.error as Parameters<typeof localError>[0])); return; }
          save.mutate(where);
        }}
      >
        <StoreLocationFields value={location} onChange={setLocation} />
        {error && <p role="alert" className="text-sm text-red-500">{formErrorText(t, error)}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="soft" onClick={() => onOpenChange(false)}>{t("common.bekor")}</Button>
          <Button type="submit" loading={save.isPending}>{t("common.saqlash")}</Button>
        </div>
      </form>
    </Dialog>
  );
}
