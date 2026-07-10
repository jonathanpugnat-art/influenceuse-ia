import { z } from "zod";
import {
  TREND_CONTENT_TYPES,
  TREND_PLATFORMS,
} from "@/lib/prompts/trend-prompts";

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
