import { useTranslation } from 'react-i18next'

export type SaveStatusValue = 'idle' | 'saving' | 'saved' | 'error' | 'deleted'

/**
 * How the autosave is going: nothing when simply saved. It floats just below the studio's toolbar row,
 * right-aligned, and takes no room in it (QA #380, 2026-11-22): in the row, right of undo/redo, each
 * change of it moved those buttons, and a tap meant for "Qayta urinish" landed on "oldinga" (redo),
 * putting back the drag just undone. The parent must be `relative`.
 */
export function SaveStatus({ status, onRetry }: { status: SaveStatusValue; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div
      className="absolute top-full right-0 mt-1 z-10 flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap pointer-events-none"
      aria-live="polite"
    >
      {status === 'saving' && (
        <span className="px-2 py-1 rounded-lg bg-card/90 shadow-sm text-ink-muted">{t('studio.page.saqlanmoqda')}</span>
      )}
      {status === 'saved' && (
        <span className="px-2 py-1 rounded-lg bg-card/90 shadow-sm text-emerald-600">✓ {t('studio.page.saqlandi')}</span>
      )}
      {status === 'deleted' && (
        <span role="alert" className="px-2 py-1 rounded-lg bg-card/90 shadow-sm text-red-600">{t('studio.page.ochirilgan')}</span>
      )}
      {status === 'error' && (
        <>
          <span className="px-2 py-1 rounded-lg bg-card/90 shadow-sm text-red-600">{t('studio.page.saqlanmadi')}</span>
          <button onClick={onRetry} className="pointer-events-auto px-2.5 py-1 rounded-lg bg-red-600 text-white shadow-sm">
            {t('studio.page.qayta_urinish')}
          </button>
        </>
      )}
    </div>
  )
}
