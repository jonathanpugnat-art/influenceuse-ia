import type { Influencer, TrendItem } from "@/generated/prisma/client";
import type { TrendFormatBrief } from "@/lib/trends/trend-format-brief";
import {
  buildTrendsAgentUserPrompt,
  TRENDS_AGENT_MODEL,
  TRENDS_AGENT_SYSTEM_PROMPT,
  type TrendAnalysisPick,
  validateTrendsAgentAnalysis,
} from "@/lib/prompts/trends-agent-prompts";
import { callAgentJsonLLM } from "@/server/services/ai-text.service";
import { inferAdultLaneFromSignals } from "@/lib/text-provider-config";
import { getTrendFormatBrief } from "@/server/services/trend-media-analysis.service";

export type TrendAnalysisInput = Pick<
  TrendItem,
  | "id"
  | "title"
  | "description"
  | "hashtags"
  | "growthScore"
  | "platform"
  | "nicheTags"
> & {
  formatBrief?: Pick<
    TrendFormatBrief,
    | "contentType"
    | "sceneDescription"
    | "mood"
    | "hook"
    | "lighting"
    | "cameraStyle"
    | "inspirationNotes"
    | "confidence"
  >;
};

export function mapTrendItemsForAnalysis(
  items: TrendItem[]
): TrendAnalysisInput[] {
  return items.map((t) => {
    const brief = getTrendFormatBrief(t);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      platform: t.platform,
      growthScore: t.growthScore,
      nicheTags: t.nicheTags,
      hashtags: t.hashtags,
      formatBrief: brief
        ? {
            contentType: brief.contentType,
            sceneDescription: brief.sceneDescription,
            mood: brief.mood,
            hook: brief.hook,
            lighting: brief.lighting,
            cameraStyle: brief.cameraStyle,
            inspirationNotes: brief.inspirationNotes,
            confidence: brief.confidence,
          }
        : undefined,
    };
  });
}

function buildFallbackPicks(
  influencer: Pick<Influencer, "niche" | "personality">,
  trends: TrendAnalysisInput[],
  language: "fr" | "en"
): TrendAnalysisPick[] {
  const ranked = [...trends].sort(
    (a, b) => (b.growthScore ?? 0) - (a.growthScore ?? 0)
  );

  return ranked.slice(0, 3).map((trend, index) => {
    const nicheMatch =
      trend.nicheTags.includes(influencer.niche) ||
      trend.nicheTags.includes("GENERAL") ||
      trend.nicheTags.length === 0;

    const title = trend.title.replace(/\s+/g, " ").trim().slice(0, 72);
    const tags =
      trend.hashtags.length > 0
        ? trend.hashtags
            .slice(0, 3)
            .map((h) => `#${h}`)
            .join(" ")
        : "";
    const score = Math.round(trend.growthScore ?? 0);
    const voice = influencer.personality.replace(/\s+/g, " ").trim().slice(0, 48);

    const whyItWorks =
      language === "fr"
        ? nicheMatch
          ? `« ${title} »${tags ? ` (${tags})` : ""} — ${trend.platform} en hausse (score ${score}). Ta niche ${influencer.niche} + ton ton « ${voice} » rendent ce hook crédible sans copier le créateur original.`
          : `« ${title} »${tags ? ` (${tags})` : ""} — momentum ${score}/100 sur ${trend.platform}. Twist-le avec ta personnalité « ${voice} » pour te démarquer dans ${influencer.niche}.`
        : nicheMatch
          ? `"${title}"${tags ? ` (${tags})` : ""} — rising on ${trend.platform} (score ${score}). Your ${influencer.niche} niche and "${voice}" voice make this hook feel authentic.`
          : `"${title}"${tags ? ` (${tags})` : ""} — momentum ${score}/100 on ${trend.platform}. Twist it with your "${voice}" personality to stand out in ${influencer.niche}.`;

    const angleHooks = [
      language === "fr"
        ? `Ouvre sur un détail visuel de « ${title.slice(0, 40)} » en moins de 3 secondes.`
        : `Open on a visual detail from "${title.slice(0, 40)}" within 3 seconds.`,
      tags
        ? language === "fr"
          ? `Reprends ${tags.split(" ")[0]} mais avec ta signature ${influencer.niche.toLowerCase()}.`
          : `Reuse ${tags.split(" ")[0]} with your ${influencer.niche.toLowerCase()} signature.`
        : language === "fr"
          ? `Reformule le hook avec ta voix « ${voice} » dès la première seconde.`
          : `Rewrite the hook in your "${voice}" voice from second one.`,
      language === "fr"
        ? `Termine sur une CTA soft alignée avec ${influencer.niche.toLowerCase()} (save / follow / lien bio).`
        : `Close with a soft CTA aligned to ${influencer.niche.toLowerCase()} (save / follow / bio link).`,
    ];

    return {
      trendId: trend.id,
      whyItWorks,
      suggestedAngle: angleHooks[index % angleHooks.length]!,
      confidence: nicheMatch ? "high" : "medium",
    };
  });
}

async function callTrendsAgentJson(
  userPrompt: string,
  contentLane: "sfw" | "adult"
): Promise<TrendAnalysisPick[]> {
  const result = await callAgentJsonLLM({
    contentLane,
    systemPrompt: TRENDS_AGENT_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 900,
    temperature: 0.35,
    anthropicModel: TRENDS_AGENT_MODEL,
    validate: validateTrendsAgentAnalysis,
    repairInstruction: "Return only valid JSON matching the schema.",
  });
  return result.picks;
}

export async function analyzeTrendsForInfluencer(
  influencer: Pick<
    Influencer,
    "id" | "name" | "niche" | "personality" | "bio" | "brief" | "isNsfw"
  >,
  trends: TrendAnalysisInput[],
  opts?: { language?: "fr" | "en"; searchQuery?: string }
): Promise<TrendAnalysisPick[]> {
  const language = opts?.language ?? "fr";
  const pool = trends.slice(0, 10);

  if (pool.length === 0) return [];

  const contentLane = inferAdultLaneFromSignals({
    isNsfw: influencer.isNsfw,
    niche: influencer.niche,
    brief: influencer.brief ?? undefined,
  });

  const userPrompt = buildTrendsAgentUserPrompt({
    influencerName: influencer.name,
    niche: influencer.niche,
    personality: influencer.personality,
    bio: influencer.bio,
    brief: influencer.brief ?? undefined,
    language,
    trends: pool,
    searchQuery: opts?.searchQuery,
  });

  try {
    const picks = await callTrendsAgentJson(userPrompt, contentLane);
    const validIds = new Set(pool.map((t) => t.id));
    const filtered = picks.filter((p) => validIds.has(p.trendId)).slice(0, 3);
    if (filtered.length >= 1) return filtered;
  } catch (error) {
    console.warn("[trends-agent] LLM failed, using fallback:", error);
  }

  return buildFallbackPicks(influencer, pool, language);
}
