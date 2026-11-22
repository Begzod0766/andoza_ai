import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Reveal from "./Reveal";
import HeroRoom from "./hero-room/HeroRoom";
import "./landing-motion.css";

// The closing card ends where the page began: the headline rises in word by
// word next to the finished room from the hero, prices still pinned on it.

export default function FinalCta() {
  const { t } = useTranslation();
  const words = t("landing.finalCta.heading").split(" ");

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <Reveal className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d4ed8] via-[#2563eb] to-[#3b7fff] px-7 py-12 shadow-[0_40px_80px_-30px_rgba(37,99,235,0.7)] sm:px-12 sm:py-16">
        {/* soft texture + glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1.4px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 left-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-white/20 blur-3xl"
        />

        <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="text-left">
            <h2 className="max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
              {words.map((word, i) => (
                <span key={i}>
                  <span className="cta-word" style={{ "--i": i } as React.CSSProperties}>
                    {word}
                  </span>
                  {i < words.length - 1 ? " " : null}
                </span>
              ))}
            </h2>
            <p className="mt-5 max-w-md text-base text-blue-100 sm:text-lg">{t("landing.finalCta.subtitle")}</p>
            <Link
              to="/login"
              className="mt-8 inline-flex items-center rounded-full bg-white px-8 py-3.5 text-sm font-bold text-[#1d4ed8] shadow-[0_16px_35px_-12px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {t("landing.finalCta.button")}
            </Link>
          </div>

          <div className="mx-auto w-full max-w-[400px] lg:max-w-none">
            <HeroRoom still />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
