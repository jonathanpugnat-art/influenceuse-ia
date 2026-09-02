"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/constants";
import { DotPattern } from "@/components/preview/magic-ui-lite/dot-pattern";
import { BorderBeam } from "@/components/preview/magic-ui-lite/border-beam";
import { AnimatedShinyText } from "@/components/preview/magic-ui-lite/animated-shiny-text";
import { Marquee } from "@/components/preview/magic-ui-lite/marquee";
import { Particles } from "@/components/preview/magic-ui-lite/particles";
import {
  Sparkles,
  ArrowRight,
  Play,
  Heart,
  Camera,
  ImageIcon,
  Video,
  Layers,
  BarChart3,
  Zap,
  Globe,
  Users,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "current" | "premium";

export function LandingPremiumPreview() {
  const [view, setView] = useState<ViewMode>("premium");
  const t = useTranslations("landing");
  const locale = useLocale();
  const isFr = locale === "fr";

  const showcase = [
    { src: "/landing/showcase/luna-gym.jpg", caption: t("showcaseCaptionGym"), likes: "12.4K" },
    { src: "/landing/showcase/amani-restaurant.jpg", caption: t("showcaseCaptionRestaurant"), likes: "8.7K" },
    { src: "/landing/showcase/kenji-tokyo.jpg", caption: t("showcaseCaptionTokyo"), likes: "15.2K" },
    { src: "/landing/showcase/marco-nyc.jpg", caption: t("showcaseCaptionNyc"), likes: "21.8K" },
  ];

  const stats = [
    { value: "1.2M+", label: t("statsPhotosGenerated") },
    { value: "21s", label: t("statsAvgGenTime") },
    { value: "32", label: t("statsCountries") },
    { value: "45+", label: t("statsActiveAgencies") },
  ];

  const marqueeItems = [
    "Photos IA",
    "Reels TikTok",
    "LoRA visage",
    "Planning auto",
    "Analytics",
    "Multi-modèles",
    "Batch gen",
    "Trends IA",
  ];

  const plans = [
    {
      name: PLANS.FREE.name,
      price: "0€",
      featured: false,
      features: [`${PLANS.FREE.credits} crédits`, `${PLANS.FREE.maxInfluencers} influenceuse`],
    },
    {
      name: PLANS.STARTER.name,
      price: `${PLANS.STARTER.price}€`,
      featured: true,
      features: [
        `${PLANS.STARTER.credits} crédits / mois`,
        `${PLANS.STARTER.maxInfluencers} influenceuses`,
        isFr ? "Plan éditorial IA" : "AI editorial plan",
      ],
    },
    {
      name: PLANS.PRO.name,
      price: `${PLANS.PRO.price}€`,
      featured: false,
      features: [
        `${PLANS.PRO.credits} crédits / mois`,
        `${PLANS.PRO.maxInfluencers} influenceuses`,
        isFr ? "Génération vidéo" : "Video generation",
      ],
    },
  ];

  const isPremium = view === "premium";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Preview chrome */}
      <div className="fixed inset-x-0 top-0 z-[100] border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/home"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              {isFr ? "Landing actuelle" : "Current landing"}
            </Link>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              {isFr ? "Aperçu visuel — non intégré" : "Visual preview — not integrated"}
            </span>
          </div>

          <div className="flex rounded-full border border-border/60 bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setView("current")}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                view === "current"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isFr ? "Actuel" : "Current"}
            </button>
            <button
              type="button"
              onClick={() => setView("premium")}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                view === "premium"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Premium ++ (Magic UI)
            </button>
          </div>
        </div>
      </div>

      <div className="pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-24">
          {isPremium ? (
            <>
              <DotPattern className="text-foreground/[0.07]" />
              <Particles quantity={50} />
              <div className="pointer-events-none absolute inset-0 app-mesh opacity-60" />
              <div className="pointer-events-none absolute left-1/2 top-1/4 h-[600px] w-[800px] -translate-x-1/2 glow-lavender opacity-90" />
            </>
          ) : (
            <div className="pointer-events-none absolute inset-0 app-mesh" />
          )}

          <div className="container relative mx-auto px-6">
            <div className="mx-auto max-w-4xl text-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium backdrop-blur-sm",
                  isPremium
                    ? "border border-violet-500/30 bg-violet-500/10 text-violet-200"
                    : "border border-border/50 bg-card/50 text-muted-foreground",
                )}
              >
                <Sparkles className="size-4" />
                <span>{t("heroBadge")}</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mb-6 text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl"
              >
                {t("heroTitlePart1")}{" "}
                {isPremium ? (
                  <AnimatedShinyText>{t("heroTitleHighlight")}</AnimatedShinyText>
                ) : (
                  <span className="text-gradient-pastel">{t("heroTitleHighlight")}</span>
                )}
                {t("heroTitlePart2")}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl"
              >
                {t("heroSubtitle")}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex flex-col items-center justify-center gap-4 sm:flex-row"
              >
                <Button
                  size="lg"
                  className={cn(
                    "h-14 px-8",
                    isPremium && "relative overflow-hidden shadow-[0_0_40px_oklch(0.72_0.12_290/25%)]",
                  )}
                >
                  {t("ctaPrimary")} <ArrowRight className="ml-2 size-4" />
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="h-14 px-8"
                  onClick={() => {
                    document
                      .getElementById("showcase")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <Play className="mr-2 size-4" /> {t("ctaWatchDemo")}
                </Button>
              </motion.div>
            </div>

            {/* Showcase */}
            <motion.div
              id="showcase"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="relative mx-auto mt-14 max-w-5xl md:mt-20"
            >
              <div className="mb-5 flex justify-center">
                <div
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
                    isPremium
                      ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 shadow-[0_0_24px_oklch(0.7_0.16_160/20%)]"
                      : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                  )}
                >
                  <Camera className="size-3.5" />
                  <span>{t("heroPhotoBadge")}</span>
                </div>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-3xl border p-3 md:p-4",
                  isPremium
                    ? "border-border/40 bg-card/30 shadow-2xl shadow-violet-500/10 backdrop-blur-md"
                    : "border-border/50 bg-card/40 shadow-2xl shadow-black/50 backdrop-blur-sm",
                )}
              >
                {isPremium && <BorderBeam size={250} duration={10} borderWidth={2} />}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                  {showcase.map((shot, i) => (
                    <div
                      key={shot.src}
                      className={cn(
                        "group relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted",
                        isPremium && "ring-1 ring-white/5 transition-transform duration-500 hover:scale-[1.02]",
                      )}
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <Image
                        src={shot.src}
                        alt={shot.caption}
                        fill
                        sizes="(min-width: 768px) 25vw, 50vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3">
                        <div className="flex items-center justify-between text-xs text-white md:text-sm">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <Heart className="size-3.5 fill-rose-500 text-rose-500" />
                            {shot.likes}
                          </div>
                          <span className="ml-2 truncate text-white/80">{shot.caption}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats / Marquee */}
        <section className="border-y border-border/60 bg-card/20 py-10">
          {isPremium ? (
            <Marquee className="mb-8 [--duration:35s]">
              {marqueeItems.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-2 rounded-full border border-border/40 bg-card/50 px-5 py-2 text-sm text-muted-foreground backdrop-blur-sm"
                >
                  <Sparkles className="size-3.5 text-violet-400" />
                  {item}
                </span>
              ))}
            </Marquee>
          ) : null}

          <div className="container mx-auto grid max-w-4xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div
                  className={cn(
                    "text-2xl font-bold md:text-3xl",
                    isPremium ? "text-gradient-pastel" : "text-foreground",
                  )}
                >
                  {stat.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground md:text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features bento */}
        <section className="py-20 md:py-28">
          <div className="container mx-auto px-6">
            <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">
              {isPremium ? (
                <>
                  {isFr ? "Tout ce qu'il faut pour " : "Everything to "}
                  <AnimatedShinyText>{isFr ? "dominer" : "dominate"}</AnimatedShinyText>
                </>
              ) : (
                t("featuresTitle")
              )}
            </h2>

            <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
              {[
                { icon: ImageIcon, title: t("feature1Title"), desc: t("feature1Desc") },
                { icon: Layers, title: t("feature2Title"), desc: t("feature2Desc") },
                { icon: Video, title: t("feature3Title"), desc: t("feature3Desc") },
                { icon: BarChart3, title: t("feature4Title"), desc: t("feature4Desc") },
              ].map((f, i) => (
                <div
                  key={f.title}
                  className={cn(
                    "rounded-2xl border p-6 transition-all duration-300",
                    isPremium
                      ? "border-border/40 bg-gradient-to-br from-card/80 to-card/30 backdrop-blur-sm hover:border-violet-500/30 hover:shadow-[0_0_40px_oklch(0.72_0.12_290/12%)]"
                      : "border-border/50 bg-card/50",
                  )}
                >
                  <div
                    className={cn(
                      "mb-4 flex size-11 items-center justify-center rounded-xl",
                      isPremium ? "bg-violet-500/15 text-violet-300" : "bg-muted text-foreground",
                    )}
                  >
                    <f.icon className="size-5" />
                  </div>
                  <h3 className="mb-2 font-semibold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                  {isPremium && i === 0 && (
                    <div className="mt-4 flex gap-2">
                      {[Zap, Globe, Users].map((Icon, j) => (
                        <div
                          key={j}
                          className="flex size-8 items-center justify-center rounded-lg border border-border/40 bg-background/50"
                        >
                          <Icon className="size-3.5 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing preview */}
        <section className="border-t border-border/60 bg-card/10 py-20">
          <div className="container mx-auto px-6">
            <h2 className="mb-12 text-center text-3xl font-bold">{t("pricingTitle")}</h2>
            <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={cn(
                    "relative rounded-2xl border p-6",
                    plan.featured
                      ? isPremium
                        ? "border-violet-500/40 bg-gradient-to-b from-violet-500/10 to-card/40 shadow-[0_0_48px_oklch(0.72_0.12_290/18%)]"
                        : "border-foreground/30 bg-card/60"
                      : "border-border/50 bg-card/30",
                  )}
                >
                  {isPremium && plan.featured && (
                    <BorderBeam size={180} duration={8} borderWidth={2} />
                  )}
                  {plan.featured && (
                    <span className="mb-4 inline-block rounded-full bg-foreground px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">
                      {isFr ? "Populaire" : "Popular"}
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <div className="my-3 text-3xl font-bold">{plan.price}</div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={cn("mt-6 w-full", plan.featured && isPremium && "shadow-lg")}
                    variant={plan.featured ? "default" : "outline"}
                  >
                    {t("tryFree")}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA footer preview */}
        <section className="py-16">
          <div className="container mx-auto px-6">
            <div
              className={cn(
                "relative mx-auto max-w-3xl overflow-hidden rounded-3xl border px-8 py-14 text-center",
                isPremium
                  ? "border-border/40 bg-gradient-to-br from-violet-500/10 via-card/40 to-amber-500/5"
                  : "border-border/50 bg-card/40",
              )}
            >
              {isPremium && <BorderBeam size={300} duration={14} />}
              <h2 className="mb-4 text-2xl font-bold md:text-3xl">
                {isFr ? "Prêt à lancer votre influenceuse IA ?" : "Ready to launch your AI influencer?"}
              </h2>
              <p className="mb-8 text-muted-foreground">
                {isFr
                  ? "Rejoignez les agences qui automatisent leur contenu premium."
                  : "Join agencies automating premium content."}
              </p>
              <Button size="lg" className="h-12 px-8">
                {t("ctaPrimary")} <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
