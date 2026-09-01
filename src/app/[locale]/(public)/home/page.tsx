"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  Quote,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/constants";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { HeroPreview } from "@/components/marketing/hero-preview";
import { BentoCapabilities } from "@/components/marketing/bento-capabilities";
import { WordMark } from "@/components/marketing/word-mark";

/**
 * Aura Influences public marketing home.
 *
 * Section grammar (2026 SaaS, one buyer question per section):
 *
 *   1. Nav (quiet, product-grade)
 *   2. Hero — tight claim + React product preview (face → feed loop)
 *   3. Built-with stack
 *   4. Face-lock story — the actual conversion argument
 *   5. Bento capabilities — real product language, not four icon cards
 *   6. Pricing — existing tiers, existing amounts, existing "Most popular"
 *   7. Testimonials — the ones already in the copy files
 *   8. Final CTA
 *   9. Footer
 *
 * Copy comes from `messages/{fr,en}.json` under the `landing` namespace.
 * Plan numbers are pulled straight from `PLANS` (`src/lib/constants.ts`)
 * so the marketing site can never drift from the actual product limits.
 */
export default function LandingPage() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const isFr = locale === "fr";

  const plansForCards: Array<{
    id: keyof typeof PLANS;
    name: string;
    price: string;
    desc: string;
    featured?: boolean;
    features: string[];
  }> = [
    {
      id: "FREE",
      name: PLANS.FREE.name,
      price: "0€",
      desc: isFr ? "Pour tester le studio" : "To try the studio",
      features: [
        isFr
          ? `${PLANS.FREE.credits} crédits offerts`
          : `${PLANS.FREE.credits} free credits`,
        isFr
          ? `${PLANS.FREE.maxInfluencers} influenceuse`
          : `${PLANS.FREE.maxInfluencers} influencer`,
        isFr ? "Visage verrouillé" : "Locked face",
      ],
    },
    {
      id: "STARTER",
      name: PLANS.STARTER.name,
      price: `${PLANS.STARTER.price}€`,
      desc: isFr ? "Pour se lancer" : "To get started",
      features: [
        isFr
          ? `${PLANS.STARTER.credits} crédits / mois`
          : `${PLANS.STARTER.credits} credits / month`,
        isFr
          ? `${PLANS.STARTER.maxInfluencers} influenceuses`
          : `${PLANS.STARTER.maxInfluencers} influencers`,
        isFr ? "Plan éditorial IA" : "AI editorial plan",
        isFr ? "Publication auto IG / TikTok" : "IG / TikTok auto-publish",
      ],
    },
    {
      id: "PRO",
      name: PLANS.PRO.name,
      price: `${PLANS.PRO.price}€`,
      desc: isFr ? "Pour la production" : "For production",
      featured: true,
      features: [
        isFr
          ? `${PLANS.PRO.credits} crédits / mois`
          : `${PLANS.PRO.credits} credits / month`,
        isFr
          ? `${PLANS.PRO.maxInfluencers} influenceuses`
          : `${PLANS.PRO.maxInfluencers} influencers`,
        isFr ? "Vidéo multi-moteurs" : "Multi-engine video",
        isFr ? "Batch + modèle visage dédié" : "Batch + dedicated face model",
      ],
    },
    {
      id: "ENTERPRISE",
      name: PLANS.ENTERPRISE.name,
      price: `${PLANS.ENTERPRISE.price}€`,
      desc: isFr ? "Pour les agences" : "For agencies",
      features: [
        isFr ? "Influenceuses illimitées" : "Unlimited influencers",
        isFr ? "Crédits illimités" : "Unlimited credits",
        isFr ? "Analytics avancés" : "Advanced analytics",
        isFr ? "Webhooks + API" : "Webhooks + API",
      ],
    },
  ];

  const stackItems: Array<{ name: string; role: string }> = [
    { name: "Clerk", role: t("stackAuth") },
    { name: "Stripe", role: t("stackPayments") },
    { name: "Anthropic", role: t("stackLLM") },
    { name: "Replicate", role: t("stackGenImage") },
    { name: "Fal", role: t("stackGenVideo") },
  ];

  const testimonials = [
    {
      quote: t("testimonial1Quote"),
      name: t("testimonial1Name"),
      role: t("testimonial1Role"),
      avatar: "/landing/influencers/luna.jpg",
    },
    {
      quote: t("testimonial2Quote"),
      name: t("testimonial2Name"),
      role: t("testimonial2Role"),
      avatar: "/landing/influencers/marco.jpg",
    },
    {
      quote: t("testimonial3Quote"),
      name: t("testimonial3Name"),
      role: t("testimonial3Role"),
      avatar: "/landing/influencers/amani.jpg",
    },
  ];

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-aurora-deep/40">
      <BackgroundGrid />
      <MarketingNav />

      <main className="relative">
        {/* 1. Hero */}
        <section className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-24">
          {/* Single aurora radial. No mesh salad. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--aurora-deep)_0%,transparent_60%)] opacity-30 blur-3xl"
          />

          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto max-w-3xl text-center"
            >
              <Eyebrow>{t("heroEyebrow")}</Eyebrow>

              <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-white md:text-6xl lg:text-[68px]">
                {t("heroTitle")}
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/60 md:text-lg">
                {t("heroSubtitle")}
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/sign-up" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="h-12 w-full bg-white px-6 text-black hover:bg-white/90 sm:w-auto"
                  >
                    {t("ctaPrimary")}
                    <ArrowRight className="ml-1 size-4" />
                  </Button>
                </Link>
                <a href="#face-lock" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-full border-white/10 bg-white/[0.02] px-6 text-white hover:bg-white/[0.06] sm:w-auto"
                  >
                    {t("ctaSecondary")}
                  </Button>
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-16 md:mt-20"
            >
              <HeroPreview />
            </motion.div>
          </div>
        </section>

        {/* 2. Built-with stack strip (was a fake customer logo wall) */}
        <section className="border-y border-white/[0.05] bg-white/[0.01]">
          <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
            <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
              <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">
                {t("stackTitle")}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
                {stackItems.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-baseline gap-2 text-sm text-white/60"
                  >
                    <span className="font-medium text-white/80">{s.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">
                      {s.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Face-lock story */}
        <section
          id="face-lock"
          className="relative py-24 md:py-32"
        >
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="max-w-2xl">
              <Eyebrow>{t("faceLockEyebrow")}</Eyebrow>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.02em] text-white md:text-5xl">
                {t("faceLockTitle")}
              </h2>
              <p className="mt-5 text-pretty text-base leading-relaxed text-white/55 md:text-lg">
                {t("faceLockSubtitle")}
              </p>

              <ul className="mt-8 space-y-2.5 text-sm text-white/70">
                {[
                  t("faceLockPointFlux"),
                  t("faceLockPointLora"),
                  t("faceLockPointRef"),
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-aurora" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Reference portrait → generated scenes */}
            <div className="mt-12 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-[minmax(0,0.85fr)_auto_minmax(0,1.4fr)] md:items-center md:gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                    {t("faceLockRefLabel")}
                  </span>
                </div>
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/[0.08]">
                  <Image
                    src="/landing/influencers/luna.jpg"
                    alt=""
                    fill
                    sizes="(min-width: 768px) 30vw, 100vw"
                    className="object-cover"
                  />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-aurora/40 bg-black/60 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-aurora backdrop-blur">
                    <span className="size-1.5 rounded-full bg-aurora" />
                    face-lock
                  </span>
                  <span className="absolute inset-x-3 bottom-3 text-[11px] text-white/60">
                    {t("faceLockRefCaption")}
                  </span>
                </div>
              </motion.div>

              <div className="hidden items-center justify-center md:flex">
                <ArrowRight className="size-6 text-white/30" />
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                    {t("faceLockOutLabel")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    "/landing/showcase/luna-gym.jpg",
                    "/landing/showcase/luna-cafe.jpg",
                    "/landing/showcase/luna-mirror.jpg",
                    "/landing/showcase/marco-cafe.jpg",
                  ].map((src, i) => (
                    <motion.div
                      key={src}
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.15 + i * 0.06 }}
                      className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/[0.06]"
                    >
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 15vw, 45vw"
                        className="object-cover"
                      />
                    </motion.div>
                  ))}
                </div>
                <p className="mt-3 text-[12px] text-white/45">
                  {t("faceLockOutCaption")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Bento capabilities */}
        <section id="studio" className="py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="max-w-2xl">
              <Eyebrow>{t("bentoEyebrow")}</Eyebrow>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.02em] text-white md:text-5xl">
                {t("bentoTitle")}
              </h2>
              <p className="mt-5 text-pretty text-base leading-relaxed text-white/55 md:text-lg">
                {t("bentoSubtitle")}
              </p>
            </div>

            <div className="mt-12 md:mt-16">
              <BentoCapabilities />
            </div>
          </div>
        </section>

        {/* 5. Pricing teaser */}
        <section
          id="pricing"
          className="border-t border-white/[0.05] py-24 md:py-32"
        >
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>{t("pricingEyebrow")}</Eyebrow>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.02em] text-white md:text-5xl">
                {t("pricingTitle")}
              </h2>
              <p className="mt-5 text-pretty text-base leading-relaxed text-white/55 md:text-lg">
                {t("pricingSubtitle")}
              </p>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-white/40">
                {t("pricingCreditNote")}
              </p>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {plansForCards.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-6 ${
                    plan.featured
                      ? "border-aurora/40 bg-aurora/[0.04]"
                      : "border-white/[0.08] bg-white/[0.015]"
                  }`}
                >
                  {plan.featured && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-aurora/40 bg-black px-3 py-0.5 font-mono text-[10px] uppercase tracking-widest text-aurora">
                      {t("pricingMostPopular")}
                    </span>
                  )}

                  <h3 className="text-sm font-semibold text-white">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-[12px] text-white/45">{plan.desc}</p>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight text-white">
                      {plan.price}
                    </span>
                    {plan.id !== "FREE" && (
                      <span className="text-[12px] text-white/45">
                        {isFr ? "/mois" : "/mo"}
                      </span>
                    )}
                  </div>

                  <ul className="mt-6 space-y-2 text-[13px] text-white/70">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-white/40" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href="/sign-up" className="mt-6 block">
                    <Button
                      size="sm"
                      variant={plan.featured ? "default" : "outline"}
                      className={
                        plan.featured
                          ? "w-full bg-white text-black hover:bg-white/90"
                          : "w-full border-white/10 bg-transparent text-white hover:bg-white/[0.06]"
                      }
                    >
                      {t("pricingStart")}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link href="/pricing">
                <Button
                  variant="ghost"
                  className="text-white/60 hover:text-white"
                >
                  {t("pricingSeeAll")} <ArrowRight className="ml-1 size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* 6. Testimonials */}
        <section className="border-y border-white/[0.05] bg-white/[0.01] py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="max-w-2xl">
              <Eyebrow>{t("testimonialsEyebrow")}</Eyebrow>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.02em] text-white md:text-5xl">
                {t("testimonialsTitle")}
              </h2>
              <p className="mt-5 text-pretty text-base leading-relaxed text-white/55 md:text-lg">
                {t("testimonialsSubtitle")}
              </p>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {testimonials.map((tt, i) => (
                <motion.figure
                  key={tt.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="relative flex flex-col justify-between rounded-2xl border border-white/[0.07] bg-black/40 p-7"
                >
                  <Quote className="mb-4 size-5 text-white/25" />
                  <blockquote className="text-[15px] leading-relaxed text-white/85">
                    &ldquo;{tt.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <span className="relative size-9 overflow-hidden rounded-full ring-1 ring-white/10">
                      <Image
                        src={tt.avatar}
                        alt={tt.name}
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">
                        {tt.name}
                      </span>
                      <span className="block truncate text-[11px] text-white/45">
                        {tt.role}
                      </span>
                    </span>
                  </figcaption>
                </motion.figure>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Final CTA */}
        <section className="py-24 md:py-32">
          <div className="mx-auto max-w-4xl px-5 md:px-8">
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[oklch(0.06_0.008_285)] p-10 text-center md:p-16">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--aurora-deep)_0%,transparent_60%)] opacity-25"
              />
              <Eyebrow>{t("ctaFinalEyebrow")}</Eyebrow>
              <h2 className="mx-auto mt-5 max-w-xl text-balance text-3xl font-semibold tracking-[-0.02em] text-white md:text-5xl">
                {t("ctaFinalTitle")}
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-pretty text-base leading-relaxed text-white/60">
                {t("ctaFinalSubtitle")}
              </p>
              <Link href="/sign-up" className="mt-8 inline-block">
                <Button
                  size="lg"
                  className="h-12 bg-white px-6 text-black hover:bg-white/90"
                >
                  {t("ctaFinalButton")}
                  <ArrowRight className="ml-1 size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.05]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <WordMark />

          <p className="max-w-md text-[12px] text-white/40">
            {t("footerBuiltWith")}
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/50">
            <Link
              href="/changelog"
              className="transition-colors hover:text-white"
            >
              {t("navChangelog")}
            </Link>
            <Link
              href="/pricing"
              className="transition-colors hover:text-white"
            >
              {t("navPricing")}
            </Link>
            <a
              href="mailto:hello@aurainfluenceai.com"
              className="transition-colors hover:text-white"
            >
              {t("footerSupport")}
            </a>
            <Link
              href="/privacy"
              className="transition-colors hover:text-white"
            >
              {t("footerPrivacy")}
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-white"
            >
              {t("footerTerms")}
            </Link>
          </div>

          <p className="text-[11px] text-white/30">
            © {new Date().getFullYear()} Aura Influences. {t("footerRights")}
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Small uppercase mono-tag we use above every section title for that
 * quiet product-grade rhythm you find on Linear/Vercel/Cursor.
 */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-white/45">
      <span className="size-1 rounded-full bg-aurora" />
      {children}
    </span>
  );
}

/**
 * Site-wide faint grid + noise. Rendered once behind the whole page so the
 * canvas feels like a surface, not a flat black rectangle. Kept extremely
 * subtle — you should barely notice it unless you're looking for it.
 */
function BackgroundGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 opacity-[0.35]"
      style={{
        backgroundImage:
          "linear-gradient(oklch(0.28 0.008 285 / 0.14) 1px, transparent 1px), linear-gradient(90deg, oklch(0.28 0.008 285 / 0.14) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage:
          "radial-gradient(ellipse 90% 60% at 50% 0%, black 40%, transparent 100%)",
      }}
    />
  );
}
