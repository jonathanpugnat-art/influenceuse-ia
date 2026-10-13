import {
  createPrediction,
  type ReplicatePrediction,
  ReplicateError,
} from "@/lib/replicate/client";
import { VIDEO_DURATION_SECONDS, VIDEO_NEGATIVE_PROMPT } from "@/lib/motion-prompts";

export const KLING_MODEL = "kwaivgi/kling-v2.5-turbo-pro";
export const SEEDANCE_MODEL = "bytedance/seedance-1-pro";

export type VideoProviderModel = typeof KLING_MODEL | typeof SEEDANCE_MODEL;

export async function createVideoPrediction(input: {
  startImageUrl: string;
  prompt: string;
  webhook?: string;
  prefer?: VideoProviderModel;
}): Promise<{ prediction: ReplicatePrediction; model: VideoProviderModel }> {
  const primary = input.prefer ?? KLING_MODEL;
  const fallback: VideoProviderModel =
    primary === KLING_MODEL ? SEEDANCE_MODEL : KLING_MODEL;

  try {
    const prediction = await createPrediction({
      model: primary,
      webhook: input.webhook,
      body: buildBody(primary, input.startImageUrl, input.prompt),
    });
    return { prediction, model: primary };
  } catch (error) {
    if (error instanceof ReplicateError && !error.retriable && error.code === "missing_key") {
      throw error;
    }
    console.error("video primary failed, trying fallback", primary, error);
    const prediction = await createPrediction({
      model: fallback,
      webhook: input.webhook,
      body: buildBody(fallback, input.startImageUrl, input.prompt),
    });
    return { prediction, model: fallback };
  }
}

function buildBody(
  model: VideoProviderModel,
  startImageUrl: string,
  prompt: string,
): Record<string, unknown> {
  switch (model) {
    case KLING_MODEL:
      return {
        prompt,
        start_image: startImageUrl,
        duration: VIDEO_DURATION_SECONDS,
        negative_prompt: VIDEO_NEGATIVE_PROMPT,
      };
    case SEEDANCE_MODEL:
      return {
        prompt,
        image: startImageUrl,
        duration: VIDEO_DURATION_SECONDS,
        resolution: "480p",
        camera_fixed: false,
      };
    default: {
      const exhaustive: never = model;
      return exhaustive;
    }
  }
}
