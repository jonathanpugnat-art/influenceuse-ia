import { resolveFalKlingMotionModel } from "@/lib/video-motion-config";
import { falQueueSubscribe } from "@/server/services/image-providers/fal-queue.client";
import { resolvePublicMediaUrl } from "@/server/lib/resolve-public-media-url";

export type FalKlingMotionInput = {
  /** Character still (influencer scene frame or portrait). */
  imageUrl: string;
  /** Reference trend MP4 with the motion to transfer. */
  referenceVideoUrl: string;
  prompt?: string;
  durationSec?: 5 | 10;
};

export function extractFalMotionVideoUrl(payload: unknown): string | null {
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

  return null;
}

/** Transfer motion from a reference video onto a character still (Kling Motion Control). */
export async function runFalKlingMotionControl(
  input: FalKlingMotionInput
): Promise<{ videoUrl: string; model: string }> {
  const model = resolveFalKlingMotionModel();
  const imageUrl = await resolvePublicMediaUrl(input.imageUrl.trim());
  const videoUrl = await resolvePublicMediaUrl(input.referenceVideoUrl.trim());

  if (!imageUrl) {
    throw new Error("Kling Motion Control requires a public character image URL.");
  }
  if (!videoUrl) {
    throw new Error("Kling Motion Control requires a public reference video URL.");
  }

  const falInput: Record<string, unknown> = {
    image_url: imageUrl,
    video_url: videoUrl,
    character_orientation: "image",
    duration: String(input.durationSec ?? 5),
  };

  const prompt = input.prompt?.trim();
  if (prompt) falInput.prompt = prompt;

  const result = await falQueueSubscribe(model, falInput, 420_000);
  const outUrl = extractFalMotionVideoUrl(result);
  if (!outUrl) {
    throw new Error("Kling Motion Control returned no video URL.");
  }

  return { videoUrl: outUrl, model };
}
