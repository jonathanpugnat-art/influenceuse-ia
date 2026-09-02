import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CREDIT_PACK_CATALOG, PLANS } from "@/lib/constants";
import { PRODUCT_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: `Tarifs — ${PRODUCT_NAME}`,
  description:
    `Tarifs simples et transparents pour ${PRODUCT_NAME}. Free, Creator, Pro et Agency — choisissez le plan qui correspond à votre volume de génération.`,
};

/**
 * Public pricing page.
 *
 * Driven directly by `PLANS` in `src/lib/constants.ts` so that any pricing
 * change in the source of truth (credits, max influencers, feature flags)
 * is reflected here without manual sync. The Stripe price IDs are only
 * needed inside the authenticated `/billing` flow — this page is purely
 * informational.
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
    /** Renders highlight ribbon + violet accent. */
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
      featured: true,
      features: [
        fmtInfluencers(PLANS.STARTER.maxInfluencers),
        fmtCredits(PLANS.STARTER.credits),
        t("featPhotos"),
        t("featAutoPublish"),
        t("featTrends"),
        t("featTiktok"),
        t("featContentPlan"),
        t("featTemplates"),
      ],
    },
    {
      id: "PRO",
      name: PLANS.PRO.name,
      price: PLANS.PRO.price,
      description: t("proDesc"),
      features: [
        fmtInfluencers(PLANS.PRO.maxInfluencers),
        fmtCredits(PLANS.PRO.credits),
        t("featPhotos"),
        t("featVideos"),
        t("featAutoPublish"),
        t("featTrends"),
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
        fmtCredits(PLANS.ENTERPRISE.credits),
        t("featVideos"),
        t("featBatch"),
        t("featAnalytics"),
        t("featWebhooks"),
        t("featSupport"),
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 selection:bg-violet-500/30">
      <header className="container mx-auto px-6 h-16 flex items-center justify-between border-b border-zinc-800/50">
        <Link href="/home" locale={locale} className="flex items-center gap-2 group">
          <div className="size-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="size-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">{PRODUCT_NAME}</span>
        </Link>
        <Link
          href="/home"
          locale={locale}
          className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="size-4" /> {tLanding("navFeatures")}
        </Link>
      </header>

      <main className="container mx-auto px-6 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            {t("title")}
          </h1>
          <p className="text-zinc-400 text-lg">{t("subtitle")}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const priceLabel =
              plan.price === 0 ? t("free") : `${plan.price}€`;
            const ctaHref = plan.enterprise
              ? `mailto:${SUPPORT_EMAIL}`
              : "/sign-up";
            const ctaLabel = plan.enterprise
              ? t("ctaContact")
              : plan.id === "FREE"
                ? t("ctaStart")
                : t("ctaSubscribe");

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-8 border flex flex-col ${
                  plan.featured
                    ? "border-violet-500/50 bg-violet-500/5 shadow-2xl shadow-violet-900/20"
                    : "border-zinc-800 bg-zinc-900/50"
                }`}
              >
                {plan.featured && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-violet-500 text-white text-xs font-bold rounded-full">
                    {t("mostPopular")}
                  </div>
                )}
                <h2 className="text-xl font-bold mb-2">{plan.name}</h2>
                <div className="mb-4">
                  <span className="text-4xl font-bold">{priceLabel}</span>
                  {plan.price > 0 && (
                    <span className="text-zinc-400">{t("perMonth")}</span>
                  )}
                </div>
                <p className="text-zinc-400 text-sm mb-6 min-h-[3rem]">
                  {plan.description}
                </p>

                {plan.enterprise ? (
                  <a
                    href={ctaHref}
                    className="inline-flex items-center justify-center w-full mb-6 h-10 px-4 rounded-md text-sm font-medium border border-zinc-700 text-white hover:bg-zinc-800 transition-colors"
                  >
                    {ctaLabel}
                  </a>
                ) : (
                  <Link href="/sign-up" locale={locale}>
                    <span
                      className={`inline-flex items-center justify-center w-full mb-6 h-10 px-4 rounded-md text-sm font-medium transition-colors ${
                        plan.featured
                          ? "bg-violet-600 hover:bg-violet-700 text-white"
                          : "border border-zinc-700 text-white hover:bg-zinc-800"
                      }`}
                    >
                      {ctaLabel}
                    </span>
                  </Link>
                )}

                <ul className="space-y-3">
                  {plan.features.map((feat, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-3 text-sm text-zinc-300"
                    >
                      <Check className="size-4 text-violet-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="text-center text-zinc-500 text-sm mt-12 mb-8">
          {t("ctaCreditPacks")}
        </p>

        <section
          id="credit-packs"
          className="max-w-4xl mx-auto scroll-mt-24"
        >
          <h2 className="text-2xl font-bold text-center mb-2">{t("packsTitle")}</h2>
          <p className="text-zinc-400 text-center text-sm mb-8">{t("packsSubtitle")}</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {CREDIT_PACK_CATALOG.map((pack) => (
              <div
                key={pack.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center"
              >
                <p className="text-sm font-medium text-zinc-400 mb-1">
                  {t(`packName.${pack.id}`)}
                </p>
                <p className="text-3xl font-bold mb-1">{pack.priceEur}€</p>
                <p className="text-sm text-zinc-400">
                  {t("packCredits", { count: pack.credits })}
                </p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              href="/sign-up"
              locale={locale}
              className="text-violet-400 hover:text-violet-300 underline-offset-4 hover:underline text-sm"
            >
              {t("packsCta")}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
