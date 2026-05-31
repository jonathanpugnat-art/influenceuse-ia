import {
  DEFAULT_REPLICATE_PREMIUM_MODEL,
  resolvePremiumImageProviderMode,
  isPremiumSelfHostConfigured,
  isTogetherConfigured,
} from "@/lib/premium-image-config";
import {
  runSelfHostFluxBatch,
} from "@/server/services/image-providers/selfhost-flux.provider";
import {
  runTogetherFluxBatch,
  type TogetherFluxInput,
} from "@/server/services/image-providers/together-flux.provider";

export type PremiumFluxGenerationResult = {
  urls: string[];
  provider: "together" | "selfhost" | "replicate";
  model: string;
};

/**
 * Route Premium FLUX generation: Together → self-host → Replicate fallback.
 */
export async function runPremiumFluxWithFallback(
  input: TogetherFluxInput,
  count: number,
  replicateRunner: (
    input: TogetherFluxInput,
    count: number
  ) => Promise<{ urls: string[]; model: string }>
): Promise<PremiumFluxGenerationResult> {
  const mode = resolvePremiumImageProviderMode();
  const tryTogether =
    mode === "together" || (mode === "auto" && isTogetherConfigured());
  const trySelfHost =
    mode === "selfhost" ||
    (mode === "auto" && !tryTogether && isPremiumSelfHostConfigured());

  if (tryTogether) {
    try {
      const { urls, model } = await runTogetherFluxBatch(input, count);
      console.log(
        `[premium-flux] Generated ${urls.length} image(s) via Together (${model})`
      );
      return { urls, provider: "together", model };
    } catch (err) {
      if (mode === "together") throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[premium-flux] Together failed, trying fallback: ${msg.slice(0, 160)}`
      );
    }
  }

  if (trySelfHost || (mode === "auto" && isPremiumSelfHostConfigured())) {
    try {
      const { urls, model } = await runSelfHostFluxBatch(input, count);
      console.log(
        `[premium-flux] Generated ${urls.length} image(s) via self-host (${model})`
      );
      return { urls, provider: "selfhost", model };
    } catch (err) {
      if (mode === "selfhost") throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[premium-flux] Self-host failed, falling back to Replicate: ${msg.slice(0, 160)}`
      );
    }
  }

  const { urls, model } = await replicateRunner(input, count);
  console.log(
    `[premium-flux] Generated ${urls.length} image(s) via Replicate (${model})`
  );
  return {
    urls,
    provider: "replicate",
    model: model || DEFAULT_REPLICATE_PREMIUM_MODEL,
  };
}
