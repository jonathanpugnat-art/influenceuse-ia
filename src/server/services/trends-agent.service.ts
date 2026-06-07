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

  return ranked.slice(0, 3).map((trend) => {
    const nicheMatch =
      trend.nicheTags.includes(influencer.niche) ||
      trend.nicheTags.includes("GENERAL") ||
      trend.nicheTags.length === 0;

    const whyItWorks =
      language === "fr"
        ? nicheMatch
          ? `Ce format ${trend.platform} cartonne en ce moment et colle à ta niche ${influencer.niche} — ton style ${influencer.personality.slice(0, 60)} le rendra crédible.`
          : `Trend à fort momentum (score ${trend.growthScore ?? 0}) — adapte-le avec ta touche ${influencer.personality.slice(0, 40)} pour te démarquer.`
        : nicheMatch
          ? `This ${trend.platform} format is rising and fits your ${influencer.niche} niche — your ${influencer.personality.slice(0, 60)} voice makes it believable.`
          : `High-momentum trend (score ${trend.growthScore ?? 0}) — twist it with your ${influencer.personality.slice(0, 40)} personality to stand out.`;

    const suggestedAngle =
      language === "fr"
        ? `Hook en 5 secondes + tenue/scène ${influencer.niche.toLowerCase()} reconnaissable.`
        : `Open with a 5-second hook + a recognizable ${influencer.niche.toLowerCase()} look.`;

    return {
      trendId: trend.id,
      whyItWorks,
      suggestedAngle,
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
