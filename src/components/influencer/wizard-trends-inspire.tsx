"use client";

import { TrendingUp, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { formatBriefToVariationHints } from "@/lib/trends/scraper-appearance-bridge";
import { parseTrendFormatBrief } from "@/lib/trends/trend-format-brief";
import {
  fingerprintFromWizard,
  normalizeAppearanceVariation,
} from "@/lib/prompts/appearance-variation-ui";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

/** Apply trending format signals to wizard appearance traits (step 2). */
export function WizardTrendsInspire() {
  const t = useTranslations("wizard");
  const { data, updateData } = useInfluencerWizard();

  const niche = data.niche?.trim();
  const { data: config } = trpc.trends.config.useQuery();
  const { data: inspiration, isLoading } = trpc.trends.wizardInspiration.useQuery(
    { niche: niche ?? "LIFESTYLE", isNsfw: data.isNsfw },
    { enabled: Boolean(niche) && Boolean(config?.providerConfigured) }
  );

  if (!niche || !config?.providerConfigured) return null;

  const items = inspiration?.items ?? [];
  if (!isLoading && items.length === 0) return null;

  const applyTrend = (formatBrief: unknown) => {
    const brief = parseTrendFormatBrief(formatBrief);
    if (!brief) {
      toast.error(t("trendsInspireFailed"));
      return;
    }
    const hints = formatBriefToVariationHints(brief, niche);
    const base = normalizeAppearanceVariation(data.appearanceVariations);
    const merged = { ...base, ...hints };
    updateData({
      appearanceVariations: merged,
      appearanceFingerprint: fingerprintFromWizard(data.age || 24, data, merged),
    });
    toast.success(t("trendsInspireApplied", { hook: brief.hook }));
  };

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-cyan-400" />
        <p className="text-sm font-semibold text-white">{t("trendsInspireTitle")}</p>
      </div>
      <p className="mb-3 text-xs text-slate-400">{t("trendsInspireHint")}</p>

      {isLoading ? (
        <p className="text-xs text-slate-500">{t("trendsInspireLoading")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyTrend(item.formatBrief)}
              className={cn(
                "max-w-full rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-2 text-left text-xs transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10"
              )}
            >
              <span className="flex items-center gap-1 font-medium text-cyan-200">
                <Sparkles className="h-3 w-3 shrink-0" />
                {item.title}
              </span>
              {item.hook && (
                <span className="mt-0.5 block line-clamp-1 text-slate-500">
                  {item.hook}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
