import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

export default function Nav() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-300 ${
        scrolled
          ? "border-b border-black/5 bg-white/75 backdrop-blur-md shadow-[0_10px_30px_-20px_rgba(30,41,59,0.5)]"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:px-6">
        <a href="#top" className="flex shrink-0 items-center gap-2.5">
          <img src="/icon.svg" alt="andoza.ai" className="h-9 w-9" />
          {/* on narrow phones the icon alone carries the brand so nothing gets cut off */}
          <span className="hidden text-lg font-bold tracking-tight min-[420px]:inline">andoza.ai</span>
        </a>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Link
            to="/login"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:bg-white/70 hover:text-neutral-900 sm:inline-flex"
          >
            {t("landing.nav.login")}
          </Link>
          <Link
            to="/login"
            className="whitespace-nowrap rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800"
          >
            {t("landing.nav.start")}
          </Link>
        </div>
      </div>
    </header>
  );
}
