import { z } from "zod";
import { CREDIT_COSTS } from "@/lib/constants";

export const LORA_STATUSES = ["NONE", "TRAINING", "READY", "FAILED"] as const;
export type LoraStatus = (typeof LORA_STATUSES)[number];

export const LORA_DEFAULT_SCALE = 0.75;
/** Base portrait + Kontext shots must reach this count. */
export const LORA_MIN_DATASET_IMAGES = 10;
export const LORA_TARGET_DATASET_IMAGES = 12;
/** FAL fast-trainer steps — 500 keeps ~$1–2 API vs 1000. Override via env. */
export const LORA_TRAINING_STEPS = 500;
/** Max new LoRA trainings per user per rolling 30 days (abuse guard). */
export const LORA_MONTHLY_CAP_PER_USER = 5;

export function estimateLoraCreditCost(datasetReady: boolean): number {
  return (
    (datasetReady ? 0 : CREDIT_COSTS.LORA_DATASET) + CREDIT_COSTS.LORA_TRAINING
  );
}

export const loraDatasetSchema = z.object({
  status: z.enum(["generating", "ready", "failed"]),
  imageUrls: z.array(z.string().url()).default([]),
  zipUrl: z.string().url().optional(),
  error: z.string().optional(),
  updatedAt: z.string(),
});

export type LoraDatasetRecord = z.infer<typeof loraDatasetSchema>;

/** Varied Kontext shots for LoRA training (angles, light, expression). */
export const LORA_DATASET_SHOTS: Array<{ id: string; prompt: string }> = [
  {
    id: "front_neutral",
    prompt:
      "same exact person as the reference, front facing portrait, neutral expression, soft window light, plain background, iPhone photo, real skin texture",
  },
  {
    id: "front_smile",
    prompt:
      "same exact person as the reference, front facing, warm natural smile, casual white t-shirt, daylight, candid Instagram photo",
  },
  {
    id: "profile_left",
    prompt:
      "same exact person as the reference, left profile head and shoulders, neutral expression, soft light, realistic pores",
  },
  {
    id: "profile_right",
    prompt:
      "same exact person as the reference, right profile head and shoulders, relaxed expression, indoor ambient light",
  },
  {
    id: "three_quarter",
    prompt:
      "same exact person as the reference, three-quarter angle medium shot waist up, relaxed smile, casual outfit, natural daylight",
  },
  {
    id: "full_body",
    prompt:
      "same exact person as the reference, full body standing, jeans and fitted top, sneakers, apartment background, vertical iPhone photo",
  },
  {
    id: "outdoor_golden",
    prompt:
      "same exact person as the reference, outdoor golden hour portrait, gentle wind in hair, street background, handheld iPhone",
  },
  {
    id: "serious_editorial",
    prompt:
      "same exact person as the reference, serious expression, minimal makeup, clean background, soft key light, editorial but still phone-real",
  },
  {
    id: "playful",
    prompt:
      "same exact person as the reference, playful expression, hand near face, bright natural light, fun creator energy",
  },
  {
    id: "close_up",
    prompt:
      "same exact person as the reference, close-up face portrait, direct eye contact, natural skin imperfections, soft diffused light",
  },
  {
    id: "over_shoulder",
    prompt:
      "same exact person as the reference, over-the-shoulder look back at camera, casual jacket, city sidewalk, daylight",
  },
  {
    id: "laughing",
    prompt:
      "same exact person as the reference, genuine laugh, eyes slightly closed, candid moment, natural indoor light",
  },
];

export function buildLoraTriggerWord(influencerId: string, name?: string): string {
  const slug = (name ?? "aura")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8);
  const suffix = influencerId.replace(/[^a-z0-9]/gi, "").slice(-6).toLowerCase();
  return `AURA_${slug || "creator"}_${suffix}`;
}

export function parseLoraDataset(raw: unknown): LoraDatasetRecord | null {
  const parsed = loraDatasetSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function isLoraReady(status: string | null | undefined): boolean {
  return status === "READY";
}
