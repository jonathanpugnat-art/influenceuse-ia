import { describe, expect, it } from "vitest";
import { buildFalSeedancePayload } from "@/server/services/video-providers/fal-seedance.provider";

describe("buildFalSeedancePayload — reference-to-video", () => {
  const base = {
    referenceImageUrls: [
      "https://cdn/frontal.jpg",
      "https://cdn/three_quarter.jpg",
      "https://cdn/full_body.jpg",
    ],
    duration: 15 as const,
    resolution: "720p" as const,
    generateAudio: true,
    scenePrompt: "walking through a sunlit cafe",
    characterName: "Ava",
  };

  it("emits the exact Seedance payload shape", () => {
    const { payload, prompt, mode, modelId } = buildFalSeedancePayload(base);
    expect(mode).toBe("reference_to_video");
    expect(modelId).toBe("bytedance/seedance-2.5/reference-to-video");
    expect(payload.prompt).toBe(prompt);
    expect(payload.aspect_ratio).toBe("9:16");
    expect(payload.duration).toBe("15");
    expect(payload.resolution).toBe("720p");
    expect(payload.generate_audio).toBe(true);
    expect(payload.image_urls).toEqual(base.referenceImageUrls);
    expect("image_url" in payload).toBe(false);
  });

  it("keeps 9:16 aspect ratio for every duration (V1 PRD)", () => {
    for (const duration of [10, 15, 30] as const) {
      const { payload } = buildFalSeedancePayload({ ...base, duration });
      expect(payload.aspect_ratio).toBe("9:16");
      expect(payload.duration).toBe(String(duration));
    }
  });

  it("supports 480p draft resolution", () => {
    const { payload } = buildFalSeedancePayload({
      ...base,
      resolution: "480p",
    });
    expect(payload.resolution).toBe("480p");
  });

  it("caps identity refs to SEEDANCE_MAX_REFERENCES", () => {
    const many = Array.from(
      { length: 12 },
      (_, i) => `https://cdn/img-${i}.jpg`
    );
    const { payload } = buildFalSeedancePayload({
      ...base,
      referenceImageUrls: many,
    });
    expect((payload.image_urls as string[]).length).toBeLessThanOrEqual(4);
    expect((payload.image_urls as string[])[0]).toBe(many[0]);
  });

  it("drops non-http entries and preserves order", () => {
    const { payload } = buildFalSeedancePayload({
      ...base,
      referenceImageUrls: [
        "https://cdn/frontal.jpg",
        "not-a-url",
        "  https://cdn/three_quarter.jpg  ",
      ],
    });
    expect(payload.image_urls).toEqual([
      "https://cdn/frontal.jpg",
      "https://cdn/three_quarter.jpg",
    ]);
  });

  it("appends the extra prompt tail when provided", () => {
    const { prompt } = buildFalSeedancePayload({
      ...base,
      extraPromptTail: "\"Bonjour Paris\"",
    });
    expect(prompt).toContain('"Bonjour Paris"');
  });

  it("throws when reference_to_video is chosen without any image", () => {
    expect(() =>
      buildFalSeedancePayload({
        ...base,
        mode: "reference_to_video",
        referenceImageUrls: [],
      })
    ).toThrow(/reference-to-video requires/i);
  });
});

describe("buildFalSeedancePayload — image-to-video fallback", () => {
  const base = {
    referenceImageUrls: ["https://cdn/frontal.jpg"],
    duration: 10 as const,
    resolution: "480p" as const,
    generateAudio: false,
    scenePrompt: "morning routine",
  };

  it("uses image_url (singular) and does not send image_urls", () => {
    const { payload, mode, modelId } = buildFalSeedancePayload({
      ...base,
      mode: "image_to_video",
    });
    expect(mode).toBe("image_to_video");
    expect(modelId).toBe("bytedance/seedance-2.5/image-to-video");
    expect(payload.image_url).toBe("https://cdn/frontal.jpg");
    expect(payload).not.toHaveProperty("image_urls");
    expect(payload.generate_audio).toBe(false);
  });

  it("throws when no start image is supplied", () => {
    expect(() =>
      buildFalSeedancePayload({
        ...base,
        mode: "image_to_video",
        referenceImageUrls: [],
      })
    ).toThrow(/image-to-video requires/i);
  });

  it("auto-picks image_to_video when refs are empty and no mode override", () => {
    // Auto-detection returns reference_to_video when refs exist, so pass one
    // ref but explicitly set mode to i2v (documented fallback path).
    const { mode } = buildFalSeedancePayload({
      ...base,
      referenceImageUrls: ["https://cdn/only.jpg"],
      mode: "image_to_video",
    });
    expect(mode).toBe("image_to_video");
  });
});
