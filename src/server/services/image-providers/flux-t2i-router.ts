import {
  isFalImageConfigured,
  resolveImageT2iProviderMode,
} from "@/lib/image-t2i-config";
import {
  runFalFluxT2iBatch,
  type FalFluxT2iInput,
} from "@/server/services/image-providers/fal-flux-t2i.provider";

export type FluxT2iGenerationResult = {
  urls: string[];
  provider: "fal" | "replicate";
  model: string;
};

/**
 * Route FLUX T2I generation: FAL first (when configured), Replicate fallback.
 * Nano / Kontext / NSFW stay on Replicate — only pure T2I uses this router.
 */
export async function runFluxT2iWithFallback(
  input: FalFluxT2iInput,
  count: number,
  replicateRunner: (
    input: FalFluxT2iInput,
    count: number
  ) => Promise<{ urls: string[]; model: string }>
): Promise<FluxT2iGenerationResult> {
  const mode = resolveImageT2iProviderMode();
  const tryFal = mode === "fal" || (mode === "auto" && isFalImageConfigured());

  if (tryFal) {
    try {
      const { urls, model } = await runFalFluxT2iBatch(input, count);
      console.log(`[flux-t2i] Generated ${urls.length} image(s) via FAL (${model})`);
      return { urls, provider: "fal", model };
    } catch (err) {
      if (mode === "fal") throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[flux-t2i] FAL failed, falling back to Replicate: ${msg.slice(0, 160)}`);
    }
  }

  const { urls, model } = await replicateRunner(input, count);
  console.log(`[flux-t2i] Generated ${urls.length} image(s) via Replicate (${model})`);
  return { urls, provider: "replicate", model };
}
