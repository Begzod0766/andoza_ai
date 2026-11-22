/**
 * The six screens the Solution phone shows, one per module, in the order of
 * landing.solution.items: scanner, studio, estimate, shop, craftsmen, stages.
 * They are pictures of the app, not the app: decorative, so the list beside
 * the phone carries the words.
 */
import { useTranslation } from "react-i18next";
import { RoomSvg } from "../hero-room/HeroRoom";

const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/* L-shaped room from the story, in metres */
const PLAN: [number, number][] = [[0, 0], [4.7, 0], [4.7, 2.1], [3.6, 2.1], [3.6, 3.3], [0, 3.3]];

function ScannerScreen() {
  const { t } = useTranslation();
  const s = 40;
  const ox = 36;
  const oy = 130;
  const pts = PLAN.map(([x, y]) => [ox + x * s, oy + y * s] as const);
  // points the sweep has collected, spread along the walls
  const dots: [number, number][] = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    for (let k = 0; k < 9; k++) {
      const u = (k + 0.5) / 9;
      const j = ((i * 7 + k * 13) % 5) - 2;
      dots.push([a[0] + (b[0] - a[0]) * u + j * 0.8, a[1] + (b[1] - a[1]) * u - j * 0.8]);
    }
  });
  return (
    <svg viewBox="0 0 260 420" className="scr-fill" preserveAspectRatio="xMidYMid slice">
      <rect x="-200" y="-200" width="660" height="820" fill="#0f2766" />
      <g opacity="0.12" stroke="#bed0ff">
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={i * 24} y1="0" x2={i * 24} y2="420" />
        ))}
        {Array.from({ length: 18 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 24} x2="260" y2={i * 24} />
        ))}
      </g>
      <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="rgba(190,208,255,0.08)" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.8" fill="#ff9340" />
      ))}
      <g className="scr-sweep" style={{ transformOrigin: "120px 190px" }}>
        <path d="M120 190 L250 150 A136 136 0 0 1 250 230 Z" fill="url(#scr-sweep-grad)" />
      </g>
      <defs>
        <linearGradient id="scr-sweep-grad" x1="0" x2="1">
          <stop offset="0" stopColor="#ff9340" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff9340" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="110" y="176" width="20" height="30" rx="5" fill="#ffffff" stroke="#ff9340" strokeWidth="2" />
      <text x="130" y="360" textAnchor="middle" className="scr-mono" fill="#ff9340" fontSize="15">{t("landing.story.s1.accuracyValue")}</text>
      <text x="130" y="384" textAnchor="middle" className="scr-mono" fill="#bcc9ec" fontSize="12">{`14.2 ${t("landing.story.m2")}`}</text>
    </svg>
  );
}

function StudioScreen() {
  const swatches = ["#C9D3EC", "#A9C3B0", "#E2BFBF", "#1F4D3E", "#98A1B0"];
  return (
    <div className="scr-studio">
      <div className="scr-studio-room">
        <RoomSvg t={4.8} className="scr-fill" viewBox="-310 -290 680 680" />
      </div>
      <div className="scr-swatches">
        {swatches.map((c, i) => (
          <span key={c} style={{ background: c }} className={i === 0 ? "on" : undefined} />
        ))}
      </div>
    </div>
  );
}

function EstimateScreen() {
  const { t } = useTranslation();
  const tags = t("landing.hero.room.tags", { returnObjects: true }) as { name: string; qty: string }[];
  const amounts = [1935000, 2071000, 1510000];
  const cur = t("landing.hero.room.currency");
  return (
    <div className="scr-list">
      {tags.map((tag, i) => (
        <div key={tag.name} className="scr-row">
          <span>
            <b>{tag.name}</b>
            <small>{tag.qty}</small>
          </span>
          <em>{fmt(amounts[i] ?? 0)}</em>
        </div>
      ))}
      <div className="scr-total">
        <span>{t("landing.hero.room.estimate")}</span>
        <b>
          {fmt(amounts.reduce((a, b) => a + b, 0))} {cur}
        </b>
      </div>
    </div>
  );
}

function ShopScreen() {
  const { t } = useTranslation();
  const cur = t("landing.hero.room.currency");
  const items = [
    { bg: "repeating-linear-gradient(90deg,#E4E8F3 0 5px,#C9D3EC 5px 9px)", price: 189000 },
    { bg: "repeating-linear-gradient(0deg,#C4905A 0 9px,#A9773F 9px 10px)", price: 145000 },
    { bg: "radial-gradient(circle at 50% 40%,#5F78B8 0 32%,#DCE3F4 33%)", price: 312000 },
    { bg: "linear-gradient(160deg,#F3D9A8,#C9A27A)", price: 98000 },
  ];
  return (
    <div className="scr-grid">
      {items.map((it, i) => (
        <div key={i} className="scr-tile">
          <span style={{ background: it.bg }} />
          <b>
            {fmt(it.price)} <small>{cur}</small>
          </b>
        </div>
      ))}
    </div>
  );
}

function CraftsmenScreen() {
  const people = [
    { c: "#5F78B8", r: "4.9" },
    { c: "#2F6F73", r: "4.8" },
    { c: "#C24E06", r: "4.7" },
  ];
  return (
    <div className="scr-list">
      {people.map((p) => (
        <div key={p.r} className="scr-person">
          <span className="scr-avatar" style={{ background: p.c }} />
          <span className="scr-lines">
            <i />
            <i />
          </span>
          <span className="scr-stars">★ {p.r}</span>
        </div>
      ))}
    </div>
  );
}

function StagesScreen() {
  const stages = [1, 1, 0.6, 0];
  return (
    <div className="scr-list">
      <div className="scr-progress">
        <span style={{ width: "65%" }} />
      </div>
      {stages.map((v, i) => (
        <div key={i} className="scr-stage">
          <span className={v >= 1 ? "scr-check done" : v > 0 ? "scr-check half" : "scr-check"}>{v >= 1 ? "✓" : i + 1}</span>
          <span className="scr-stage-bar">
            <span style={{ width: `${v * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

export const SCREENS = [ScannerScreen, StudioScreen, EstimateScreen, ShopScreen, CraftsmenScreen, StagesScreen];
