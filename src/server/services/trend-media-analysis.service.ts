/**
 * Analyze scraped trend media → TrendFormatBrief (inspiration only, no copy).
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/server/db";
import {
  parseTrendFormatBrief,
  trendFormatBriefSchema,
  type TrendFormatBrief,
} from "@/lib/trends/trend-format-brief";
import { callJsonLLM } from "@/server/services/ai-text.service";
import { JSON_REPAIR_INSTRUCTION } from "@/lib/prompts/content-plan-prompts";
import { pickVisionUrlsFromTrend } from "@/lib/trends/trend-video-items";
import type { TrendItem } from "@/generated/prisma/client";

const ANALYSIS_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

const briefOutputSchema = z.array(trendFormatBriefSchema).length(1);

function buildAnalysisContext(item: TrendItem): string {
  return [
    `Platform: ${item.platform}`,
    `Title: ${item.title}`,
    item.description ? `Description: ${item.description}` : "",
    item.hashtags.length ? `Hashtags: ${item.hashtags.map((h) => `#${h}`).join(" ")}` : "",
    item.soundName ? `Sound: ${item.soundName}` : "",
    item.mediaKind ? `Media kind: ${item.mediaKind}` : "",
    item.authorHandle ? `Source handle (do NOT name in output): ${item.authorHandle}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const ANALYSIS_SYSTEM = `You are a short-form social media format analyst for AI virtual influencers.

Your job: describe the VISUAL FORMAT of trending posts so we can recreate a similar vibe with a FICTIONAL AI character — not copy any real person.

STRICT RULES:
- NEVER name celebrities, real influencers, or "@handles" in sceneDescription, outfit, hook, or customPrompt.
- NEVER say "in the style of [person]" or "same face as".
- Describe: location, lighting, camera (iPhone/flash), framing, pose, outfit type, mood, reel pacing.
- For video/reels: output contentType REEL with reelStoryboard (3-5 beats with startSec/endSec) and videoType hint (grwm, ootd, transition, talking_head, etc.).
- sceneDescription must be English, 2-4 sentences, concrete and shootable.
- pose/expression must use allowed enums when possible: pose in portrait|fullBody|selfie|action|candid|sitting|profile; expression in smile|seductive|serious|playful|mysterious|natural|laughing|surprised.
- Not pornographic: lingerie/boudoir OK if source suggests it, but "not nude, not explicit" in sceneDescription when suggestive.
- inspirationNotes: 1 sentence explaining what format element you borrowed (e.g. "mirror OOTD pacing") without identifying anyone.

Return STRICT JSON: a one-element array [{ ...TrendFormatBrief }]. No markdown.`;

async function analyzeWithVision(
  item: TrendItem,
  imageUrls: string[]
): Promise<TrendFormatBrief> {
  const client = getAnthropic();
  if (!client) {
    return analyzeTextOnly(item);
  }

  const context = buildAnalysisContext(item);
  const blocks: Anthropic.MessageCreateParams["messages"][0]["content"] = [
    {
      type: "text",
      text: `${context}\n\nAnalyze the attached post frame(s). Extract format only.`,
    },
    ...imageUrls.slice(0, 4).map(
      (url) =>
        ({
          type: "image" as const,
          source: { type: "url" as const, url },
        }) as Anthropic.ImageBlockParam
    ),
  ];

  try {
    const response = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 2000,
      temperature: 0.4,
      system: ANALYSIS_SYSTEM,
      messages: [{ role: "user", content: blocks }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const raw = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    const parsed = briefOutputSchema.parse(raw);
    return { ...parsed[0], analyzedFrom: "vision" as const };
  } catch (e) {
    console.warn("[trend-media-analysis] vision failed, text fallback:", e);
    return analyzeTextOnly(item);
  }
}

async function analyzeTextOnly(item: TrendItem): Promise<TrendFormatBrief> {
  const context = buildAnalysisContext(item);
  const recs = await callJsonLLM<TrendFormatBrief[]>({
    systemPrompt: ANALYSIS_SYSTEM,
    userPrompt: `No images available. Infer the likely visual format from metadata only. Set confidence to "low" or "medium".\n\n${context}`,
    maxTokens: 1800,
    temperature: 0.5,
    repairInstruction: JSON_REPAIR_INSTRUCTION,
    validate: (raw) => briefOutputSchema.parse(raw),
  });
  return { ...recs[0], analyzedFrom: "text_only" };
}

export async function analyzeTrendItemFormat(
  trendItemId: string,
  options?: { force?: boolean }
): Promise<{ brief: TrendFormatBrief; model: string }> {
  const item = await db.trendItem.findUnique({ where: { id: trendItemId } });
  if (!item) throw new Error("Trend item not found");

  if (!options?.force && item.formatBrief) {
    const existing = parseTrendFormatBrief(item.formatBrief);
    if (existing) {
      return {
        brief: existing,
        model: item.formatAnalysisModel ?? "cached",
      };
    }
  }

  const imageUrls = pickVisionUrlsFromTrend({
    thumbnailUrl: item.thumbnailUrl,
    thumbnailUrlAlt: item.thumbnailUrlAlt,
    mediaUrls: item.mediaUrls,
  });

  const brief =
    imageUrls.length > 0
      ? await analyzeWithVision(item, imageUrls)
      : await analyzeTextOnly(item);

  const model =
    brief.analyzedFrom === "vision" ? `vision:${ANALYSIS_MODEL}` : "text:deepseek";

  await db.trendItem.update({
    where: { id: trendItemId },
    data: {
      formatBrief: brief as unknown as object,
      formatAnalyzedAt: new Date(),
      formatAnalysisModel: model,
    },
  });

  return { brief, model };
}

export function getTrendFormatBrief(
  item: Pick<TrendItem, "formatBrief">
): TrendFormatBrief | null {
  return parseTrendFormatBrief(item.formatBrief);
}
