/**
 * Analyze scraped trend media → TrendFormatBrief (inspiration only, no copy).
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/server/db";
import {
  coerceTrendFormatBriefFromLlm,
  parseTrendFormatBrief,
  type TrendFormatBrief,
} from "@/lib/trends/trend-format-brief";
import { pickVisionUrlsFromTrend } from "@/lib/trends/trend-video-items";
import {
  resolveVisionImageBlocks,
  type VisionImageBlock,
} from "@/lib/trends/trend-vision-images";
import { mirrorTrendThumbnails } from "@/server/services/trend-thumbnail-storage.service";
import {
  persistTrendSourceVideo,
  resolveTrendSourceVideoUrl,
} from "@/server/services/trend-video-storage.service";
import { extractTrendVideoFrameUrls } from "@/server/services/trend-video-frames.service";
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

function parseBriefFromAnthropicText(
  text: string,
  analyzedFrom: "vision" | "text_only"
): TrendFormatBrief {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  const raw = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  return coerceTrendFormatBriefFromLlm(raw, analyzedFrom);
}

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
- When multiple frames are provided, describe the REAL motion sequence across time — not a single frozen pose.
- sceneDescription must be English, 2-4 sentences, concrete and shootable.
- pose/expression must use allowed enums when possible: pose in portrait|fullBody|selfie|action|candid|sitting|profile; expression in smile|seductive|serious|playful|mysterious|natural|laughing|surprised.
- Not pornographic: lingerie/boudoir OK if source suggests it, but "not nude, not explicit" in sceneDescription when suggestive.
- inspirationNotes: 1 sentence explaining what format element you borrowed (e.g. "mirror OOTD pacing") without identifying anyone.

Return STRICT JSON: a one-element array [{ ...TrendFormatBrief }]. No markdown.`;

function toAnthropicImageBlock(
  block: VisionImageBlock
): Anthropic.ImageBlockParam {
  if (block.kind === "url") {
    return {
      type: "image",
      source: { type: "url", url: block.url },
    };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: block.media_type,
      data: block.data,
    },
  };
}

async function analyzeWithVision(
  item: TrendItem,
  imageBlocks: VisionImageBlock[]
): Promise<TrendFormatBrief> {
  const client = getAnthropic();
  if (!client) {
    return analyzeTextOnly(item);
  }

  const context = buildAnalysisContext(item);
  const blocks: Anthropic.MessageCreateParams["messages"][0]["content"] = [
    {
      type: "text",
      text: `${context}\n\nAnalyze the attached post frame(s). Extract format only — include motion beats if frames show progression.`,
    },
    ...imageBlocks.slice(0, 6).map(toAnthropicImageBlock),
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

    return { ...parseBriefFromAnthropicText(text, "vision"), analyzedFrom: "vision" as const };
  } catch (e) {
    console.warn("[trend-media-analysis] vision failed, text fallback:", e);
    return analyzeTextOnly(item);
  }
}

async function analyzeTextOnly(item: TrendItem): Promise<TrendFormatBrief> {
  const client = getAnthropic();
  if (!client) {
    throw new Error(
      "ANTHROPIC_API_KEY is required for trend format analysis when no vision frames are available."
    );
  }

  const context = buildAnalysisContext(item);
  const response = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 2000,
    temperature: 0.4,
    system: ANALYSIS_SYSTEM,
    messages: [
      {
        role: "user",
        content: `No images available. Infer the likely visual format from metadata only. Set confidence to "low" or "medium".\n\n${context}\n\nReturn STRICT JSON: a one-element array [{ ...TrendFormatBrief }]. No markdown.`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return { ...parseBriefFromAnthropicText(text, "text_only"), analyzedFrom: "text_only" };
}

/** Mirror covers + video frames before vision (social CDNs block Anthropic URL fetch). */
async function ensureTrendMediaAssets(item: TrendItem): Promise<TrendItem> {
  const thumbs = await mirrorTrendThumbnails({
    id: item.id,
    thumbnailUrl: item.thumbnailUrl,
    thumbnailUrlAlt: item.thumbnailUrlAlt,
    mediaUrls: item.mediaUrls,
  });
  let sourceVideoUrl = item.sourceVideoUrl;
  const remoteMp4 = resolveTrendSourceVideoUrl(item);

  if (!sourceVideoUrl && remoteMp4) {
    sourceVideoUrl = await persistTrendSourceVideo(remoteMp4, item.id);
  }

  let videoFrameUrls = item.videoFrameUrls ?? [];
  const videoForFrames = sourceVideoUrl ?? remoteMp4;
  if (videoForFrames && videoFrameUrls.length === 0) {
    videoFrameUrls = await extractTrendVideoFrameUrls(videoForFrames, item.id);
  }

  const patch = {
    thumbnailUrl: thumbs.thumbnailUrl ?? undefined,
    thumbnailUrlAlt: thumbs.thumbnailUrlAlt ?? undefined,
    sourceVideoUrl: sourceVideoUrl ?? undefined,
    videoFrameUrls,
  };

  const thumbsChanged =
    thumbs.changed ||
    thumbs.thumbnailUrl !== item.thumbnailUrl ||
    thumbs.thumbnailUrlAlt !== item.thumbnailUrlAlt;
  const videoChanged =
    sourceVideoUrl !== item.sourceVideoUrl ||
    videoFrameUrls.length !== (item.videoFrameUrls?.length ?? 0);

  if (thumbsChanged || videoChanged) {
    await db.trendItem.update({
      where: { id: item.id },
      data: patch,
    });
    return {
      ...item,
      thumbnailUrl: thumbs.thumbnailUrl,
      thumbnailUrlAlt: thumbs.thumbnailUrlAlt,
      sourceVideoUrl: sourceVideoUrl ?? null,
      videoFrameUrls,
    };
  }

  return item;
}

export async function analyzeTrendItemFormat(
  trendItemId: string,
  options?: { force?: boolean }
): Promise<{ brief: TrendFormatBrief; model: string; cached: boolean }> {
  let item = await db.trendItem.findUnique({ where: { id: trendItemId } });
  if (!item) throw new Error("Trend item not found");

  if (!options?.force && item.formatBrief) {
    const existing = parseTrendFormatBrief(item.formatBrief);
    if (existing) {
      return {
        brief: existing,
        model: item.formatAnalysisModel ?? "cached",
        cached: true,
      };
    }
  }

  item = await ensureTrendMediaAssets(item);

  const visionUrls = pickVisionUrlsFromTrend({
    thumbnailUrl: item.thumbnailUrl,
    thumbnailUrlAlt: item.thumbnailUrlAlt,
    mediaUrls: item.mediaUrls,
    videoFrameUrls: item.videoFrameUrls,
  });

  const imageBlocks = await resolveVisionImageBlocks(visionUrls);

  const brief =
    imageBlocks.length > 0
      ? await analyzeWithVision(item, imageBlocks)
      : await analyzeTextOnly(item);

  const model =
    brief.analyzedFrom === "vision"
      ? `vision:${ANALYSIS_MODEL}`
      : `text:anthropic:${ANALYSIS_MODEL}`;

  await db.trendItem.update({
    where: { id: trendItemId },
    data: {
      formatBrief: brief as unknown as object,
      formatAnalyzedAt: new Date(),
      formatAnalysisModel: model,
    },
  });

  return { brief, model, cached: false };
}

export function getTrendFormatBrief(
  item: Pick<TrendItem, "formatBrief">
): TrendFormatBrief | null {
  return parseTrendFormatBrief(item.formatBrief);
}
