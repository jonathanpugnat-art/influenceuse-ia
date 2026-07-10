import { z } from "zod";
import { hasUserSceneDescription } from "@/lib/photo-scene-user";
import { contentModeValues } from "./content-shared.schema";

export const photoCreatorInputSchema = z
  .object({
    influencerId: z.string(),
    scene: z.string(),
    sceneDescription: z.string().max(600).optional(),
    pose: z.string(),
    outfit: z.string().default(""),
    expression: z.string().default("natural"),
    photoStyle: z.string().default("natural"),
    timeOfDay: z.string().default("natural"),
    location: z.string().optional(),
    customPrompt: z.string().optional(),
    numberOfImages: z.number().int().min(1).max(4).default(1),
    contentMode: z.enum(contentModeValues).default("SFW"),
    nsfwLevel: z.string().optional(),
    useFaceReference: z.boolean().default(true),
    lookId: z.string().nullable().optional(),
    instagramShot: z.boolean().optional(),
    trendContext: z
      .object({
        title: z.string().max(500).optional(),
        hashtags: z.array(z.string().max(80)).max(30).optional(),
        brief: z
          .object({
            cameraStyle: z.string().max(200).optional(),
            lighting: z.string().max(120).optional(),
            mood: z.string().max(200).optional(),
            inspirationNotes: z.string().max(500).optional(),
          })
          .optional(),
      })
      .optional(),
    trendItemId: z.string().optional(),
    recommendationId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasTrendRef = Boolean(data.trendItemId || data.recommendationId);
    if (!data.outfit.trim() && !hasTrendRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tenue requise avant génération.",
        path: ["outfit"],
      });
    }
    if (!hasUserSceneDescription(data.sceneDescription) && !hasTrendRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Décris la scène avant génération.",
        path: ["sceneDescription"],
      });
    }
  });

export type PhotoCreatorInput = z.infer<typeof photoCreatorInputSchema>;

export const composePhotoOnSceneInputSchema = z.object({
  contentId: z.string(),
  /** Optional override; defaults to params stored on the content row. */
  numberOfImages: z.number().int().min(1).max(4).optional(),
});
