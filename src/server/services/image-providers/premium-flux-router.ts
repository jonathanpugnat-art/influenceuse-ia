import {
  isPremiumSelfHostConfigured,
  isReplicatePremiumConfigured,
  isTogetherConfigured,
  resolvePremiumImageProviderMode,
  resolveReplicatePremiumModel,
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

function formatProviderError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Route Premium FLUX generation — uncensored first.
 * Auto priority: self-host GPU (ComfyUI) → Replicate uncensored → Together.
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
  let lastError: unknown;

  const runReplicate = async (): Promise<PremiumFluxGenerationResult> => {
    const { urls, model } = await replicateRunner(input, count);
    console.log(
      `[premium-flux] Generated ${urls.length} image(s) via Replicate uncensored (${model})`
    );
    return {
      urls,
      provider: "replicate",
      model: model || resolveReplicatePremiumModel(),
    };
  };

  const runSelfHost = async (): Promise<PremiumFluxGenerationResult> => {
    const { urls, model } = await runSelfHostFluxBatch(input, count);
    console.log(
      `[premium-flux] Generated ${urls.length} image(s) via self-host (${model})`
    );
    return { urls, provider: "selfhost", model };
  };

  const runTogether = async (): Promise<PremiumFluxGenerationResult> => {
    const { urls, model } = await runTogetherFluxBatch(input, count, {
      premium: true,
    });
    console.log(
      `[premium-flux] Generated ${urls.length} image(s) via Together (${model})`
    );
    return { urls, provider: "together", model };
  };

  if (mode === "replicate") {
    if (!isReplicatePremiumConfigured()) {
      throw new Error(
        "PREMIUM_IMAGE_PROVIDER=replicate but REPLICATE_API_TOKEN is missing."
      );
    }
    return runReplicate();
  }

  if (mode === "selfhost") {
    if (!isPremiumSelfHostConfigured()) {
      throw new Error(
        "PREMIUM_IMAGE_PROVIDER=selfhost but PREMIUM_SELFHOST_URL is missing."
      );
    }
    return runSelfHost();
  }

  if (mode === "together") {
    if (!isTogetherConfigured()) {
      throw new Error(
        "PREMIUM_IMAGE_PROVIDER=together but TOGETHER_API_KEY is missing."
      );
    }
    return runTogether();
  }

  // auto — self-host GPU first (pro uncensored / ComfyUI), then Replicate, then Together
  if (isPremiumSelfHostConfigured()) {
    try {
      return await runSelfHost();
    } catch (err) {
      lastError = err;
      console.warn(
        `[premium-flux] Self-host failed, trying Replicate: ${formatProviderError(err).slice(0, 160)}`
      );
    }
  }

  if (isReplicatePremiumConfigured()) {
    try {
      return await runReplicate();
    } catch (err) {
      lastError = err;
      console.warn(
        `[premium-flux] Replicate uncensored failed, trying Together: ${formatProviderError(err).slice(0, 160)}`
      );
    }
  }

  if (isTogetherConfigured()) {
    try {
      return await runTogether();
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) {
    throw lastError instanceof Error ? lastError : new Error(formatProviderError(lastError));
  }

  throw new Error(
    "Premium image generation is not configured. Set REPLICATE_API_TOKEN (recommended), " +
      "or PREMIUM_SELFHOST_URL, or TOGETHER_API_KEY + PREMIUM_TOGETHER_FLUX_MODEL."
  );
}
