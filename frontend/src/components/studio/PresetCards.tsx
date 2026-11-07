import { useTranslation } from 'react-i18next'
import { DESIGN_PRESETS } from '@/lib/aiDesignPresets'
import { presetSwatch } from '@/lib/presetSwatch'

/**
 * The ready-made styles as picture cards: a small room drawn in each style's own wall, accent wall
 * and floor, its palette below. A word like "Neoclassical" tells a homeowner little; the colours do.
 */
export function PresetCards({ onPick, selected, disabled }: {
  onPick: (id: string) => void
  /** The style last applied, marked. */
  selected?: string | null
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {DESIGN_PRESETS.map((preset) => {
        const s = presetSwatch(preset)
        const on = preset.id === selected
        const label = t(preset.labelKey)
        return (
          <button
            key={preset.id}
            type="button"
            aria-label={label}
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onPick(preset.id)}
            className={`overflow-hidden rounded-xl bg-white text-left transition hover:border-[#3B63DE]/60 disabled:opacity-60 ${
              on ? 'border-2 border-[#3B63DE]' : 'border border-gray-200'
            }`}
          >
            <div data-part="room" aria-hidden="true" className="relative h-14" style={{ background: s.wall }}>
              <div className="absolute inset-y-0 right-0 w-1/4" style={{ background: s.accent }} />
              <div className="absolute inset-x-0 bottom-0 h-[34%]" style={{ background: s.floor }} />
              <div className="absolute bottom-[22%] left-[16%] h-[24%] w-[46%] rounded-[3px]" style={{ background: s.sofa }} />
            </div>
            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-semibold text-gray-800">{label}</p>
              <div className="mt-1 flex gap-1" aria-hidden="true">
                {s.palette.map((c) => (
                  <span key={c} data-part="swatch" className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
