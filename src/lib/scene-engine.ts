/**
 * Scene-video engine switch.
 *
 * Default V1 = Kling O3 Standard image-to-video. Seedance stays in the
 * repo (`SCENE_ENGINE=seedance`) but is paused — Fal 422s photoreal faces.
 */

import { CREDIT_COSTS } from "@/lib/constants";
import { getSeedancePricingSnapshot } from "@/lib/seedance-config";

export const SCENE_ENGINES = ["kling_o3_i2v", "seedance"] as const;
export type SceneEngine = (typeof SCENE_ENGINES)[number];

export const KLING_SCENE_ALLOWED_DURATIONS = [5, 10, 15] as const;
export type KlingSceneDuration = (typeof KLING_SCENE_ALLOWED_DURATIONS)[number];

export const KLING_SCENE_DEFAULT_MODEL =
  "fal-ai/kling-video/o3/standard/image-to-video";

export const KLING_SCENE_MODE = "kling_o3_i2v" as const;

export function getSceneEngine(
  env: Record<string, string | undefined> = process.env
): SceneEngine {
  const raw = env.SCENE_ENGINE?.trim();
  if (raw === "seedance") return "seedance";
  return "kling_o3_i2v";
}

export function isKlingSceneEngine(
  env: Record<string, string | undefined> = process.env
): boolean {
  return getSceneEngine(env) === "kling_o3_i2v";
}

export function resolveKlingSceneModelId(
  env: Record<string, string | undefined> = process.env
): string {
  return env.FAL_KLING_O3_SCENE_I2V_MODEL?.trim() || KLING_SCENE_DEFAULT_MODEL;
}

export function isKlingSceneModelId(modelId: string): boolean {
  return modelId.includes("kling-video") && modelId.includes("image-to-video");
}

export function clampKlingSceneDuration(requested: number): KlingSceneDuration {
  if (
    KLING_SCENE_ALLOWED_DURATIONS.includes(requested as KlingSceneDuration)
  ) {
    return requested as KlingSceneDuration;
  }
  if (!Number.isFinite(requested) || requested <= 0) {
    return 5;
  }
  const sorted = [...KLING_SCENE_ALLOWED_DURATIONS];
  let picked: KlingSceneDuration = sorted[0];
  for (const d of sorted) {
    if (d <= requested) picked = d;
  }
  return picked;
}

export function estimateKlingSceneCredits(
  durationSec: KlingSceneDuration,
  generateAudio: boolean
): number {
  const perSec = generateAudio
    ? CREDIT_COSTS.KLING_SCENE_I2V_AUDIO_ON_PER_SEC
    : CREDIT_COSTS.KLING_SCENE_I2V_AUDIO_OFF_PER_SEC;
  return Math.ceil(perSec * durationSec);
}

export interface ScenePricingSnapshot {
  engine: SceneEngine;
  label: string;
  allowedDurations: number[];
  allowedResolutions: string[];
  defaultDurationSec: number;
  defaultResolution: string | null;
  creditsPerSecAudioOff: number;
  creditsPerSecAudioOn: number;
  creditsPerSec: Record<string, number>;
  matrix: Array<{
    durationSec: number;
    generateAudio: boolean;
    resolution: string | null;
    credits: number;
  }>;
}

export function getKlingScenePricingSnapshot(): ScenePricingSnapshot {
  const matrix = KLING_SCENE_ALLOWED_DURATIONS.flatMap((durationSec) =>
    [false, true].map((generateAudio) => ({
      durationSec,
      generateAudio,
      resolution: null,
      credits: estimateKlingSceneCredits(durationSec, generateAudio),
    }))
  );
  return {
    engine: "kling_o3_i2v",
    label: "Vidéo scène (Kling)",
    allowedDurations: [...KLING_SCENE_ALLOWED_DURATIONS],
    allowedResolutions: [],
    defaultDurationSec: 10,
    defaultResolution: null,
    creditsPerSecAudioOff: CREDIT_COSTS.KLING_SCENE_I2V_AUDIO_OFF_PER_SEC,
    creditsPerSecAudioOn: CREDIT_COSTS.KLING_SCENE_I2V_AUDIO_ON_PER_SEC,
    creditsPerSec: {
      audioOff: CREDIT_COSTS.KLING_SCENE_I2V_AUDIO_OFF_PER_SEC,
      audioOn: CREDIT_COSTS.KLING_SCENE_I2V_AUDIO_ON_PER_SEC,
    },
    matrix,
  };
}

export function getScenePricingSnapshot(
  env: Record<string, string | undefined> = process.env
): ScenePricingSnapshot {
  if (getSceneEngine(env) === "seedance") {
    const snap = getSeedancePricingSnapshot();
    return {
      engine: "seedance",
      label: "Vidéo scène (Seedance)",
      allowedDurations: [...snap.allowedDurations],
      allowedResolutions: [...snap.allowedResolutions],
      defaultDurationSec: snap.defaultDurationSec,
      defaultResolution: snap.defaultResolution,
      creditsPerSecAudioOff: 0,
      creditsPerSecAudioOn: 0,
      creditsPerSec: { ...snap.creditsPerSec },
      matrix: snap.matrix.map((row) => ({
        durationSec: row.durationSec,
        generateAudio: true,
        resolution: row.resolution,
        credits: row.credits,
      })),
    };
  }
  return getKlingScenePricingSnapshot();
}
