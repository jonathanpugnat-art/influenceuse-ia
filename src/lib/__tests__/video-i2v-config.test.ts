import { describe, it, expect } from "vitest";
import {
  DEFAULT_FAL_KLING_I2V_MODEL,
  FAL_KLING_ELIGIBLE_PRESETS,
  resolveFalKlingI2vModel,
  resolveVideoI2vProviderMode,
  shouldRoutePresetToFalKling,
  shouldTryFalKlingI2v,
} from "@/lib/video-i2v-config";
import { extractFalVideoUrl } from "@/server/services/video-providers/fal-kling-i2v.provider";

describe("video-i2v-config", () => {
  it("defaults to auto provider mode", () => {
    expect(resolveVideoI2vProviderMode({})).toBe("auto");
  });

  it("routes eligible presets to FAL when key is set", () => {
    expect(shouldRoutePresetToFalKling("natural_motion")).toBe(true);
    expect(shouldRoutePresetToFalKling("creative")).toBe(false);
    expect(
      shouldTryFalKlingI2v({
        preset: "stable_face",
        hasStartFrame: true,
        env: { FAL_KEY: "secret", VIDEO_I2V_PROVIDER: "auto" },
      })
    ).toBe(true);
  });

  it("skips FAL without start frame or key", () => {
    expect(
      shouldTryFalKlingI2v({
        preset: "natural_motion",
        hasStartFrame: false,
        env: { FAL_KEY: "secret" },
      })
    ).toBe(false);
    expect(
      shouldTryFalKlingI2v({
        preset: "natural_motion",
        hasStartFrame: true,
        env: {},
      })
    ).toBe(false);
  });

  it("lists standard motion presets as FAL-eligible", () => {
    expect(FAL_KLING_ELIGIBLE_PRESETS).toContain("lip_sync");
    expect(FAL_KLING_ELIGIBLE_PRESETS).not.toContain("creative");
  });

  it("falls back to default Kling model id", () => {
    expect(resolveFalKlingI2vModel({})).toBe(DEFAULT_FAL_KLING_I2V_MODEL);
  });
});

describe("extractFalVideoUrl", () => {
  it("reads nested video.url", () => {
    expect(
      extractFalVideoUrl({
        video: { url: "https://fal.media/files/reel.mp4" },
      })
    ).toBe("https://fal.media/files/reel.mp4");
  });
});
