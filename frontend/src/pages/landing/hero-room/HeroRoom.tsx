/**
 * HeroRoom — a bedroom that builds itself once when the hero comes into view:
 * plan → walls → wallpaper and laminate → furniture → prices → estimate.
 * With reduced motion it shows the finished room straight away; afterwards a
 * button plays it again. Geometry and timing live in ./roomTimeline.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  END,
  FURNITURE,
  ROOM,
  S,
  TAG_ANCHORS,
  WINDOW,
  boxFaces,
  frameAt,
  iso,
  points,
  shade,
  type Pt,
} from "./roomTimeline";
import "./hero-room.css";

const TOTAL = 3912400;
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Where each tag's label sits relative to its pin, and which way it reads. */
const TAG_OFFSETS: { dx: number; dy: number; align: "start" | "end" }[] = [
  { dx: -30, dy: -62, align: "end" },
  { dx: -40, dy: 62, align: "end" },
  { dx: -40, dy: -70, align: "end" },
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Plays the room timeline once when `target` comes into view (at once when `still` or with reduced motion). */
export function useRoomTimeline(target: React.RefObject<HTMLElement | null>, still: boolean) {
  const [t, setT] = useState(() => (still || prefersReducedMotion() ? END : 0));
  const raf = useRef(0);

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (prefersReducedMotion()) {
      setT(END);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const s = (now - start) / 1000;
      setT(Math.min(s, END));
      if (s < END) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    if (still || prefersReducedMotion()) return;
    const el = target.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      play();
      return () => cancelAnimationFrame(raf.current);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, [play, target, still]);

  return { t, play };
}

function Box({ x, y, z, dx, dy, dz, color, opacity }: { x: number; y: number; z: number; dx: number; dy: number; dz: number; color: string; opacity: number }) {
  if (opacity <= 0) return null;
  const f = boxFaces(x, y, z, dx, dy, dz);
  return (
    <g opacity={opacity}>
      <polygon points={points(f.front)} fill={shade(color, -0.14)} />
      <polygon points={points(f.side)} fill={shade(color, -0.28)} />
      <polygon points={points(f.top)} fill={color} />
    </g>
  );
}

function Pill({ at, text, opacity }: { at: Pt; text: string; opacity: number }) {
  if (opacity <= 0) return null;
  const w = text.length * 11.6 + 28;
  return (
    <g opacity={opacity} className="hr-pill">
      <rect x={at[0] - w / 2} y={at[1] - 18} width={w} height={36} rx={18} />
      <text x={at[0]} y={at[1] + 0.5} textAnchor="middle" dominantBaseline="middle">
        {text}
      </text>
    </g>
  );
}

function Tag({ anchor, name, qty, offset, opacity }: { anchor: Pt; name: string; qty: string; offset: (typeof TAG_OFFSETS)[number]; opacity: number }) {
  if (opacity <= 0) return null;
  const end: Pt = [anchor[0] + offset.dx, anchor[1] + offset.dy];
  const w = name.length * 12 + qty.length * 13.2 + 46;
  const x = offset.align === "end" ? end[0] - w : end[0];
  const rise = (1 - opacity) * 12;
  return (
    <g className="hr-tag" opacity={opacity} transform={`translate(0 ${rise})`}>
      <line x1={anchor[0]} y1={anchor[1]} x2={end[0]} y2={end[1]} />
      <circle cx={anchor[0]} cy={anchor[1]} r={7} />
      <rect x={x} y={end[1] - 23} width={w} height={46} rx={12} />
      <text x={x + 17} y={end[1] + 1} dominantBaseline="middle">
        <tspan className="hr-tag-name">{name}</tspan>
        <tspan dx={10}>{qty}</tspan>
      </text>
    </g>
  );
}

/** The room drawn at moment `t` of the timeline (seconds, 0..END). */
export function RoomSvg({ t, className = "hr-svg", viewBox = "-330 -300 720 720" }: { t: number; className?: string; viewBox?: string }) {
  const { t: tr } = useTranslation();
  // several rooms can be on the page: keep their pattern ids apart
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const wpId = `hr-wallpaper-${uid}`;
  const lamId = `hr-laminate-${uid}`;
  const f = frameAt(t);
  const tags = tr("landing.hero.room.tags", { returnObjects: true }) as { name: string; qty: string }[];
  const m = tr("landing.story.m");

  const { w: W, d: D, h: H } = ROOM;
  const h = H * f.walls;
  const floor = [iso(0, 0, 0), iso(W, 0, 0), iso(W, D, 0), iso(0, D, 0)];
  const leftWall = [iso(0, 0, 0), iso(0, D, 0), iso(0, D, h), iso(0, 0, h)];
  const backWall = [iso(0, 0, 0), iso(W, 0, 0), iso(W, 0, h), iso(0, 0, h)];
  const winTop = Math.min(WINDOW.z1, h);
  const win = winTop > WINDOW.z0 ? [iso(WINDOW.x0, 0, WINDOW.z0), iso(WINDOW.x1, 0, WINDOW.z0), iso(WINDOW.x1, 0, winTop), iso(WINDOW.x0, 0, winTop)] : null;
  const dimsA = f.dims * (1 - f.finish);
  const front = iso(W / 2, D, 0);
  const right = iso(W, D / 2, 0);

  return (
      <svg viewBox={viewBox} className={className} aria-hidden>
        <defs>
          {/* wallpaper: soft vertical stripes, like the first sample in the story */}
          <pattern id={wpId} width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#E4E8F3" />
            <rect width="5" height="14" fill="#C9D3EC" />
          </pattern>
          {/* laminate planks laid along x, skewed onto the iso floor */}
          <pattern id={lamId} width={S * 1.2} height={S * 0.2} patternUnits="userSpaceOnUse" patternTransform="matrix(0.866 0.5 -0.866 0.5 0 0)">
            <rect width={S * 1.2} height={S * 0.2} fill="#C4905A" />
            <rect width={S * 1.2} height="1.6" fill="#A9773F" />
            <rect width="1.6" height={S * 0.2} fill="#A9773F" />
          </pattern>
        </defs>

        {/* floor */}
        <polygon points={points(floor)} className="hr-floor-plan" />
        <polygon points={points(floor)} fill={`url(#${lamId})`} opacity={f.finish} />

        {/* walls */}
        {h > 0.5 && (
          <g>
            <polygon points={points(leftWall)} fill="#B7C3E2" />
            <polygon points={points(backWall)} fill="#C6D1EA" />
            <polygon points={points(leftWall)} fill={`url(#${wpId})`} opacity={f.finish} style={{ filter: "brightness(0.9)" }} />
            <polygon points={points(backWall)} fill={`url(#${wpId})`} opacity={f.finish} />
            {win && <polygon points={points(win)} className="hr-window" />}
            <polyline points={points([iso(0, D, h), iso(0, 0, h), iso(W, 0, h)])} className="hr-wall-top" />
          </g>
        )}

        {/* the plan being traced */}
        <polygon points={points(floor)} pathLength={1} className="hr-outline" strokeDasharray="1" strokeDashoffset={1 - f.outline} />

        <Pill at={[front[0] - 30, front[1] + 34]} text={`${W.toFixed(2)} ${m}`} opacity={dimsA} />
        <Pill at={[right[0] + 44, right[1] + 26]} text={`${D.toFixed(2)} ${m}`} opacity={dimsA} />

        {/* furniture lands */}
        {FURNITURE.map((p, i) => (
          <Box key={p.id} x={p.x} y={p.y} z={(p.z ?? 0) + f.furniture[i].lift} dx={p.dx} dy={p.dy} dz={p.dz} color={p.color} opacity={f.furniture[i].opacity} />
        ))}

        {/* prices pinned to what they belong to */}
        {TAG_ANCHORS.map((a, i) =>
          tags[i] ? <Tag key={i} anchor={iso(a[0], a[1], a[2])} name={tags[i].name} qty={tags[i].qty} offset={TAG_OFFSETS[i]} opacity={f.tags[i]} /> : null,
        )}
      </svg>
  );
}

/** `still` draws the finished room only: no build, no estimate bar, no replay (used as a closing picture). */
export default function HeroRoom({ still = false }: { still?: boolean }) {
  const { t: tr } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const { t, play } = useRoomTimeline(ref, still);
  const f = frameAt(t);
  const done = t >= END;

  return (
    <div ref={ref} className={still ? "hr-card hr-card-still" : "hr-card"} {...(still ? { "aria-hidden": true } : { role: "img", "aria-label": tr("landing.hero.room.label") })}>
      <RoomSvg t={t} />

      {!still && (
        <div className="hr-total" style={{ opacity: f.total > 0 ? 1 : 0 }}>
          <span>{tr("landing.hero.room.estimate")}</span>
          <b>
            {fmt(TOTAL * f.total)} {tr("landing.hero.room.currency")}
          </b>
        </div>
      )}

      {done && !still && (
        <button type="button" className="hr-replay" onClick={play}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          {tr("landing.hero.room.replay")}
        </button>
      )}
    </div>
  );
}
