import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { intlLocale } from "@/i18n";
import { listAdminNormLog, listAdminNorms, resetAdminNorm, setAdminNorm, type AdminNorm } from "@/lib/api/adminNorms";
import { type FormError, requestError } from "@/lib/formError";

const fmt = (v: number) => v.toLocaleString(intlLocale(), { maximumFractionDigits: 4 });

/**
 * The prices in the estimate's three norm files (spec 2026-11-15): each number with its name, unit
 * and the file's own value; a changed one is marked and can be put back. Saved on leaving the field
 * or Enter; it reaches every estimate within a minute.
 */
export function NormsTab({ onError }: { onError: (message: FormError) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const norms = useQuery({ queryKey: ["admin-norms"], queryFn: listAdminNorms });
  const log = useQuery({ queryKey: ["admin-norms-log"], queryFn: () => listAdminNormLog(50) });

  const done = (n: AdminNorm) => {
    onError(null);
    qc.setQueryData<{ entries: AdminNorm[] }>(["admin-norms"], (old) =>
      old && { entries: old.entries.map((e) => (e.file === n.file && e.path === n.path ? n : e)) });
    void qc.invalidateQueries({ queryKey: ["admin-norms-log"] });
  };
  const save = useMutation({
    mutationFn: ({ e, value }: { e: AdminNorm; value: number }) => setAdminNorm(e.file, e.path, value),
    onSuccess: done,
    onError: (err) => onError(requestError(err, "dokon.admin.norms.save_failed")),
  });
  const reset = useMutation({
    mutationFn: (e: AdminNorm) => resetAdminNorm(e.file, e.path),
    onSuccess: done,
    onError: (err) => onError(requestError(err, "dokon.admin.norms.save_failed")),
  });

  const groups = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase();
    const out = new Map<string, AdminNorm[]>();
    for (const e of norms.data?.entries ?? []) {
      if (needle && !e.label.toLocaleLowerCase().includes(needle) && !e.group.toLocaleLowerCase().includes(needle)) continue;
      out.set(e.group, [...(out.get(e.group) ?? []), e]);
    }
    return [...out.entries()];
  }, [norms.data, q]);

  if (norms.isError) return <p className="text-sm text-red-500">{t("dokon.admin.norms.load_failed")}</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-muted">{t("dokon.admin.norms.intro")}</p>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("dokon.admin.norms.search")}
        aria-label={t("dokon.admin.norms.search")}
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink" />
      {groups.map(([group, entries]) => (
        <section key={group} className="rounded-2xl border border-line bg-card">
          <h3 className="border-b border-line px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{group}</h3>
          <table className="w-full text-sm">
            <tbody>
              {entries.map((e) => (
                <NormRow key={`${e.file}:${e.path}`} e={e} busy={save.isPending || reset.isPending}
                  onSave={(value) => save.mutate({ e, value })} onReset={() => reset.mutate(e)} />
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">{t("dokon.admin.norms.log")}</h3>
        <ul aria-label={t("dokon.admin.norms.log")} className="space-y-1 text-xs text-ink">
          {(log.data?.items ?? []).map((c, i) => (
            <li key={i} className="flex flex-wrap gap-x-2">
              <span className="text-ink-muted">{new Date(c.created_at).toLocaleString(intlLocale())}</span>
              <span className="font-medium">{c.label}</span>
              <span>
                {c.old_value == null ? t("dokon.admin.norms.default_word") : fmt(c.old_value)}
                {" → "}
                {c.new_value == null ? t("dokon.admin.norms.default_word") : fmt(c.new_value)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function NormRow({ e, busy, onSave, onReset }: { e: AdminNorm; busy: boolean; onSave: (v: number) => void; onReset: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(String(e.value));
  const [shown, setShown] = useState(e.value);
  // A saved or reset value from the server replaces what is typed.
  if (shown !== e.value) {
    setShown(e.value);
    setText(String(e.value));
  }
  const commit = () => {
    const v = Number(text.replace(",", "."));
    if (text.trim() === "" || !Number.isFinite(v) || v === e.value) return;
    onSave(v);
  };
  return (
    <tr aria-label={e.label} className="border-b border-line last:border-0">
      <td className="px-3 py-2 text-ink">
        {e.overridden && <span aria-hidden className="mr-1 text-accent">●</span>}
        {e.label}
        <span className="block text-[11px] text-ink-muted">{t("dokon.admin.norms.default", { value: fmt(e.default) })}</span>
      </td>
      <td className="w-40 px-2 py-2">
        <input type="number" step="any" min="0" inputMode="decimal" value={text} disabled={busy}
          aria-label={`${e.label}, ${e.unit}`}
          onChange={(ev) => setText(ev.target.value)} onBlur={commit}
          onKeyDown={(ev) => { if (ev.key === "Enter") commit(); }}
          className="w-full rounded-lg border border-line bg-card px-2 py-1 text-right text-sm text-ink" />
      </td>
      <td className="w-24 px-2 py-2 text-[11px] text-ink-muted">{e.unit}</td>
      <td className="w-28 px-2 py-2 text-right">
        {e.overridden && (
          <button type="button" onClick={onReset} disabled={busy} className="text-[11px] font-medium text-accent hover:underline">
            {t("dokon.admin.norms.reset")}
          </button>
        )}
      </td>
    </tr>
  );
}
