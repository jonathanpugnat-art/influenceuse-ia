import {
  isPremiumUpscaleEnabled,
  resolvePremiumUpscaleModel,
  resolvePremiumUpscaleScale,
} from "@/lib/premium-image-config";
import { runReplicatePrediction } from "@/server/services/image/replicate-runner";

/**
 * Optional finishing upscaler for Premium (NSFW) outputs.
 *
 * Uses a pure ESRGAN model by default (`nightmareai/real-esrgan`): it only
 * enlarges + sharpens, with no generative refine, so it never alters anatomy,
 * never drifts the face, and never trips a content filter. Fail-open: on any
 * error the original URL is returned so a bad upscale can't drop a delivered
 * image. No-op unless PREMIUM_UPSCALE is enabled.
 */
export async function upscalePremiumImages(urls: string[]): Promise<string[]> {
  if (!isPremiumUpscaleEnabled() || urls.length === 0) {
    return urls;
  }

  const model = resolvePremiumUpscaleModel();
  const scale = resolvePremiumUpscaleScale();

  return Promise.all(
    urls.map(async (url) => {
      try {
        const out = await runReplicatePrediction(
          model,
          { image: url, scale, face_enhance: false },
          false
        );
        return out[0] ?? url;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[ai-image] Upscale failed (${msg.slice(0, 120)}), keeping original image.`
        );
        return url;
      }
    })
  );
}
