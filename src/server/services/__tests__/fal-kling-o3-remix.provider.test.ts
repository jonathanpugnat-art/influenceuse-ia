import { describe, expect, it } from "vitest";
import { buildFalKlingO3RemixPayload } from "@/server/services/video-providers/fal-kling-o3-remix.provider";

describe("buildFalKlingO3RemixPayload", () => {
  const base = {
    videoUrl: "https://cdn.example/src.mp4",
    frontalImageUrl: "https://cdn.example/front.jpg",
    referenceImageUrls: ["https://cdn.example/34.jpg"],
    duration: 10 as const,
    keepAudio: true,
    characterName: "Ava",
  };

  it("emits the exact Kling remix payload shape", () => {
    const { payload, prompt } = buildFalKlingO3RemixPayload(base);
    expect(payload.prompt).toBe(prompt);
    expect(payload.video_url).toBe(base.videoUrl);
    expect(payload.aspect_ratio).toBe("9:16");
    expect(payload.duration).toBe("10");
    expect(payload.keep_audio).toBe(true);
    expect(Array.isArray(payload.elements)).toBe(true);
    const elements = payload.elements as Array<Record<string, unknown>>;
    expect(elements).toHaveLength(1);
    expect(elements[0].frontal_image_url).toBe(base.frontalImageUrl);
    expect(elements[0].reference_image_urls).toEqual(base.referenceImageUrls);
  });

  it("throws when the source video is not http-accessible", () => {
    expect(() =>
      buildFalKlingO3RemixPayload({ ...base, videoUrl: "file://tmp/x.mp4" })
    ).toThrow(/public source video/i);
  });

  it("appends the extra prompt tail when provided", () => {
    const { prompt } = buildFalKlingO3RemixPayload({
      ...base,
      extraPromptTail: "warm sunset lighting",
    });
    expect(prompt).toMatch(/warm sunset lighting/);
  });

  it("stringifies duration to a Kling-accepted literal", () => {
    const { payload } = buildFalKlingO3RemixPayload({ ...base, duration: 5 });
    expect(payload.duration).toBe("5");
  });

  it("keeps aspect_ratio locked to 9:16 (V1 PRD)", () => {
    const { payload } = buildFalKlingO3RemixPayload({ ...base, duration: 15 });
    expect(payload.aspect_ratio).toBe("9:16");
  });

  it("passes keep_audio=false when the user opts out", () => {
    const { payload } = buildFalKlingO3RemixPayload({ ...base, keepAudio: false });
    expect(payload.keep_audio).toBe(false);
  });
});
