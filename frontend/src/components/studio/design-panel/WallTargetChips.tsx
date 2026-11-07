import { useWallFocusStore, isWallTarget } from "@/store/wallFocusStore";
import { targetLabel, type WallTargetOption } from "./shared";

/**
 * The walls-and-floor chips at the top of the paint/wallpaper panel. Pointing at a wall's
 * chip (or tabbing to it) lights that wall in the 3D view; pressing it selects the wall and
 * turns the camera to face it. "Hamma devorlar" frames the whole room again.
 */
export function WallTargetChips({ options, value, onSelect }: {
  options: WallTargetOption[];
  value: string;
  onSelect: (key: string) => void;
}) {
  const setHovered = useWallFocusStore((s) => s.setHovered);
  const requestTurn = useWallFocusStore((s) => s.requestTurn);
  const light = (key: string | null) => setHovered(isWallTarget(key) ? key : null);

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const chosen = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={chosen}
            onClick={() => {
              onSelect(option.key);
              if (isWallTarget(option.key)) requestTurn(option.key);
              else if (option.key === "ALL") requestTurn(null);
            }}
            onPointerEnter={() => light(option.key)}
            onPointerLeave={() => light(null)}
            onFocus={() => light(option.key)}
            onBlur={() => light(null)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              chosen ? "bg-brand text-white border-brand font-semibold" : "border-line text-ink-muted hover:border-brand/50"
            }`}
          >
            {targetLabel(option)}
          </button>
        );
      })}
    </div>
  );
}
