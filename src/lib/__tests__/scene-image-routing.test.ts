import { describe, expect, it } from "vitest";
import {
  appendSceneNegativeTerms,
  resolveSceneRoute,
} from "@/lib/scene-image-routing";

describe("scene-image-routing", () => {
  it("routes indoor locker gym with anti-outdoor negatives and lower loraScale", () => {
    const route = resolveSceneRoute({
      scene: "gym",
      sceneDescription:
        "Indoor gym locker room mirror selfie, fluorescent lights, metal lockers",
      pose: "selfie",
      hasLora: true,
    });
    expect(route.environment).toBe("indoor");
    expect(route.mirrorSelfie).toBe(true);
    expect(route.loraScale).toBeLessThanOrEqual(0.72);
    expect(route.negativeSceneTerms).toEqual(
      expect.arrayContaining(["outdoor", "beach", "golden hour"])
    );
  });

  it("routes Paris café terrace as outdoor with anti-indoor negatives", () => {
    const route = resolveSceneRoute({
      scene: "cafe",
      sceneDescription:
        "Outdoor Paris café terrace, cappuccino on bistro table, Haussmann buildings",
      hasLora: true,
    });
    expect(route.environment).toBe("outdoor");
    expect(route.negativeSceneTerms).toEqual(
      expect.arrayContaining(["indoor", "bedroom", "locker room"])
    );
    expect(route.loraScale).toBeGreaterThanOrEqual(0.75);
  });

  it("adds anti-daylight negatives for rooftop at night", () => {
    const route = resolveSceneRoute({
      scene: "rooftop",
      sceneDescription:
        "Rooftop bar at night, city skyline, black dress, neon lights at night",
      hasLora: true,
    });
    expect(route.environment).toBe("outdoor");
    expect(route.negativeSceneTerms).toEqual(
      expect.arrayContaining(["golden hour", "daylight"])
    );
    expect(route.loraScale).toBe(0.7);
  });

  it("lowers loraScale further when trend brief is present", () => {
    const withoutBrief = resolveSceneRoute({
      sceneDescription: "Cozy bedroom mirror selfie, morning light through curtains",
      hasLora: true,
    });
    const withBrief = resolveSceneRoute({
      sceneDescription: "Cozy bedroom mirror selfie, morning light through curtains",
      hasLora: true,
      trendBrief: {
        mood: "soft morning",
        cameraStyle: "iPhone front camera",
        inspirationNotes: "GRWM pacing",
      },
    });
    expect(withBrief.loraScale).toBeLessThanOrEqual(withoutBrief.loraScale);
  });

  it("prefers Kontext when LORA_SKIP_COMPLEX_SCENES is set", () => {
    const prev = process.env.LORA_SKIP_COMPLEX_SCENES;
    process.env.LORA_SKIP_COMPLEX_SCENES = "true";
    try {
      const route = resolveSceneRoute({
        sceneDescription: "Beach sunset walk on the sand",
        hasLora: true,
      });
      expect(route.preferKontextOverLora).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.LORA_SKIP_COMPLEX_SCENES;
      else process.env.LORA_SKIP_COMPLEX_SCENES = prev;
    }
  });

  it("appendSceneNegativeTerms merges without duplicating base", () => {
    expect(
      appendSceneNegativeTerms("blurry, watermark", ["outdoor", "beach"])
    ).toBe("blurry, watermark, outdoor, beach");
  });

  const benchScenes = [
    { label: "gym locker", scene: "gym", text: "indoor gym locker room mirror", env: "indoor" },
    { label: "bedroom", scene: "bedroom", text: "cozy bedroom morning light", env: "indoor" },
    { label: "bathroom", scene: "bedroom", text: "luxury hotel bathroom marble tiles", env: "indoor" },
    { label: "yoga studio", scene: "studio", text: "indoor yoga studio with mirror wall", env: "indoor" },
    { label: "café terrace", scene: "cafe", text: "outdoor café terrace paris", env: "outdoor" },
    { label: "beach", scene: "beach", text: "sandy beach ocean waves sunset", env: "outdoor" },
    { label: "rooftop day", scene: "rooftop", text: "rooftop pool sunny afternoon skyline", env: "outdoor" },
    { label: "urban street", scene: "urban", text: "city sidewalk street style", env: "outdoor" },
    { label: "nature trail", scene: "nature", text: "forest trail nature hike", env: "outdoor" },
    { label: "restaurant", scene: "restaurant", text: "indoor restaurant candlelit dinner", env: "indoor" },
    { label: "pool outdoor", scene: "pool", text: "outdoor resort pool palm trees", env: "outdoor" },
    { label: "home kitchen", scene: "studio", text: "bright kitchen interior cooking", env: "indoor" },
    { label: "office", scene: "studio", text: "modern office interior desk", env: "indoor" },
    { label: "park", scene: "nature", text: "city park outdoor picnic", env: "outdoor" },
    { label: "dressing room", scene: "bedroom", text: "boutique dressing room mirror", env: "indoor" },
    { label: "metro", scene: "urban", text: "underground metro station indoor", env: "indoor" },
    { label: "balcony", scene: "rooftop", text: "apartment balcony outdoor plants", env: "outdoor" },
    { label: "spa", scene: "studio", text: "indoor spa wellness room", env: "indoor" },
    { label: "vineyard", scene: "nature", text: "outdoor vineyard rows golden hour", env: "outdoor" },
    { label: "snow street", scene: "urban", text: "snowy city street outdoor winter", env: "outdoor" },
  ] as const;

  it.each(benchScenes)(
    "bench $label → $env",
    ({ scene, text, env }) => {
      const route = resolveSceneRoute({
        scene,
        sceneDescription: text,
        hasLora: true,
      });
      expect(route.environment).toBe(env);
    }
  );
});
