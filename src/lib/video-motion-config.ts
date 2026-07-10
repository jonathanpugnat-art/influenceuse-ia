/** Motion-control reel routing (Kling reference video → character image). */

export type ReelMotionMode = "i2v" | "motion_control";

const DEFAULT_FAL_KLING_MOTION_MODEL =
  process.env.FAL_KLING_MOTION_MODEL?.trim() ||
  "fal-ai/kling-video/v2.6/standard/motion-control";

export function resolveFalKlingMotionModel(): string {
  return DEFAULT_FAL_KLING_MOTION_MODEL;
}

/** Use motion control when a persisted trend source MP4 is available. */
export function shouldUseMotionControl(opts: {
  motionSourceVideoUrl?: string | null;
  fromTrend?: boolean;
}): boolean {
  const url = opts.motionSourceVideoUrl?.trim();
  if (!url?.startsWith("http")) return false;
  if (/\.mp4(\?|$)/i.test(url)) return true;
  return opts.fromTrend === true && url.includes("/trend-video/");
}

export function resolveReelMotionMode(opts: {
  motionSourceVideoUrl?: string | null;
  fromTrend?: boolean;
}): ReelMotionMode {
  return shouldUseMotionControl(opts) ? "motion_control" : "i2v";
}
