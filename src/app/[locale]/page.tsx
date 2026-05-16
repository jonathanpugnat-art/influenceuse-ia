"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/constants";
import {
  Sparkles,
  Layers,
  Video,
  BarChart3,
  CheckCircle2,
  Play,
  ArrowRight,
  Menu,
  X,
  Wand2,
  Users,
  Image as ImageIcon,
  CalendarDays,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Camera,
  Quote,
  Zap,
  Globe,
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = useTranslations("landing");
  const locale = useLocale();
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const features = [
    {
      icon: ImageIcon,
      title: t("feature1Title"),
      desc: t("feature1Desc"),
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      icon: Layers,
      title: t("feature2Title"),
      desc: t("feature2Desc"),
      color: "text-violet-400",
      bg: "bg-violet-400/10",
    },
    {
      icon: Video,
      title: t("feature3Title"),
      desc: t("feature3Desc"),
      color: "text-indigo-400",
      bg: "bg-indigo-400/10",
    },
    {
      icon: BarChart3,
      title: t("feature4Title"),
      desc: t("feature4Desc"),
      color: "text-fuchsia-400",
      bg: "bg-fuchsia-400/10",
    },
  ];

  const steps = [
    { step: "01", title: t("step1Title"), desc: t("step1Desc"), icon: Users },
    { step: "02", title: t("step2Title"), desc: t("step2Desc"), icon: Wand2 },
    { step: "03", title: t("step3Title"), desc: t("step3Desc"), icon: CalendarDays },
    { step: "04", title: t("step4Title"), desc: t("step4Desc"), icon: BarChart3 },
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
  ];

  const otherLocale = locale === "fr" ? "en" : "fr";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 selection:bg-violet-500/30">
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800"
            : "bg-transparent"
        }`}
      >
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="size-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              Influenceuse IA
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">
              {t("navFeatures")}
            </a>
            <a
              href="#how-it-works"
              className="hover:text-white transition-colors"
            >
              {t("navHowItWorks")}
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              {t("navPricing")}
            </a>
            <Link
              href="/changelog"
              className="hover:text-white transition-colors"
            >
              {t("navChangelog")}
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            {/* Locale switcher — preserves the current path on toggle. */}
            <Link
              href={pathname}
              locale={otherLocale}
              className="text-xs uppercase tracking-wider font-semibold text-zinc-500 hover:text-white transition-colors"
              aria-label={`Switch to ${otherLocale.toUpperCase()}`}
            >
              {otherLocale.toUpperCase()}
            </Link>
            <Link href="/sign-in">
              <Button
                variant="ghost"
                className="text-zinc-300 hover:text-white hover:bg-zinc-800"
              >
                {t("signIn")}
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white border-0">
                {t("tryFree")}
              </Button>
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden text-zinc-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="size-6" />
            ) : (
              <Menu className="size-6" />
            )}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden fixed inset-x-0 top-16 z-40 bg-zinc-950 border-b border-zinc-800 px-6 py-4 overflow-hidden"
          >
            <div className="flex flex-col gap-4 text-sm font-medium">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="text-zinc-300 py-2 border-b border-zinc-800/50"
              >
                {t("navFeatures")}
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="text-zinc-300 py-2 border-b border-zinc-800/50"
              >
                {t("navHowItWorks")}
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="text-zinc-300 py-2 border-b border-zinc-800/50"
              >
                {t("navPricing")}
              </a>
              <Link
                href="/changelog"
                onClick={() => setMobileMenuOpen(false)}
                className="text-zinc-300 py-2 border-b border-zinc-800/50"
              >
                {t("navChangelog")}
              </Link>
              <Link
                href={pathname}
                locale={otherLocale}
                onClick={() => setMobileMenuOpen(false)}
                className="text-zinc-300 py-2 border-b border-zinc-800/50 uppercase text-xs tracking-wider"
              >
                {otherLocale.toUpperCase()}
              </Link>
              <div className="flex flex-col gap-2 pt-4">
                <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="outline"
                    className="w-full border-zinc-700 bg-transparent text-white"
                  >
                    {t("signIn")}
                  </Button>
                </Link>
                <Link href="/sign-up" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 text-white border-0">
                    {t("tryFree")}
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {/* Hero */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-zinc-950 to-zinc-950 -z-10" />

          <div className="container mx-auto px-6 relative">
            <div className="max-w-4xl mx-auto text-center">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeIn}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium mb-6"
              >
                <Sparkles className="size-4" />
                <span>{t("heroBadge")}</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]"
              >
                {t("heroTitlePart1")}{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
                  {t("heroTitleHighlight")}
                </span>
                {t("heroTitlePart2")}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed"
              >
                {t("heroSubtitle")}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-14 px-8 text-base bg-white text-zinc-950 hover:bg-zinc-200 transition-colors"
                  >
                    {t("ctaPrimary")} <ArrowRight className="ml-2 size-4" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto h-14 px-8 text-base border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-white"
                >
                  <Play className="mr-2 size-4" /> {t("ctaWatchDemo")}
                </Button>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-16 md:mt-20 relative mx-auto max-w-6xl"
            >
              {/* "100% AI" trust badge above the photo wall */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                  <Camera className="size-3.5" />
                  <span>{t("heroPhotoBadge")}</span>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-3 md:p-4 backdrop-blur-sm overflow-hidden relative shadow-[0_30px_80px_-20px_rgba(139,92,246,0.35)]">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  {[
                    { src: "/landing/showcase/luna-gym.jpg", caption: t("showcaseCaptionGym"), likes: "12.4K" },
                    { src: "/landing/showcase/amani-restaurant.jpg", caption: t("showcaseCaptionRestaurant"), likes: "8.7K" },
                    { src: "/landing/showcase/kenji-tokyo.jpg", caption: t("showcaseCaptionTokyo"), likes: "15.2K" },
                    { src: "/landing/showcase/marco-nyc.jpg", caption: t("showcaseCaptionNyc"), likes: "21.8K" },
                  ].map((shot, i) => (
                    <motion.div
                      key={shot.src}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.5 + i * 0.08 }}
                      className="relative rounded-2xl overflow-hidden aspect-[3/4] group bg-zinc-800"
                    >
                      <Image
                        src={shot.src}
                        alt={shot.caption}
                        fill
                        sizes="(min-width: 768px) 25vw, 50vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        priority={i < 2}
                      />
                      {/* IG-style overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 md:p-4">
                        <div className="flex items-center justify-between text-white text-xs md:text-sm">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <Heart className="size-3.5 md:size-4 fill-rose-500 text-rose-500" />
                            {shot.likes}
                          </div>
                          <span className="text-white/80 truncate ml-2">
                            {shot.caption}
                          </span>
                        </div>
                      </div>
                      <div className="absolute top-3 right-3 size-7 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                        <Sparkles className="size-3.5 text-violet-300" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats strip + social proof */}
        <section className="py-12 border-y border-zinc-800/50 bg-zinc-900/20">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 mb-10 max-w-5xl mx-auto">
              {[
                { value: "1.2M+", label: t("statsPhotosGenerated"), icon: ImageIcon },
                { value: "21s", label: t("statsAvgGenTime"), icon: Zap },
                { value: "32", label: t("statsCountries"), icon: Globe },
                { value: "45+", label: t("statsActiveAgencies"), icon: Users },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="flex justify-center mb-2">
                    <stat.icon className="size-5 text-violet-400" />
                  </div>
                  <div className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                    {stat.value}
                  </div>
                  <div className="text-xs md:text-sm text-zinc-500 mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-zinc-500 font-medium mb-5 uppercase tracking-wider">
              {t("socialProofTitle")}
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-14 opacity-40 grayscale">
              <div className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="size-4" /> Stripe
              </div>
              <div className="text-lg font-bold flex items-center gap-2">
                <Layers className="size-4" /> Clerk
              </div>
              <div className="text-lg font-bold flex items-center gap-2">
                <Wand2 className="size-4" /> Anthropic
              </div>
              <div className="text-lg font-bold flex items-center gap-2">
                <ImageIcon className="size-4" /> Replicate
              </div>
            </div>
          </div>
        </section>

        {/* Showcase — 4 personas with Instagram-style cards */}
        <section className="py-24 md:py-32 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] bg-violet-600/10 blur-[120px] rounded-full -z-10" />
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-4">
                <Sparkles className="size-3.5" />
                <span>{t("heroPhotoBadge")}</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
                {t("showcaseTitle")}
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed">
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
                    { src: "/landing/showcase/amani-shopping.jpg", caption: "Shopping day 🛍️", likes: "9.1K", comments: "187" },
                  ],
                },
                {
                  name: t("showcaseKenji"),
                  handle: "@kenji.tokyo",
                  avatar: "/landing/influencers/kenji.jpg",
                  posts: [
                    { src: "/landing/showcase/kenji-tokyo.jpg", caption: t("showcaseCaptionTokyo"), likes: "18.6K", comments: "402" },
                    { src: "/landing/showcase/kenji-street1.jpg", caption: "Daylight fit 🇯🇵", likes: "11.2K", comments: "231" },
                    { src: "/landing/showcase/kenji-shop.jpg", caption: "Vintage finds", likes: "7.4K", comments: "98" },
                  ],
                },
                {
                  name: t("showcaseMarco"),
                  handle: "@marco.travels",
                  avatar: "/landing/influencers/marco.jpg",
                  posts: [
                    { src: "/landing/showcase/marco-nyc.jpg", caption: t("showcaseCaptionNyc"), likes: "24.1K", comments: "612" },
                    { src: "/landing/showcase/marco-cafe.jpg", caption: "Espresso run ☕", likes: "9.8K", comments: "204" },
                    { src: "/landing/showcase/marco-park.jpg", caption: "Park days 🌳", likes: "13.5K", comments: "318" },
                  ],
                },
              ].map((persona, idx) => (
                <motion.article
                  key={persona.handle}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="rounded-3xl bg-zinc-900/60 border border-zinc-800 overflow-hidden hover:border-violet-500/40 transition-colors duration-300 group"
                >
                  {/* Profile header */}
                  <div className="p-4 flex items-center gap-3 border-b border-zinc-800/60">
                    <div className="relative size-11 rounded-full overflow-hidden ring-2 ring-violet-500/40 shrink-0">
                      <Image
                        src={persona.avatar}
                        alt={persona.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate flex items-center gap-1">
                        {persona.handle}
                        <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-violet-500">
                          <CheckCircle2 className="size-2.5 text-white" />
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 truncate">
                        {persona.name}
                      </div>
                    </div>
                  </div>

                  {/* Main post */}
                  <div className="relative aspect-[4/5] bg-zinc-800">
                    <Image
                      src={persona.posts[0].src}
                      alt={persona.posts[0].caption}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover group-hover:scale-[1.02] transition-transform duration-700"
                    />
                  </div>

                  {/* IG-style actions */}
                  <div className="p-4">
                    <div className="flex items-center gap-4 mb-2 text-white">
                      <Heart className="size-6 hover:text-rose-500 transition-colors cursor-pointer" />
                      <MessageCircle className="size-6 cursor-pointer" />
                      <Send className="size-6 cursor-pointer" />
                      <Bookmark className="size-6 ml-auto cursor-pointer" />
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {persona.posts[0].likes} likes
                    </div>
                    <div className="text-sm text-zinc-300 mt-1 line-clamp-2">
                      <span className="font-semibold text-white mr-1.5">
                        {persona.handle}
                      </span>
                      {persona.posts[0].caption}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {persona.posts[0].comments} comments
                    </div>
                  </div>

                  {/* Mini grid of other shots */}
                  {persona.posts.length > 1 && (
                    <div
                      className={`grid gap-px bg-zinc-800 ${
                        persona.posts.length === 2 ? "grid-cols-1" : "grid-cols-2"
                      }`}
                    >
                      {persona.posts.slice(1).map((p) => (
                        <div
                          key={p.src}
                          className="relative aspect-square bg-zinc-900"
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
                </motion.article>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link href="/sign-up">
                <Button
                  variant="outline"
                  className="border-zinc-700 bg-zinc-900/50 text-white hover:bg-zinc-800 h-11 px-6"
                >
                  {t("showcaseSeeMore")}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Before / After — same face, different scenes */}
        <section className="py-24 md:py-32 bg-zinc-900/30 border-y border-zinc-800/50">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
                {t("beforeAfterTitle")}
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed">
                {t("beforeAfterSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 max-w-6xl mx-auto items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="md:col-span-2"
              >
                <div className="text-xs uppercase tracking-wider text-violet-400 font-semibold mb-3 text-center md:text-left">
                  {t("beforeAfterLabelBase")}
                </div>
                <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl shadow-violet-900/30">
                  <Image
                    src="/landing/influencers/luna.jpg"
                    alt="Reference portrait"
                    fill
                    sizes="(min-width: 768px) 40vw, 100vw"
                    className="object-cover"
                  />
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider">
                    Wizard
                  </div>
                </div>
              </motion.div>

              <div className="hidden md:flex justify-center items-center md:col-span-1">
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="size-16 rounded-full bg-violet-500/20 border border-violet-500/50 flex items-center justify-center"
                >
                  <ArrowRight className="size-7 text-violet-300" />
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="md:col-span-2"
              >
                <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-3 text-center md:text-left">
                  {t("beforeAfterLabelGenerated")}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    "/landing/showcase/luna-gym.jpg",
                    "/landing/showcase/luna-cafe.jpg",
                    "/landing/showcase/luna-mirror.jpg",
                    "/landing/showcase/amani-restaurant.jpg",
                  ].map((src, i) => (
                    <motion.div
                      key={src}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.4 + i * 0.08 }}
                      className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-zinc-800"
                    >
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 20vw, 50vw"
                        className="object-cover"
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
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
              <p className="text-zinc-400 text-lg">{t("featuresSubtitle")}</p>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  variants={fadeIn}
                  className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors group"
                >
                  <div
                    className={`size-12 rounded-xl ${feature.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
                  >
                    <feature.icon className={`size-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="py-24 md:py-32 bg-zinc-900/30 border-y border-zinc-800/50"
        >
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {t("howItWorksTitle")}
              </h2>
              <p className="text-zinc-400 text-lg">
                {t("howItWorksSubtitle")}
              </p>
            </div>

            <div className="max-w-4xl mx-auto relative">
              <div className="absolute left-[27px] md:left-1/2 top-4 bottom-4 w-px bg-zinc-800 md:-translate-x-1/2" />

              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: i * 0.1 }}
                  className={`relative flex flex-col md:flex-row gap-8 items-start md:items-center mb-12 last:mb-0 ${
                    i % 2 !== 0 ? "md:flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`md:w-1/2 flex flex-col ${
                      i % 2 !== 0
                        ? "md:items-start"
                        : "md:items-end md:text-right"
                    } pl-16 md:pl-0`}
                  >
                    <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                    <p className="text-zinc-400">{step.desc}</p>
                  </div>

                  <div className="absolute left-0 md:static md:w-14 flex justify-center shrink-0 z-10">
                    <div className="size-14 rounded-full bg-zinc-950 border-4 border-zinc-900 flex items-center justify-center text-sm font-bold text-violet-400">
                      {step.step}
                    </div>
                  </div>

                  <div
                    className={`md:w-1/2 hidden md:flex ${
                      i % 2 !== 0 ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div className="size-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <step.icon className="size-10 text-zinc-600" />
                    </div>
                  </div>
                </motion.div>
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
              <p className="text-zinc-400 text-lg">{t("pricingSubtitle")}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
              {plansForCards.map((plan, i) => (
                <div
                  key={i}
                  className={`rounded-2xl p-8 border ${
                    plan.featured
                      ? "border-violet-500/50 bg-violet-500/5 relative"
                      : "border-zinc-800 bg-zinc-900/50"
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-violet-500 text-white text-xs font-bold rounded-full">
                      {t("pricingMostPopular")}
                    </div>
                  )}
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.id !== "FREE" && (
                      <span className="text-zinc-400">
                        {isFr ? "/mois" : "/mo"}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-400 text-sm mb-6">{plan.desc}</p>

                  <Link href="/sign-up">
                    <Button
                      variant={plan.featured ? "default" : "outline"}
                      className={`w-full mb-6 ${
                        plan.featured
                          ? "bg-violet-600 hover:bg-violet-700 text-white"
                          : "border-zinc-700 text-white hover:bg-zinc-800"
                      }`}
                    >
                      {t("pricingStart")}
                    </Button>
                  </Link>

                  <ul className="space-y-3">
                    {plan.features.map((f, j) => (
                      <li
                        key={j}
                        className="flex items-center gap-3 text-sm text-zinc-300"
                      >
                        <CheckCircle2 className="size-4 text-violet-500 shrink-0" />
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
                  className="text-zinc-400 hover:text-white"
                >
                  {t("pricingSeeAll")}{" "}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 md:py-32 bg-zinc-900/30 border-y border-zinc-800/50">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
                {t("testimonialsTitle")}
              </h2>
              <p className="text-zinc-400 text-lg">
                {t("testimonialsSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[
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
              ].map((tt, i) => (
                <motion.div
                  key={tt.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="p-7 rounded-3xl bg-zinc-900/70 border border-zinc-800 hover:border-violet-500/40 transition-colors relative"
                >
                  <Quote className="absolute top-5 right-5 size-7 text-violet-500/30" />
                  <p className="text-zinc-200 leading-relaxed mb-6 text-[15px]">
                    &ldquo;{tt.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="relative size-11 rounded-full overflow-hidden ring-2 ring-violet-500/30 shrink-0">
                      <Image
                        src={tt.avatar}
                        alt={tt.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white">{tt.name}</div>
                      <div className="text-xs text-zinc-500">{tt.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24">
          <div className="container mx-auto px-6">
            <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-900 p-8 md:p-16 text-center relative overflow-hidden border border-violet-500/30">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />

              {/* Floating face thumbnails */}
              <div className="absolute -top-8 -left-8 size-24 md:size-32 rounded-3xl overflow-hidden border border-white/20 rotate-[-8deg] opacity-80 hidden md:block">
                <Image
                  src="/landing/influencers/luna.jpg"
                  alt=""
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 size-24 md:size-36 rounded-3xl overflow-hidden border border-white/20 rotate-[10deg] opacity-80 hidden md:block">
                <Image
                  src="/landing/influencers/kenji.jpg"
                  alt=""
                  fill
                  sizes="144px"
                  className="object-cover"
                />
              </div>

              <div className="relative z-10 max-w-2xl mx-auto">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                  {t("ctaFinalTitle")}
                </h2>
                <p className="text-violet-200 text-lg mb-10">
                  {t("ctaFinalSubtitle")}
                </p>

                <Link href="/sign-up">
                  <Button
                    size="lg"
                    className="h-14 px-8 text-base bg-white text-indigo-950 hover:bg-zinc-100 transition-colors"
                  >
                    {t("ctaFinalButton")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-zinc-950 border-t border-zinc-800/50 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded bg-violet-600 flex items-center justify-center">
                <Sparkles className="size-3 text-white" />
              </div>
              <span className="font-bold text-zinc-100">Influenceuse IA</span>
            </div>

            <div className="flex gap-6 text-sm text-zinc-500">
              <Link
                href="/changelog"
                className="hover:text-white transition-colors"
              >
                {t("navChangelog")}
              </Link>
              <Link
                href="/pricing"
                className="hover:text-white transition-colors"
              >
                {t("navPricing")}
              </Link>
              <a
                href="mailto:hello@influenceuse-ia.com"
                className="hover:text-white transition-colors"
              >
                {t("footerSupport")}
              </a>
            </div>

            <p className="text-sm text-zinc-600">
              © {new Date().getFullYear()} Influenceuse IA. {t("footerRights")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
