import { resolveFalKlingI2vModel } from "@/lib/video-i2v-config";
import { falQueueSubscribe } from "@/server/services/image-providers/fal-queue.client";

export type FalKlingI2vInput = {
  prompt: string;
  startImageUrl: string;
  durationSec: 5 | 10;
  negativePrompt?: string;
};

const VIDEO_NEGATIVE_DEFAULT =
  "blur, distort, low quality, plastic skin, doll face, morphing face, text on screen, watermark";

export function extractFalVideoUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;

  const video = data.video;
  if (video && typeof video === "object") {
    const url = (video as Record<string, unknown>).url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }

  if (typeof data.video_url === "string" && data.video_url.startsWith("http")) {
    return data.video_url;
  }

  const videos = data.videos;
  if (Array.isArray(videos)) {
    for (const item of videos) {
      if (typeof item === "string" && item.startsWith("http")) return item;
      if (item && typeof item === "object") {
        const url = (item as Record<string, unknown>).url;
        if (typeof url === "string" && url.startsWith("http")) return url;
      }
    }
  }

  return null;
}

/** Image→video via FAL Kling v3 Standard. */
export async function runFalKlingI2v(
  input: FalKlingI2vInput
): Promise<{ videoUrl: string; model: string }> {
  const model = resolveFalKlingI2vModel();
  const start = input.startImageUrl.trim();
  if (!start.startsWith("http")) {
    throw new Error("FAL Kling requires a public start_image_url");
  }

  const falInput: Record<string, unknown> = {
    prompt: input.prompt.trim(),
    start_image_url: start,
    duration: String(input.durationSec),
    generate_audio: false,
    negative_prompt: input.negativePrompt?.trim() || VIDEO_NEGATIVE_DEFAULT,
    cfg_scale: 0.5,
  };

  const result = await falQueueSubscribe(model, falInput, 300_000);
  const videoUrl = extractFalVideoUrl(result);
  if (!videoUrl) {
    throw new Error("FAL Kling returned no video URL");
  }

  return { videoUrl, model };
}
