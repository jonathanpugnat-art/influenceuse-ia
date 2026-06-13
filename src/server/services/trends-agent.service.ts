import Anthropic from "@anthropic-ai/sdk";
import type { Influencer, TrendItem } from "@/generated/prisma/client";
import {
  buildTrendsAgentUserPrompt,
  TRENDS_AGENT_MODEL,
  TRENDS_AGENT_SYSTEM_PROMPT,
  type TrendAnalysisPick,
  validateTrendsAgentAnalysis,
} from "@/lib/prompts/trends-agent-prompts";

export type TrendAnalysisInput = Pick<
  TrendItem,
  | "id"
  | "title"
  | "description"
  | "hashtags"
  | "growthScore"
  | "platform"
  | "nicheTags"
>;

function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

async function callTrendsHaikuJson(
  userPrompt: string
): Promise<TrendAnalysisPick[]> {
  const client = getAnthropic();
  const tryParse = (text: string): TrendAnalysisPick[] | null => {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    try {
      return validateTrendsAgentAnalysis(JSON.parse(cleaned)).picks;
    } catch {
      return null;
    }
  };

  const response = await client.messages.create({
    model: TRENDS_AGENT_MODEL,
    max_tokens: 900,
    temperature: 0.35,
    system: TRENDS_AGENT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const parsed = tryParse(text);
  if (parsed) return parsed;

  const repair = await client.messages.create({
    model: TRENDS_AGENT_MODEL,
    max_tokens: 900,
    temperature: 0.2,
    system: TRENDS_AGENT_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: userPrompt },
      { role: "assistant", content: text },
      {
        role: "user",
        content: "Return only valid JSON matching the schema.",
      },
    ],
  });

  const repairText = repair.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const repaired = tryParse(repairText);
  if (repaired) return repaired;

  throw new Error("Trends agent: invalid JSON from Haiku.");
}

export async function analyzeTrendsForInfluencer(
  influencer: Pick<
    Influencer,
    "id" | "name" | "niche" | "personality" | "bio"
  >,
  trends: TrendAnalysisInput[],
  opts?: { language?: "fr" | "en"; searchQuery?: string }
): Promise<TrendAnalysisPick[]> {
  const language = opts?.language ?? "fr";
  const pool = trends.slice(0, 10);

  if (pool.length === 0) return [];

  const userPrompt = buildTrendsAgentUserPrompt({
    influencerName: influencer.name,
    niche: influencer.niche,
    personality: influencer.personality,
    bio: influencer.bio,
    language,
    trends: pool,
    searchQuery: opts?.searchQuery,
  });

  try {
    const picks = await callTrendsHaikuJson(userPrompt);
    const validIds = new Set(pool.map((t) => t.id));
    const filtered = picks.filter((p) => validIds.has(p.trendId)).slice(0, 3);
    if (filtered.length >= 1) return filtered;
  } catch (error) {
    console.warn("[trends-agent] Haiku failed, using fallback:", error);
  }

  return buildFallbackPicks(influencer, pool, language);
}
