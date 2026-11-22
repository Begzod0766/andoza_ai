import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Icon, type IconName } from "./icons";
import Reveal from "./Reveal";
import { RoomSvg, useRoomTimeline } from "./hero-room/HeroRoom";
import { stepView } from "./hero-room/howSteps";
import "./hero-room/hero-room.css";

const ICONS: IconName[] = ["scan", "palette", "calculator"];

interface Step {
  title: string;
  desc: string;
}

// The three steps draw themselves in turn, as one timeline cut into chapters:
// the plan is traced, the room is built and furnished, the prices pin on. The
// line after a step fills once it is done. Plays once; reduced motion shows
// every step finished.

export default function HowItWorks() {
  const { t } = useTranslation();
  const steps = t("landing.how.steps", { returnObjects: true }) as Step[];
  const ref = useRef<HTMLDivElement>(null);
  const { t: time } = useRoomTimeline(ref, false);

  return (
    <section id="how" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-20 sm:py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">{t("landing.how.heading")}</h2>
      </Reveal>

      <div ref={ref} className="mt-12 grid gap-9 lg:mt-14 lg:grid-cols-3 lg:gap-8">
        {steps.slice(0, 3).map((step, i) => {
          const v = stepView(time, i);
          const last = i === Math.min(steps.length, 3) - 1;
          return (
            <div key={step.title} className="how-step" data-lit={v.lit}>
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-full text-base font-extrabold transition-colors duration-300 ${
                    v.lit
                      ? "bg-[#2563eb] text-white shadow-[0_14px_30px_-12px_rgba(37,99,235,0.7)]"
                      : "bg-white text-neutral-400 ring-1 ring-neutral-200"
                  }`}
                >
                  {i + 1}
                </span>
                {!last && (
                  <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-neutral-200" aria-hidden>
                    <span className="absolute inset-0 origin-left rounded-full bg-[#2563eb]" style={{ transform: `scaleX(${v.line})` }} />
                  </span>
                )}
              </div>

              {/* phones: picture beside the words; desktop: picture above them */}
              <div className="mt-4 grid grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] items-center gap-4 lg:mt-5 lg:block">
                <div className="how-board" style={{ opacity: v.lit ? 1 : 0.4 }} aria-hidden>
                  <RoomSvg t={v.t} className="hr-svg how-svg" viewBox="-340 -310 740 740" />
                </div>
                <div className="lg:mt-5">
                  <div className="flex items-center gap-2">
                    <Icon name={ICONS[i]} className="h-5 w-5 flex-shrink-0 text-[#2563eb]" />
                    <h3 className="text-base font-bold text-neutral-900 sm:text-lg">{step.title}</h3>
                  </div>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-neutral-500">{step.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
