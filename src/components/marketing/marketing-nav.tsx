"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { WordMark } from "@/components/marketing/word-mark";

/**
 * Marketing top nav. Product-grade, quiet — no floating pill, no glow.
 *
 * Small hairline that gets a subtle backdrop-blur only after the user
 * scrolls (Linear/Vercel/Cursor pattern). FR/EN swap keeps the current
 * pathname so `/en/pricing` toggles to `/fr/pricing` (not root).
 */
export function MarketingNav() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const pathname = usePathname();
  const otherLocale = locale === "fr" ? "en" : "fr";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200 ${
          scrolled
            ? "border-white/[0.06] bg-black/60 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 md:px-8">
          <Link href="/home" className="flex items-center gap-2.5">
            <WordMark />
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] font-medium text-white/60 md:flex">
            <a href="#face-lock" className="transition-colors hover:text-white">
              {t("navHowItWorks")}
            </a>
            <a href="#studio" className="transition-colors hover:text-white">
              {t("navFeatures")}
            </a>
            <a href="#pricing" className="transition-colors hover:text-white">
              {t("navPricing")}
            </a>
            <Link
              href="/changelog"
              className="transition-colors hover:text-white"
            >
              {t("navChangelog")}
            </Link>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              href={pathname}
              locale={otherLocale}
              className="rounded-full px-2 py-1 font-mono text-[11px] uppercase tracking-widest text-white/50 transition-colors hover:text-white"
              aria-label={`Switch to ${otherLocale.toUpperCase()}`}
            >
              {otherLocale}
            </Link>
            <Link href="/sign-in">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:bg-white/5 hover:text-white"
              >
                {t("signIn")}
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="bg-white text-black hover:bg-white/90">
                {t("tryFree")}
              </Button>
            </Link>
          </div>

          <button
            type="button"
            className="text-white/70 transition-colors hover:text-white md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-x-3 top-16 z-40 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/90 p-5 shadow-2xl backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col divide-y divide-white/[0.06] text-sm text-white/80">
              <a
                href="#face-lock"
                onClick={() => setOpen(false)}
                className="py-3"
              >
                {t("navHowItWorks")}
              </a>
              <a
                href="#studio"
                onClick={() => setOpen(false)}
                className="py-3"
              >
                {t("navFeatures")}
              </a>
              <a
                href="#pricing"
                onClick={() => setOpen(false)}
                className="py-3"
              >
                {t("navPricing")}
              </a>
              <Link
                href="/changelog"
                onClick={() => setOpen(false)}
                className="py-3"
              >
                {t("navChangelog")}
              </Link>
              <Link
                href={pathname}
                locale={otherLocale}
                onClick={() => setOpen(false)}
                className="py-3 font-mono text-[11px] uppercase tracking-widest text-white/50"
              >
                {otherLocale}
              </Link>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Link href="/sign-in" onClick={() => setOpen(false)}>
                <Button
                  variant="outline"
                  className="w-full border-white/10 bg-transparent text-white hover:bg-white/5"
                >
                  {t("signIn")}
                </Button>
              </Link>
              <Link href="/sign-up" onClick={() => setOpen(false)}>
                <Button className="w-full bg-white text-black hover:bg-white/90">
                  {t("tryFree")}
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
