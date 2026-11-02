/** Form pieces shared by the settings, cabinet and free-part panels. */

export const summary = "flex cursor-pointer list-none items-center justify-between text-sm font-bold text-ink";

/** Turns when its <details> opens. */
export function Chevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180">
      <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const field = "w-full rounded-xl border border-line bg-card px-3 py-2 text-sm focus:border-blue-400 focus:outline-none";
export const invalidField = "border-red-400 bg-red-500/10";

export function NumField({
  id, label, value, onChange, error, disabled,
}: { id: string; label: string; value: number; onChange(v: number): void; error?: string; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-ink-muted">{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ""}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
        className={`${field} ${error ? invalidField : ""}`}
      />
      {error && <p id={`${id}-err`} className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function Select<T extends string | number>({
  id, label, value, options, onChange, disabled, error,
}: { id: string; label: string; value: T; options: { value: T; label: string }[]; onChange(v: T): void; disabled?: boolean; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-ink-muted">{label}</label>
      <select
        id={id}
        value={String(value)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value)!.value)}
        className={`${field} ${error ? invalidField : ""}`}
      >
        {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
      {error && <p id={`${id}-err`} className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
