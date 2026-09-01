import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PLANS } from "@/lib/constants";
import { WordMark } from "@/components/marketing/word-mark";

export const metadata: Metadata = {
  title: "Tarifs — Aura Influences",
  description:
    "Tarifs simples et transparents pour Aura Influences. Free, Creator, Pro et Agency — choisissez le plan qui correspond à votre volume de génération.",
};

/**
 * Public pricing page.
 *
 * Driven directly by `PLANS` in `src/lib/constants.ts` so any pricing change
 * in the source of truth (credits, max influencers, feature flags) is
 * reflected here without manual sync. Visual language matches the new
 * marketing home so the transition between the two feels continuous.
 */
export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  const tLanding = await getTranslations({ locale, namespace: "landing" });

  type DisplayPlan = {
    /** Stable id for the React key. */
    id: keyof typeof PLANS;
    name: string;
    price: number;
    description: string;
    /** Renders highlight ribbon + accent border. */
    featured?: boolean;
    /** When true the CTA goes to a contact mailto: instead of sign-up. */
    enterprise?: boolean;
    features: string[];
  };

  const fmtCredits = (n: number): string => {
    if (!Number.isFinite(n)) return t("featCreditsUnlimited");
    return t("featCredits", { count: n });
  };
  const fmtInfluencers = (n: number): string => {
    if (!Number.isFinite(n)) return t("featInfluencersUnlimited");
    return t("featInfluencers", { count: n });
  };

  const plans: DisplayPlan[] = [
    {
      id: "FREE",
      name: PLANS.FREE.name,
      price: PLANS.FREE.price,
      description: t("freeDesc"),
      features: [
        fmtInfluencers(PLANS.FREE.maxInfluencers),
        fmtCredits(PLANS.FREE.credits),
        t("featPhotos"),
        t("featTemplates"),
      ],
    },
    {
      id: "STARTER",
      name: PLANS.STARTER.name,
      price: PLANS.STARTER.price,
      description: t("creatorDesc"),
      features: [
        fmtInfluencers(PLANS.STARTER.maxInfluencers),
        fmtCredits(PLANS.STARTER.credits),
        t("featPhotos"),
        t("featAutoPublish"),
        t("featContentPlan"),
        t("featTemplates"),
      ],
    },
    {
      id: "PRO",
      name: PLANS.PRO.name,
      price: PLANS.PRO.price,
      description: t("proDesc"),
      featured: true,
      features: [
        fmtInfluencers(PLANS.PRO.maxInfluencers),
        fmtCredits(PLANS.PRO.credits),
        t("featPhotos"),
        t("featVideos"),
        t("featAutoPublish"),
        t("featBatch"),
        t("featContentPlan"),
        t("featWebhooks"),
      ],
    },
    {
      id: "ENTERPRISE",
      name: PLANS.ENTERPRISE.name,
      price: PLANS.ENTERPRISE.price,
      description: t("agencyDesc"),
      enterprise: true,
      features: [
        t("featInfluencersUnlimited"),
        t("featCreditsUnlimited"),
        t("featVideos"),
        t("featBatch"),
        t("featAnalytics"),
        t("featWebhooks"),
        t("featSupport"),
      ],
    },
  ];

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-aurora-deep/40">
      <header className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 md:px-8">
        <Link href="/home" className="flex items-center gap-2">
          <WordMark />
        </Link>
        <Link
          href="/home"
          className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" /> {tLanding("navFeatures")}
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-white/45">
            <span className="size-1 rounded-full bg-aurora" />
            {tLanding("pricingEyebrow")}
          </span>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.02em] md:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-white/55">{t("subtitle")}</p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-white/40">
            {tLanding("pricingCreditNote")}
          </p>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const priceLabel =
              plan.price === 0 ? t("free") : `${plan.price}€`;
            const ctaHref = plan.enterprise
              ? "mailto:hello@aurainfluenceai.com"
              : "/sign-up";
            const ctaLabel = plan.enterprise
              ? t("ctaContact")
              : plan.id === "FREE"
                ? t("ctaStart")
                : t("ctaSubscribe");

            return (
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
                    {t("mostPopular")}
                  </span>
                )}

                <h2 className="text-sm font-semibold text-white">
                  {plan.name}
                </h2>
                <p className="mt-1 min-h-[2.5rem] text-[12px] text-white/50">
                  {plan.description}
                </p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-white">
                    {priceLabel}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-[12px] text-white/45">
                      {t("perMonth")}
                    </span>
                  )}
                </div>

                {plan.enterprise ? (
                  <a
                    href={ctaHref}
                    className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-full border border-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/[0.06]"
                  >
                    {ctaLabel}
                  </a>
                ) : (
                  <Link href={ctaHref}>
                    <span
                      className={`mt-6 inline-flex h-10 w-full items-center justify-center rounded-full px-4 text-sm font-medium transition-colors ${
                        plan.featured
                          ? "bg-white text-black hover:bg-white/90"
                          : "border border-white/10 text-white hover:bg-white/[0.06]"
                      }`}
                    >
                      {ctaLabel}
                    </span>
                  </Link>
                )}

                <ul className="mt-6 space-y-2 text-[13px] text-white/70">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-white/40" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mt-12 text-center text-sm text-white/45">
          {tLanding("pricingCreditPacksHint")}{" "}
          <Link
            href="/sign-up"
            className="text-aurora underline-offset-4 hover:underline"
          >
            {tLanding("pricingCreditPacksCta")}
          </Link>
        </p>
      </main>
    </div>
  );
}
