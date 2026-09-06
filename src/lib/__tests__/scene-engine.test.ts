import { afterEach, describe, expect, it } from "vitest";
import { CREDIT_COSTS } from "@/lib/constants";
import {
  clampKlingSceneDuration,
  estimateKlingSceneCredits,
  getSceneEngine,
  getKlingScenePricingSnapshot,
  getScenePricingSnapshot,
  isKlingSceneEngine,
  isKlingSceneModelId,
  KLING_SCENE_ALLOWED_DURATIONS,
  KLING_SCENE_DEFAULT_MODEL,
} from "@/lib/scene-engine";

describe("getSceneEngine", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("defaults to kling_o3_i2v", () => {
    expect(getSceneEngine({})).toBe("kling_o3_i2v");
    expect(isKlingSceneEngine({})).toBe(true);
  });

  it("pauses Seedance unless SCENE_ENGINE=seedance", () => {
    expect(getSceneEngine({ SCENE_ENGINE: "seedance" })).toBe("seedance");
    expect(getSceneEngine({ SCENE_ENGINE: "kling_o3_i2v" })).toBe(
      "kling_o3_i2v"
    );
    expect(getSceneEngine({ SCENE_ENGINE: "unknown" })).toBe("kling_o3_i2v");
  });
});

describe("Kling scene credits + durations", () => {
  it("charges 8 cr/s audio off and 10 cr/s audio on", () => {
    expect(CREDIT_COSTS.KLING_SCENE_I2V_AUDIO_OFF_PER_SEC).toBe(8);
    expect(CREDIT_COSTS.KLING_SCENE_I2V_AUDIO_ON_PER_SEC).toBe(10);
    expect(estimateKlingSceneCredits(5, false)).toBe(40);
    expect(estimateKlingSceneCredits(10, false)).toBe(80);
    expect(estimateKlingSceneCredits(15, false)).toBe(120);
    expect(estimateKlingSceneCredits(5, true)).toBe(50);
    expect(estimateKlingSceneCredits(10, true)).toBe(100);
    expect(estimateKlingSceneCredits(15, true)).toBe(150);
  });

  it("only allows 5 / 10 / 15 — never 30", () => {
    expect([...KLING_SCENE_ALLOWED_DURATIONS]).toEqual([5, 10, 15]);
    expect(clampKlingSceneDuration(5)).toBe(5);
    expect(clampKlingSceneDuration(10)).toBe(10);
    expect(clampKlingSceneDuration(15)).toBe(15);
    expect(clampKlingSceneDuration(30)).toBe(15);
    expect(clampKlingSceneDuration(7)).toBe(5);
    expect(clampKlingSceneDuration(12)).toBe(10);
    expect(clampKlingSceneDuration(0)).toBe(5);
  });

  it("pricing snapshot has no 480p/720p and no 30s", () => {
    const snap = getKlingScenePricingSnapshot();
    expect(snap.engine).toBe("kling_o3_i2v");
    expect(snap.label).toBe("Vidéo scène (Kling)");
    expect(snap.allowedDurations).toEqual([5, 10, 15]);
    expect(snap.allowedResolutions).toEqual([]);
    expect(snap.matrix.some((m) => m.durationSec === 30)).toBe(false);
    expect(snap.matrix.some((m) => m.resolution === "480p")).toBe(false);
    expect(snap.matrix.some((m) => m.resolution === "720p")).toBe(false);
  });

  it("getScenePricingSnapshot follows the flag", () => {
    expect(getScenePricingSnapshot({}).engine).toBe("kling_o3_i2v");
    expect(getScenePricingSnapshot({ SCENE_ENGINE: "seedance" }).engine).toBe(
      "seedance"
    );
  });

  it("detects the Kling O3 I2V model id", () => {
    expect(isKlingSceneModelId(KLING_SCENE_DEFAULT_MODEL)).toBe(true);
    expect(
      isKlingSceneModelId("bytedance/seedance-2.5/image-to-video")
    ).toBe(false);
    expect(
      isKlingSceneModelId("fal-ai/kling-video/o3/standard/video-to-video/reference")
    ).toBe(false);
  });
});
