import {
  resolveVideoI2vProviderMode,
  shouldTryFalKlingI2v,
} from "@/lib/video-i2v-config";
import { shouldUseMotionControl } from "@/lib/video-motion-config";
import type { ReelStylePreset } from "@/lib/prompts/video-prompts";
import {
  runFalKlingI2v,
  type FalKlingI2vInput,
} from "@/server/services/video-providers/fal-kling-i2v.provider";
import {
  runFalKlingMotionControl,
  type FalKlingMotionInput,
} from "@/server/services/video-providers/kling-motion.provider";

export type I2vGenerationResult = {
  videoUrl: string;
  provider: "fal" | "replicate";
  model: string;
  motionMode?: "i2v" | "motion_control";
};

export async function runReelI2vWithFallback(opts: {
  preset: ReelStylePreset;
  hasStartFrame: boolean;
  falInput: FalKlingI2vInput;
  motionInput?: FalKlingMotionInput;
  fromTrend?: boolean;
  replicateRunner: () => Promise<{ videoUrl: string; model: string }>;
}): Promise<I2vGenerationResult> {
  const mode = resolveVideoI2vProviderMode();
  const tryMotion =
    opts.motionInput &&
    shouldUseMotionControl({
      motionSourceVideoUrl: opts.motionInput.referenceVideoUrl,
      fromTrend: opts.fromTrend,
    });

  if (tryMotion && opts.motionInput) {
    try {
      const { videoUrl, model } = await runFalKlingMotionControl(opts.motionInput);
      console.log(`[i2v] Reel generated via FAL motion control (${model})`);
      return {
        videoUrl,
        provider: "fal",
        model,
        motionMode: "motion_control",
      };
    } catch (err) {
      if (mode === "fal") {
        console.warn(
          `[i2v] Motion control failed, falling back to I2V: ${
            err instanceof Error ? err.message : err
          }`
        );
      }
    }
  }

  const tryFal = shouldTryFalKlingI2v({
    preset: opts.preset,
    hasStartFrame: opts.hasStartFrame,
  });

  if (tryFal) {
    try {
      const { videoUrl, model } = await runFalKlingI2v(opts.falInput);
      console.log(`[i2v] Reel generated via FAL (${model})`);
      return {
        videoUrl,
        provider: "fal",
        model,
        motionMode: "i2v",
      };
    } catch (err) {
      if (mode === "fal") throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[i2v] FAL Kling failed, falling back to Replicate: ${msg.slice(0, 160)}`);
    }
  }

  const { videoUrl, model } = await opts.replicateRunner();
  console.log(`[i2v] Reel generated via Replicate (${model})`);
  return { videoUrl, provider: "replicate", model, motionMode: "i2v" };
}
