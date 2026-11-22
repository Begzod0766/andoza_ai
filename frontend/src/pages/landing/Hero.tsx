import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import HeroRoom from "./hero-room/HeroRoom";

// ─── Hero ────────────────────────────────────────────────────────────────────
// The promise on the left, the product doing it on the right: a room that
// builds itself from plan to estimate (stacked under the text on phones).

export default function Hero() {
  const { t } = useTranslation();

  return (
    <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-6 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:pb-24 lg:pt-16">
      <div className="text-left">
        <span className="animate-rise-in mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/70 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3b7fff]" />
          {t("landing.hero.eyebrow")}
        </span>

        <h1 className="animate-rise-in text-[36px] font-extrabold leading-[1.04] tracking-tight sm:text-6xl lg:text-[64px]">
          {t("landing.hero.title1")}
          <br />
          <span className="bg-gradient-to-r from-[#3b7fff] via-[#7aa5ff] to-neutral-400 bg-clip-text text-transparent">
            {t("landing.hero.title2")}
          </span>
        </h1>

        <p
          className="animate-rise-in mt-5 max-w-lg text-base text-neutral-500 sm:text-lg"
          style={{ animationDelay: "0.08s" }}
        >
          {t("landing.hero.subtitle")}
        </p>

        <div
          className="animate-rise-in mt-8 flex flex-wrap items-center gap-3"
          style={{ animationDelay: "0.16s" }}
        >
          <Link
            to="/login"
            className="rounded-full bg-[#2563eb] px-7 py-3.5 text-sm font-bold text-white shadow-[0_16px_35px_-12px_rgba(37,99,235,0.7)] transition-transform hover:-translate-y-0.5 hover:bg-[#1d4ed8] active:translate-y-0"
          >
            {t("landing.hero.primary")}
          </Link>
          <a
            href="#how"
            className="inline-flex items-center gap-2 rounded-full px-4 py-3.5 text-sm font-semibold text-neutral-600 transition-colors hover:text-neutral-900"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white shadow ring-1 ring-black/5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            {t("landing.hero.secondary")}
          </a>
        </div>

        <p className="animate-rise-in mt-4 text-[13px] text-neutral-400" style={{ animationDelay: "0.22s" }}>
          {t("landing.hero.note")}
        </p>
      </div>

      <div className="mx-auto w-full max-w-[560px]">
        <HeroRoom />
      </div>
    </main>
  );
}
