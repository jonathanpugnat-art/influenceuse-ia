import { z } from "zod";
import {
  platformValues,
  contentTypeValues,
  contentStatusValues,
} from "./content-shared.schema";

export const updateContentInputSchema = z.object({
  contentId: z.string(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  platforms: z.array(z.enum(platformValues)).optional(),
  scheduledAt: z.date().optional().nullable(),
  status: z.enum(contentStatusValues).optional(),
});

export const getAllContentInputSchema = z.object({
  influencerId: z.string().optional(),
  type: z.enum(contentTypeValues).optional(),
  status: z.enum(contentStatusValues).optional(),
  platform: z.enum(platformValues).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
});

export const contentIdInputSchema = z.object({
  contentId: z.string(),
});
