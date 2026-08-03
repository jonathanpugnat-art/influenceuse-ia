import { z } from "zod";

export const TRENDS_AGENT_MODEL = "claude-haiku-4-5-20251001";

export const trendAnalysisPickSchema = z.object({
  trendId: z.string(),
  whyItWorks: z.string().min(1).max(400),
  suggestedAngle: z.string().min(1).max(200),
  confidence: z.enum(["high", "medium"]),
});

export type TrendAnalysisPick = z.infer<typeof trendAnalysisPickSchema>;

export const trendsAgentAnalysisSchema = z.object({
  picks: z.array(trendAnalysisPickSchema).max(3),
});

export type TrendsAgentAnalysis = z.infer<typeof trendsAgentAnalysisSchema>;

export const TRENDS_AGENT_SYSTEM_PROMPT = `You are an elite TikTok/Instagram trend strategist.

Given an influencer profile (and creative brief when provided) and a list of trending formats, pick the TOP 3 trends that would perform best for THIS specific influencer.

For each pick explain in 1-2 sentences WHY the trend fits their niche, personality, and positioning (not generic advice). Use the creative brief when present — it overrides generic bio/personality signals.
Add a short "suggestedAngle" — one concrete creative twist they should use when adapting the trend.
When formatBrief fields are present (scene, mood, lighting, camera, inspirationNotes), reference them in whyItWorks and suggestedAngle — do not ignore vision analysis.

RULES:
- Write whyItWorks and suggestedAngle in the requested output language only.
- confidence: "high" when niche + personality align strongly; "medium" when plausible but needs a twist.
- Pick exactly 3 distinct trends from the provided list (use their trendId).
- Prefer higher growthScore trends when relevance is similar.
- Return STRICT JSON only:
{
  "picks": [
    {
      "trendId": "string",
      "whyItWorks": "string",
      "suggestedAngle": "string",
      "confidence": "high" | "medium"
    }
  ]
}`;

export function validateTrendsAgentAnalysis(raw: unknown): TrendsAgentAnalysis {
  return trendsAgentAnalysisSchema.parse(raw);
}

export function buildTrendsAgentUserPrompt(opts: {
  influencerName: string;
  niche: string;
  personality: string;
  bio: string;
  brief?: string;
  language: "fr" | "en";
  trends: Array<{
    id: string;
    title: string;
    description: string | null;
    platform: string;
    growthScore: number | null;
    nicheTags: string[];
    hashtags: string[];
    formatBrief?: {
      contentType: string;
      sceneDescription: string;
      mood: string;
      hook: string;
      lighting?: string;
      cameraStyle?: string;
      inspirationNotes?: string;
      confidence: string;
    };
  }>;
  searchQuery?: string;
}): string {
  const trendLines = opts.trends
    .map((t, i) => {
      const brief = t.formatBrief;
      const briefLine = brief
        ? ` | format=${brief.contentType} | scene=${brief.sceneDescription.slice(0, 80)} | mood=${brief.mood} | hook=${brief.hook.slice(0, 60)}${brief.lighting ? ` | light=${brief.lighting}` : ""}${brief.cameraStyle ? ` | cam=${brief.cameraStyle.slice(0, 60)}` : ""}${brief.inspirationNotes ? ` | notes=${brief.inspirationNotes.slice(0, 80)}` : ""} | conf=${brief.confidence}`
        : "";
      return `${i + 1}. id=${t.id} | platform=${t.platform} | growth=${t.growthScore ?? 0} | niches=${t.nicheTags.join(",") || "GENERAL"} | title=${t.title} | desc=${t.description ?? ""} | tags=${t.hashtags.slice(0, 5).join(" ")}${briefLine}`;
    })
    .join("\n");

  return [
    `Output language: ${opts.language === "fr" ? "French" : "English"}`,
    `Influencer: ${opts.influencerName}`,
    `Niche: ${opts.niche}`,
    `Personality: ${opts.personality}`,
    `Bio: ${opts.bio}`,
    opts.brief?.trim() ? `Creative brief:\n${opts.brief.trim()}` : "",
    opts.searchQuery ? `User search focus: ${opts.searchQuery}` : "",
    "",
    "Candidate trends (pick exactly 3):",
    trendLines,
  ]
    .filter(Boolean)
    .join("\n");
}
