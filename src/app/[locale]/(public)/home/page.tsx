"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PLANS, CREDIT_COSTS } from "@/lib/constants";
import { PRODUCT_NAME, SUPPORT_EMAIL } from "@/lib/site";
import {
  CheckCircle2,
  Play,
  ArrowRight,
  Menu,
  X,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
} from "lucide-react";

/**
 * Public landing page.
 *
 * All copy lives in `messages/{fr,en}.json` under the `landing` namespace,
 * so adding a locale = translating the JSON, no template changes.
 *
 * All pricing numbers (credits, max influencers) are read straight from
 * `PLANS` (`src/lib/constants.ts`) so a single source of truth drives the
 * marketing site, the in-app billing page, the upgrade modal, etc.
 */
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = useTranslations("landing");
  const locale = useLocale();
  const pathname = usePathname();

  const features = [
    { title: t("feature1Title"), desc: t("feature1Desc") },
    { title: t("feature2Title"), desc: t("feature2Desc") },
    { title: t("feature3Title"), desc: t("feature3Desc") },
    { title: t("feature4Title"), desc: t("feature4Desc") },
  ];

  const steps = [
    { step: "01", title: t("step1Title"), desc: t("step1Desc") },
    { step: "02", title: t("step2Title"), desc: t("step2Desc") },
    { step: "03", title: t("step3Title"), desc: t("step3Desc") },
    { step: "04", title: t("step4Title"), desc: t("step4Desc") },
  ];

  // Pricing teaser: read numbers from the single source of truth (PLANS) so
  // the landing can never drift from the actual product limits. Copy bits
  // that are not yet i18n-keyed (descriptions, feature one-liners) are
  // hand-translated inline since they're tiny and rarely change.
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
      desc: isFr ? "Pour tester la plateforme" : "To try the platform",
      features: [
        isFr
          ? `${PLANS.FREE.credits} crédits offerts`
          : `${PLANS.FREE.credits} free credits`,
        isFr
          ? `${PLANS.FREE.maxInfluencers} influenceuse`
          : `${PLANS.FREE.maxInfluencers} influencer`,
        isFr ? "Outils de base" : "Core tools",
      ],
    },
    {
      id: "STARTER",
      name: PLANS.STARTER.name,
      price: `${PLANS.STARTER.price}€`,
      desc: isFr ? "Idéal pour se lancer" : "Perfect to get started",
      featured: true,
      features: [
        isFr
          ? `${PLANS.STARTER.credits} crédits / mois`
          : `${PLANS.STARTER.credits} credits / month`,
        isFr
          ? `${PLANS.STARTER.maxInfluencers} influenceuses`
          : `${PLANS.STARTER.maxInfluencers} influencers`,
        isFr ? "Plan éditorial IA" : "AI editorial plan",
        isFr ? "Publication auto" : "Auto-publishing",
        isFr ? "Feed tendances" : "Trend feed",
      ],
    },
    {
      id: "PRO",
      name: PLANS.PRO.name,
      price: `${PLANS.PRO.price}€`,
      desc: isFr ? "Pour les pros" : "For pros",
      features: [
        isFr
          ? `${PLANS.PRO.credits} crédits / mois`
          : `${PLANS.PRO.credits} credits / month`,
        isFr
          ? `${PLANS.PRO.maxInfluencers} influenceuses`
          : `${PLANS.PRO.maxInfluencers} influencers`,
        isFr ? "Génération vidéo" : "Video generation",
        isFr ? "Génération batch" : "Batch generation",
      ],
    },
    {
      id: "ENTERPRISE",
      name: PLANS.ENTERPRISE.name,
      price: `${PLANS.ENTERPRISE.price}€`,
      desc: isFr ? "Pour les agences" : "For agencies",
      features: [
        isFr ? "Influenceuses illimitées" : "Unlimited influencers",
        isFr
          ? `${PLANS.ENTERPRISE.credits} crédits / mois`
          : `${PLANS.ENTERPRISE.credits} credits / month`,
        isFr ? "Génération batch" : "Batch generation",
        isFr ? "Analytics avancés" : "Advanced analytics",
      ],
    },
  ];

  const otherLocale = locale === "fr" ? "en" : "fr";

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <span className="text-base font-semibold tracking-tight">
              Aura <span className="font-normal text-muted-foreground">Influences</span>
            </span>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              {t("navFeatures")}
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              {t("navHowItWorks")}
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              {t("navPricing")}
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href={pathname}
              locale={otherLocale}
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`Switch to ${otherLocale.toUpperCase()}`}
            >
              {otherLocale.toUpperCase()}
            </Link>
            <Link href="/sign-in" locale={locale}>
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                {t("signIn")}
              </Button>
            </Link>
            <Link href="/sign-up" locale={locale}>
              <Button size="sm" className="shadow-none">{t("tryFree")}</Button>
            </Link>
          </div>

          <button
            type="button"
            className="text-muted-foreground transition-colors hover:text-foreground md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
          <div className="fixed inset-x-0 top-14 z-40 border-b border-white/10 bg-background px-6 py-4 md:hidden">
            <div className="flex flex-col gap-4 text-sm font-medium">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="text-foreground/80 py-2 border-b border-border/60"
              >
                {t("navFeatures")}
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="text-foreground/80 py-2 border-b border-border/60"
              >
                {t("navHowItWorks")}
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="text-foreground/80 py-2 border-b border-border/60"
              >
                {t("navPricing")}
              </a>
              <Link
                href={pathname}
                locale={otherLocale}
                onClick={() => setMobileMenuOpen(false)}
                className="text-foreground/80 py-2 border-b border-border/60 uppercase text-xs tracking-wider"
              >
                {otherLocale.toUpperCase()}
              </Link>
              <div className="flex flex-col gap-2 pt-4">
                <Link href="/sign-in" locale={locale} onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="outline"
                    className="w-full border-white/10 bg-transparent text-foreground shadow-none backdrop-blur-none"
                  >
                    {t("signIn")}
                  </Button>
                </Link>
                <Link href="/sign-up" locale={locale} onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full border-0 bg-foreground text-background shadow-none">
                    {t("tryFree")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

      <main>
        {/* Hero */}
        <section className="pt-24 pb-20 md:pt-32 md:pb-32">
          <div className="container mx-auto px-6">
            <div className="mx-auto max-w-4xl text-center">
              <p className="mx-auto mb-8 max-w-xl text-balance font-mono text-[11px] uppercase leading-relaxed tracking-[0.14em] text-muted-foreground md:text-xs md:tracking-[0.18em]">
                {t("heroBadge")}
              </p>

              <h1 className="mb-6 text-5xl font-bold leading-[1.02] tracking-tight text-foreground md:text-7xl lg:text-8xl">
                {t("heroTitlePart1")} {t("heroTitleHighlight")}
                {t("heroTitlePart2")}
              </h1>

              <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                {t("heroSubtitle")}
              </p>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/sign-up" locale={locale}>
                  <Button size="lg" className="h-14 w-full px-8 shadow-none sm:w-auto">
                    {t("ctaPrimary")} <ArrowRight className="ml-2 size-4" />
                  </Button>
                </Link>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="h-14 w-full border-white/10 bg-transparent px-8 shadow-none backdrop-blur-none sm:w-auto"
                  onClick={() => {
                    document
                      .getElementById("showcase")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <Play className="mr-2 size-4" /> {t("ctaWatchDemo")}
                </Button>
              </div>
            </div>

            <div className="relative mx-auto mt-16 max-w-6xl md:mt-20">
              <p className="mb-6 text-center font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t("heroPhotoBadge")}
              </p>

              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-background p-3 md:p-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                  {[
                    { src: "/landing/showcase/luna-gym.jpg", caption: t("showcaseCaptionGym") },
                    { src: "/landing/showcase/amani-restaurant.jpg", caption: t("showcaseCaptionRestaurant") },
                    { src: "/landing/showcase/kenji-tokyo.jpg", caption: t("showcaseCaptionTokyo") },
                    { src: "/landing/showcase/marco-nyc.jpg", caption: t("showcaseCaptionNyc") },
                  ].map((shot, i) => (
                    <div
                      key={shot.src}
                      className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-950"
                    >
                      <Image
                        src={shot.src}
                        alt={shot.caption}
                        fill
                        sizes="(min-width: 768px) 25vw, 50vw"
                        className="object-cover"
                        priority={i < 2}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/80 px-3 py-2">
                        <p className="truncate text-xs text-white md:text-sm">
                          {shot.caption}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats strip + social proof */}
        <section className="border-y border-white/10 py-12">
          <div className="container mx-auto px-6">
            <div className="mx-auto mb-4 grid max-w-5xl grid-cols-2 gap-6 md:grid-cols-4 md:gap-10">
              {[
                { value: `${CREDIT_COSTS.PHOTO}`, label: t("statsPhotosGenerated") },
                { value: `${CREDIT_COSTS.REEL}`, label: t("statsAvgGenTime") },
                { value: "IG + TT", label: t("statsCountries") },
                { value: "FR / EN", label: t("statsActiveAgencies") },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                    {stat.value}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {t("socialProofTitle")}
            </p>
          </div>
        </section>

        {/* Showcase — 4 personas with Instagram-style cards */}
        <section id="showcase" className="py-24 md:py-32 relative overflow-hidden scroll-mt-24">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t("heroPhotoBadge")}
              </p>
              <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight text-foreground">
                {t("showcaseTitle")}
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {t("showcaseSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {[
                {
                  name: t("showcaseLuna"),
                  handle: "@luna.lifestyle",
                  avatar: "/landing/influencers/luna.jpg",
                  posts: [
                    { src: "/landing/showcase/luna-gym.jpg", caption: t("showcaseCaptionGym"), likes: "12.4K", comments: "284" },
                    { src: "/landing/showcase/luna-cafe.jpg", caption: t("showcaseCaptionCafe"), likes: "8.9K", comments: "156" },
                    { src: "/landing/showcase/luna-mirror.jpg", caption: t("showcaseCaptionMirror"), likes: "15.7K", comments: "412" },
                  ],
                },
                {
                  name: t("showcaseAmani"),
                  handle: "@amani.style",
                  avatar: "/landing/influencers/amani.jpg",
                  posts: [
                    { src: "/landing/showcase/amani-restaurant.jpg", caption: t("showcaseCaptionRestaurant"), likes: "21.3K", comments: "503" },
                    { src: "/landing/showcase/amani-shopping.jpg", caption: "Shopping day", likes: "9.1K", comments: "187" },
                  ],
                },
                {
                  name: t("showcaseKenji"),
                  handle: "@kenji.tokyo",
                  avatar: "/landing/influencers/kenji.jpg",
                  posts: [
                    { src: "/landing/showcase/kenji-tokyo.jpg", caption: t("showcaseCaptionTokyo"), likes: "18.6K", comments: "402" },
                    { src: "/landing/showcase/kenji-street1.jpg", caption: "Daylight fit", likes: "11.2K", comments: "231" },
                    { src: "/landing/showcase/kenji-shop.jpg", caption: "Vintage finds", likes: "7.4K", comments: "98" },
                  ],
                },
                {
                  name: t("showcaseMarco"),
                  handle: "@marco.travels",
                  avatar: "/landing/influencers/marco.jpg",
                  posts: [
                    { src: "/landing/showcase/marco-nyc.jpg", caption: t("showcaseCaptionNyc"), likes: "24.1K", comments: "612" },
                    { src: "/landing/showcase/marco-cafe.jpg", caption: "Espresso run", likes: "9.8K", comments: "204" },
                    { src: "/landing/showcase/marco-park.jpg", caption: "Park days", likes: "13.5K", comments: "318" },
                  ],
                },
              ].map((persona) => (
                <article
                  key={persona.handle}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950"
                >
                  {/* Profile header */}
                  <div className="p-4 flex items-center gap-3 border-b border-border">
                    <div className="relative size-11 rounded-full overflow-hidden ring-1 ring-border shrink-0">
                      <Image
                        src={persona.avatar}
                        alt={persona.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-foreground truncate flex items-center gap-1">
                        {persona.handle}
                        <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-primary">
                          <CheckCircle2 className="size-2.5 text-primary-foreground" />
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {persona.name}
                      </div>
                    </div>
                  </div>

                  {/* Main post */}
                  <div className="relative aspect-[4/5] bg-muted">
                    <Image
                      src={persona.posts[0].src}
                      alt={persona.posts[0].caption}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>

                  {/* IG-style actions */}
                  <div className="p-4">
                    <div className="flex items-center gap-4 mb-2 text-white">
                      <Heart className="size-6" />
                      <MessageCircle className="size-6" />
                      <Send className="size-6" />
                      <Bookmark className="size-6 ml-auto" />
                    </div>
                    <div className="text-sm text-foreground/80 mt-1 line-clamp-2">
                      <span className="font-semibold text-white mr-1.5">
                        {persona.handle}
                      </span>
                      {persona.posts[0].caption}
                    </div>
                  </div>

                  {/* Mini grid of other shots */}
                  {persona.posts.length > 1 && (
                    <div
                      className={`grid gap-px bg-border ${
                        persona.posts.length === 2 ? "grid-cols-1" : "grid-cols-2"
                      }`}
                    >
                      {persona.posts.slice(1).map((p) => (
                        <div
                          key={p.src}
                          className="relative aspect-square bg-zinc-950"
                        >
                          <Image
                            src={p.src}
                            alt={p.caption}
                            fill
                            sizes="(min-width: 1024px) 12vw, 25vw"
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link href="/sign-up" locale={locale}>
                <Button
                  variant="outline"
                  className="h-11 border-white/10 bg-transparent px-6 text-foreground shadow-none backdrop-blur-none hover:bg-white/5"
                >
                  {t("showcaseSeeMore")}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Before / After — same face, different scenes */}
        <section className="border-y border-white/10 py-24 md:py-32">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
                {t("beforeAfterTitle")}
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {t("beforeAfterSubtitle")}
              </p>
            </div>

            <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <div className="mb-3 text-center font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground md:text-left">
                  {t("beforeAfterLabelBase")}
                </div>
                <div className="relative aspect-[3/4] overflow-hidden rounded-3xl border border-white/10">
                  <Image
                    src="/landing/influencers/luna.jpg"
                    alt="Reference portrait"
                    fill
                    sizes="(min-width: 768px) 40vw, 100vw"
                    className="object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-black px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white">
                    Wizard
                  </div>
                </div>
              </div>

              <div className="hidden items-center justify-center md:flex md:col-span-1">
                <ArrowRight className="size-6 text-muted-foreground" />
              </div>

              <div className="md:col-span-2">
                <div className="mb-3 text-center font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground md:text-left">
                  {t("beforeAfterLabelGenerated")}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    "/landing/showcase/luna-gym.jpg",
                    "/landing/showcase/luna-cafe.jpg",
                    "/landing/showcase/luna-mirror.jpg",
                    "/landing/showcase/amani-restaurant.jpg",
                  ].map((src) => (
                    <div
                      key={src}
                      className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10"
                    >
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 20vw, 50vw"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 md:py-32 relative">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {t("featuresTitle")}
              </h2>
              <p className="text-muted-foreground text-lg">{t("featuresSubtitle")}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-white/10 bg-zinc-950 p-6"
                >
                  <h3 className="mb-3 text-xl font-bold">{feature.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="border-y border-white/10 py-24 md:py-32"
        >
          <div className="container mx-auto px-6">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">
                {t("howItWorksTitle")}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t("howItWorksSubtitle")}
              </p>
            </div>

            <div className="mx-auto max-w-3xl">
              {steps.map((step) => (
                <div
                  key={step.step}
                  className="grid grid-cols-[3rem_1fr] gap-6 border-t border-white/10 py-8"
                >
                  <div className="font-mono text-sm text-muted-foreground">
                    {step.step}
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">{step.title}</h3>
                    <p className="text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section id="pricing" className="py-24 md:py-32">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {t("pricingTitle")}
              </h2>
              <p className="text-muted-foreground text-lg">{t("pricingSubtitle")}</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto mb-12">
              {plansForCards.map((plan, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border bg-zinc-950 p-8 ${
                    plan.featured
                      ? "border-[color:var(--aurora)]"
                      : "border-white/10"
                  }`}
                >
                  {plan.featured && (
                    <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--aurora)]">
                      {t("pricingMostPopular")}
                    </p>
                  )}
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.id !== "FREE" && (
                      <span className="text-muted-foreground">
                        {isFr ? "/mois" : "/mo"}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm mb-6">{plan.desc}</p>

                  <Link href="/sign-up" locale={locale}>
                    <Button
                      variant={plan.featured ? "default" : "outline"}
                      className={`mb-6 w-full shadow-none backdrop-blur-none ${
                        plan.featured
                          ? "bg-foreground text-background hover:bg-foreground/90"
                          : "border-white/10 bg-transparent text-foreground hover:bg-white/5"
                      }`}
                    >
                      {t("pricingStart")}
                    </Button>
                  </Link>

                  <ul className="space-y-3">
                    {plan.features.map((f, j) => (
                      <li
                        key={j}
                        className="flex items-center gap-3 text-sm text-foreground/80"
                      >
                        <CheckCircle2 className="size-4 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Link href="/pricing">
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                >
                  {t("pricingSeeAll")}{" "}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-y border-white/10 py-24 md:py-32">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
                {t("testimonialsTitle")}
              </h2>
              <p className="text-muted-foreground text-lg">
                {t("testimonialsSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[
                {
                  quote: t("testimonial1Quote"),
                  name: t("testimonial1Name"),
                  role: t("testimonial1Role"),
                },
                {
                  quote: t("testimonial2Quote"),
                  name: t("testimonial2Name"),
                  role: t("testimonial2Role"),
                },
                {
                  quote: t("testimonial3Quote"),
                  name: t("testimonial3Name"),
                  role: t("testimonial3Role"),
                },
              ].map((tt) => (
                <div
                  key={tt.name}
                  className="rounded-3xl border border-white/10 bg-zinc-950 p-7"
                >
                  <p className="mb-6 text-[15px] leading-relaxed text-foreground/90">
                    {tt.quote}
                  </p>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground">{tt.name}</div>
                    <div className="text-xs text-muted-foreground">{tt.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24">
          <div className="container mx-auto px-6">
            <div className="rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center md:p-16">
              <div className="mx-auto max-w-2xl">
                <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
                  {t("ctaFinalTitle")}
                </h2>
                <p className="text-muted-foreground text-lg mb-10">
                  {t("ctaFinalSubtitle")}
                </p>

                <Link href="/sign-up" locale={locale}>
                  <Button
                    size="lg"
                    className="h-14 bg-foreground px-8 text-base text-background shadow-none transition-colors hover:bg-foreground/90"
                  >
                    {t("ctaFinalButton")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-background py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-foreground">Aura Influences</span>
            </div>

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Link
                href="/changelog"
                locale={locale}
                className="hover:text-foreground transition-colors"
              >
                {t("navChangelog")}
              </Link>
              <Link
                href="/pricing"
                locale={locale}
                className="hover:text-foreground transition-colors"
              >
                {t("navPricing")}
              </Link>
              <Link
                href="/privacy"
                locale={locale}
                className="hover:text-foreground transition-colors"
              >
                {t("footerPrivacy")}
              </Link>
              <Link
                href="/terms"
                locale={locale}
                className="hover:text-foreground transition-colors"
              >
                {t("footerTerms")}
              </Link>
              <Link
                href="/mentions"
                locale={locale}
                className="hover:text-foreground transition-colors"
              >
                {t("footerMentions")}
              </Link>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="hover:text-foreground transition-colors"
              >
                {t("footerSupport")}
              </a>
            </div>

            <p className="text-sm text-muted-foreground/70">
              © {new Date().getFullYear()} {PRODUCT_NAME}. {t("footerRights")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
