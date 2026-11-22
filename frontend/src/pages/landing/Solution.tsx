import { useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Reveal from "./Reveal";
import { SCREENS } from "./solution/PhoneScreens";
import { useAutoCycle } from "./solution/useAutoCycle";
import "./solution/solution.css";

// One phone, one screen at a time: while the section is on screen the phone
// steps through the modules on its own and the list lights the one shown.
// Picking a module in the list shows it and stops the stepping.

const INTERVAL = 3200; // ms per module

export default function Solution() {
  const { t } = useTranslation();
  const items = t("landing.solution.items", { returnObjects: true }) as { title: string; desc: string }[];
  const ref = useRef<HTMLDivElement>(null);
  const onScreen = useInView(ref, { amount: 0.45 });
  const reduced = useReducedMotion() ?? false;
  const count = Math.min(items.length, SCREENS.length);
  const { index, auto, select } = useAutoCycle(count, INTERVAL, onScreen && !reduced);

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
          {t("landing.solution.heading")}
        </h2>
      </Reveal>

      <div ref={ref} className="mt-12 grid items-center gap-10 lg:mt-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
        <div className="sol-phone" aria-hidden>
          <div className="sol-screen">
            <span className="sol-notch" />
            {SCREENS.slice(0, count).map((Screen, i) => {
              const dark = i === 0;
              return (
                <div key={i} className={`sol-view${i === index ? " on" : ""}${dark ? " full" : ""}`} data-screen={i}>
                  <div className={`sol-head${dark ? " dark" : ""}`}>{items[i].title}</div>
                  <Screen />
                </div>
              );
            })}
          </div>
        </div>

        <ol className="flex flex-col gap-1.5">
          {items.slice(0, count).map((item, i) => {
            const on = i === index;
            return (
              <li key={item.title}>
                <button type="button" className={`sol-item${on ? " on" : ""}`} aria-pressed={on} onClick={() => select(i)}>
                  <span className={`block text-base font-bold sm:text-lg ${on ? "text-neutral-900" : "text-neutral-500"}`}>
                    {item.title}
                  </span>
                  <span className="sol-desc">
                    <span className="block overflow-hidden pt-1 text-sm leading-relaxed text-neutral-500">{item.desc}</span>
                  </span>
                  {on && auto && onScreen && !reduced && (
                    <span key={index} className="sol-timer" style={{ animationDuration: `${INTERVAL}ms` }} aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
