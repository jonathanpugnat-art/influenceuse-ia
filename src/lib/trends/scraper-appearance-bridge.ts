/**
 * Maps analyzed trend format signals into wizard / creator hints.
 */

import type { AppearanceVariation } from "@/lib/prompts/image-prompts";
import type { TrendFormatBrief } from "@/lib/trends/trend-format-brief";

export type ScrapedLookSignal = {
  niche: string;
  tags: string[];
  weight?: number;
};

export function formatBriefToLookSignals(
  brief: TrendFormatBrief,
  niche: string
): ScrapedLookSignal[] {
  return [
    {
      niche,
      tags: [
        brief.mood,
        brief.cameraStyle,
        brief.lighting,
        brief.pose,
        brief.expression,
      ].filter(Boolean),
      weight: brief.confidence === "high" ? 1 : 0.6,
    },
  ];
}

export function scrapedSignalsToVariationHints(
  signals: ScrapedLookSignal[]
): Partial<AppearanceVariation> | null {
  if (signals.length === 0) return null;
  const tags = signals.flatMap((s) => s.tags).join(" ").toLowerCase();
  const hints: Partial<AppearanceVariation> = {};
  if (tags.includes("freckle")) hints.distinctiveFeature = 0;
  if (tags.includes("smirk") || tags.includes("seductive")) {
    hints.expression = 3;
  }
  if (tags.includes("almond")) hints.eyeShape = 0;
  return Object.keys(hints).length > 0 ? hints : null;
}

export function formatBriefToVariationHints(
  brief: TrendFormatBrief | null | undefined,
  niche: string
): Partial<AppearanceVariation> | null {
  if (!brief) return null;
  return scrapedSignalsToVariationHints(formatBriefToLookSignals(brief, niche));
}
