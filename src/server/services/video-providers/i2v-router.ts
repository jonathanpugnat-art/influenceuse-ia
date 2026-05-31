import {
  resolveVideoI2vProviderMode,
  shouldTryFalKlingI2v,
} from "@/lib/video-i2v-config";
import type { ReelStylePreset } from "@/lib/prompts/video-prompts";
import {
  runFalKlingI2v,
  type FalKlingI2vInput,
} from "@/server/services/video-providers/fal-kling-i2v.provider";

export type I2vGenerationResult = {
  videoUrl: string;
  provider: "fal" | "replicate";
  model: string;
};

export async function runReelI2vWithFallback(opts: {
  preset: ReelStylePreset;
  hasStartFrame: boolean;
  falInput: FalKlingI2vInput;
  replicateRunner: () => Promise<{ videoUrl: string; model: string }>;
}): Promise<I2vGenerationResult> {
  const mode = resolveVideoI2vProviderMode();
  const tryFal = shouldTryFalKlingI2v({
    preset: opts.preset,
    hasStartFrame: opts.hasStartFrame,
  });

  if (tryFal) {
    try {
      const { videoUrl, model } = await runFalKlingI2v(opts.falInput);
      console.log(`[i2v] Reel generated via FAL (${model})`);
      return { videoUrl, provider: "fal", model };
    } catch (err) {
      if (mode === "fal") throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[i2v] FAL Kling failed, falling back to Replicate: ${msg.slice(0, 160)}`);
    }
  }

  const { videoUrl, model } = await opts.replicateRunner();
  console.log(`[i2v] Reel generated via Replicate (${model})`);
  return { videoUrl, provider: "replicate", model };
}
