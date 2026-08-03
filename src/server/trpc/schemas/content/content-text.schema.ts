import { z } from "zod";
import { platformValues } from "./content-shared.schema";

export const generateCaptionInputSchema = z.object({
  influencerId: z.string(),
  contentDescription: z.string(),
  platform: z.enum(platformValues),
  language: z.enum(["fr", "en"]).default("fr"),
});

export const generateHashtagsInputSchema = z.object({
  niche: z.string(),
  platform: z.enum(platformValues),
  description: z.string(),
  count: z.number().int().min(5).max(30).default(15),
});

export const generateContentPlanInputSchema = z.object({
  influencerId: z.string(),
  days: z.number().int().min(1).max(30).default(7),
  postsPerDay: z.number().int().min(1).max(5).default(2),
  platforms: z.array(z.enum(platformValues)).min(1),
  language: z.enum(["fr", "en"]).default("fr"),
  goals: z.string().max(200).optional(),
  startDate: z.string().datetime().optional(),
  postingHours: z.array(z.number().int().min(0).max(23)).max(5).optional(),
  /** Ground posts on scraped weekly formats (Mon/Wed/Fri × weeks). Default on for ≥7d. */
  useTrendAnchors: z.boolean().optional(),
});

export const generateIdeasInputSchema = z.object({
  influencerId: z.string(),
  platform: z.enum(platformValues),
  count: z.number().int().min(3).max(15).default(8),
  language: z.enum(["fr", "en"]).default("fr"),
});

export const generateCaptionVariantsInputSchema = z.object({
  influencerId: z.string(),
  contentDescription: z.string(),
  platform: z.enum(platformValues),
  language: z.enum(["fr", "en"]).default("fr"),
});
