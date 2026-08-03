import { z } from "zod";
import {
  TREND_CONTENT_TYPES,
  TREND_PLATFORMS,
} from "@/lib/prompts/trend-prompts";
import {
  clampContentType,
  clampExpression,
  clampPlatform,
  clampPose,
  clampScene,
} from "./normalization";

export const trendRecommendationFieldsSchema = z.object({
  trendId: z.string().min(1),
  hook: z.string().min(1).max(240),
  concept: z.string().min(1).max(600),
  type: z.enum(TREND_CONTENT_TYPES),
  platform: z.enum(TREND_PLATFORMS),
  scene: z.string().min(1).max(40),
  pose: z.string().min(1).max(40),
  expression: z.string().min(1).max(40),
  outfit: z.string().min(0).max(200),
  customPrompt: z.string().min(0).max(400),
  sceneDescription: z.string().max(800).optional(),
  trendTitle: z.string().max(500).optional(),
  trendHashtags: z.array(z.string().min(1).max(80)).max(30).optional(),
  confidence: z.enum(["high", "medium", "low"]),
  citations: z.array(z.string().min(1).max(60)).max(8),
});

export type TrendRecommendationFields = z.infer<
  typeof trendRecommendationFieldsSchema
>;

export const llmOutputSchema = z
  .array(trendRecommendationFieldsSchema)
  .min(1)
  .max(50);

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

/**
 * Lenient coercion before Zod — LLM enums / lengths often miss by a bit
 * after SFW→adult fallback. Prefer clamp over hard fail.
 */
export function coerceLlmTrendRecommendations(
  raw: unknown
): TrendRecommendationFields[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.recommendations)) arr = obj.recommendations;
    else if (Array.isArray(obj.items)) arr = obj.items;
    else arr = [raw];
  }

  if (arr.length === 0) {
    throw new Error("LLM returned empty trend recommendations");
  }

  return arr.slice(0, 50).map((item, index) => {
    const r =
      item && typeof item === "object"
        ? (item as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    const hookRaw = asString(r.hook).trim();
    const hook = truncate(hookRaw || "Adapt this trend in your voice", 240);
    const conceptRaw = asString(r.concept).trim();
    const concept = truncate(conceptRaw || hook, 600);

    const confidenceRaw = asString(r.confidence, "medium").toLowerCase();
    const confidence =
      confidenceRaw === "high" || confidenceRaw === "low"
        ? confidenceRaw
        : "medium";

    const citations = Array.isArray(r.citations)
      ? r.citations
          .map((c) => truncate(asString(c).trim(), 60))
          .filter(Boolean)
          .slice(0, 8)
      : [];

    const hashtags = Array.isArray(r.trendHashtags)
      ? r.trendHashtags
          .map((h) => truncate(asString(h).trim(), 80))
          .filter(Boolean)
          .slice(0, 30)
      : undefined;

    return trendRecommendationFieldsSchema.parse({
      trendId: truncate(
        asString(r.trendId, `unknown-${index}`).trim() || `unknown-${index}`,
        200
      ),
      hook,
      concept,
      type: clampContentType(asString(r.type, "PHOTO")),
      platform: clampPlatform(asString(r.platform, "INSTAGRAM")),
      scene: truncate(clampScene(asString(r.scene, "studio")), 40),
      pose: truncate(clampPose(asString(r.pose, "portrait")), 40),
      expression: truncate(clampExpression(asString(r.expression, "natural")), 40),
      outfit: truncate(asString(r.outfit), 200),
      customPrompt: truncate(asString(r.customPrompt), 400),
      sceneDescription:
        r.sceneDescription != null
          ? truncate(asString(r.sceneDescription), 800)
          : undefined,
      trendTitle:
        r.trendTitle != null ? truncate(asString(r.trendTitle), 500) : undefined,
      trendHashtags: hashtags,
      confidence,
      citations: citations.length > 0 ? citations : ["llm"],
    });
  });
}
