import { z } from "zod";
import { contentModeValues } from "./content-shared.schema";

export const reelStylePresetValues = [
  "stable_face",
  "natural_motion",
  "classic_motion",
  "creative",
  "lip_sync",
] as const;

export const generateReelInputSchema = z.object({
  influencerId: z.string(),
  duration: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(15),
  format: z.enum(["VERTICAL", "SQUARE"]).default("VERTICAL"),
  videoType: z.string(),
  script: z.string().min(10),
  /** Explicit scene (English recommended). If empty, the script is used. */
  sceneDescription: z.string().optional(),
  outfit: z.string().optional(),
  music: z.string().optional(),
  effects: z.array(z.string()).optional(),
  textOverlay: z.string().optional(),
  contentMode: z.enum(contentModeValues).default("SFW"),
  nsfwLevel: z.string().optional(),
  /** stable_face: max identity; natural_motion: balanced; creative: prompt optimizer on */
  reelStylePreset: z.enum(reelStylePresetValues).default("natural_motion"),
  /** HTTPS audio for lip_sync preset (Sync 1.6 post-process). */
  audioUrl: z.string().url().optional(),
  /** When false, animates base portrait only (legacy behaviour). */
  generateSceneFrame: z.boolean().default(true),
  /** Persisted trend MP4 for Kling Motion Control. */
  motionSourceVideoUrl: z.string().url().optional(),
  fromTrend: z.boolean().optional(),
  trendItemId: z.string().optional(),
  recommendationId: z.string().optional(),
});

export type GenerateReelInput = z.infer<typeof generateReelInputSchema>;

export const generateReelNarrationInputSchema = z.object({
  script: z.string().max(1200).optional(),
  sceneDescription: z.string().max(800).optional(),
  outfit: z.string().max(400).optional(),
  language: z.enum(["fr", "en"]).default("fr"),
  voice: z.string().max(80).optional(),
});
