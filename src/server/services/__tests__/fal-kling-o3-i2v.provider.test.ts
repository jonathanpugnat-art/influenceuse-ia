import { describe, expect, it } from "vitest";
import { buildFalKlingO3I2vPayload } from "@/server/services/video-providers/fal-kling-o3-i2v.provider";
import { KLING_SCENE_DEFAULT_MODEL } from "@/lib/scene-engine";

describe("buildFalKlingO3I2vPayload", () => {
  const base = {
    imageUrl: "https://cdn.example.com/luana-front.jpg",
    prompt: "walking through a sunlit cafe, looking at camera",
    duration: 5 as const,
    generateAudio: false,
  };

  it("emits a single image_url I2V payload — no Seedance refs or resolution", () => {
    const { payload, modelId, prompt } = buildFalKlingO3I2vPayload(base);
    expect(modelId).toBe(KLING_SCENE_DEFAULT_MODEL);
    expect(payload.prompt).toBe(prompt);
    expect(payload.image_url).toBe(base.imageUrl);
    expect(payload.duration).toBe("5");
    expect(payload.generate_audio).toBe(false);
    expect("image_urls" in payload).toBe(false);
    expect("reference_urls" in payload).toBe(false);
    expect("resolution" in payload).toBe(false);
    expect("end_image_url" in payload).toBe(false);
    expect("multi_prompt" in payload).toBe(false);
  });

  it("serializes duration as 5 | 10 | 15 strings and toggles audio", () => {
    for (const duration of [5, 10, 15] as const) {
      const { payload } = buildFalKlingO3I2vPayload({
        ...base,
        duration,
        generateAudio: true,
      });
      expect(payload.duration).toBe(String(duration));
      expect(payload.generate_audio).toBe(true);
    }
  });

  it("rejects a missing public image_url", () => {
    expect(() =>
      buildFalKlingO3I2vPayload({ ...base, imageUrl: "not-a-url" })
    ).toThrow(/image_url/);
  });

  it("rejects an empty prompt", () => {
    expect(() =>
      buildFalKlingO3I2vPayload({ ...base, prompt: "   " })
    ).toThrow(/prompt/);
  });
});
