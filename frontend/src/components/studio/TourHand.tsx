// Tutorial "hand": a pointing finger that drops onto the target, presses, and
// sends out a ripple ring (~1.2s, twice). The fingertip sits at (x, y).
export function TourHand({ x, y, replayKey }: { x: number; y: number; replayKey: number }) {
  return (
    <div
      key={replayKey}
      aria-hidden="true"
      className="pointer-events-none fixed z-[1000]"
      style={{ left: x, top: y }}
    >
      <span
        className="absolute -left-5 -top-5 h-10 w-10 rounded-full border-2 border-white/90 bg-white/20 opacity-0 motion-reduce:hidden animate-[tourring_1.2s_ease-out_2]"
      />
      <svg
        width="40"
        height="48"
        viewBox="0 0 40 48"
        className="absolute left-[-14px] top-[-4px] origin-top-left drop-shadow-lg motion-reduce:animate-none animate-[tourtap_1.2s_ease-in-out_2]"
      >
        <path
          d="M14 4a4 4 0 0 1 8 0v18l3-1a4 4 0 0 1 5 2l1-1a4 4 0 0 1 5 3l1-0.5a4 4 0 0 1 4 4V34c0 8-5 13-13 13h-3c-5 0-8-2-11-6L4 31a4 4 0 0 1 6-5l4 4z"
          fill="white"
          stroke="#1f2937"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
