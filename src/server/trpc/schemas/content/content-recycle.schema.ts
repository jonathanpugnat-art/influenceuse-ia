import { z } from "zod";

export const listRecycleCandidatesInputSchema = z
  .object({
    influencerId: z.string().optional(),
  })
  .optional();

export const recyclePostInputSchema = z.object({
  sourceContentId: z.string(),
  scheduledFor: z.date().optional(),
  language: z.enum(["fr", "en"]).default("fr"),
});
