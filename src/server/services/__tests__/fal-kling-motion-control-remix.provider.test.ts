import { describe, expect, it } from "vitest";
import {
  buildFalKlingMotionControlRemixPayload,
  buildFalKlingO1V2vEditPayload,
} from "@/server/services/video-providers/fal-kling-motion-control-remix.provider";
import { REMIX_O1_EDIT_PROMPT } from "@/lib/remix-engine";

describe("buildFalKlingMotionControlRemixPayload", () => {
  const base = {
    videoUrl: "https://cdn.example/clip.mp4",
    frontalImageUrl: "https://cdn.example/front.jpg",
    referenceImageUrls: ["https://cdn.example/34.jpg"],
    orientation: "video" as const,
    keepAudio: true,
    characterName: "Ava",
  };

  it("uses image_url + video_url on the V3 motion-control payload", () => {
    const { payload } = buildFalKlingMotionControlRemixPayload(base);
    expect(payload.image_url).toBe(base.frontalImageUrl);
    expect(payload.video_url).toBe(base.videoUrl);
    expect(payload.character_orientation).toBe("video");
    expect(payload.keep_original_sound).toBe(true);
    expect(payload).not.toHaveProperty("video");
    expect(payload).not.toHaveProperty("start_image_url");
    const elements = payload.elements as Array<Record<string, unknown>>;
    expect(elements).toHaveLength(1);
    expect(elements[0].frontal_image_url).toBe(base.frontalImageUrl);
    expect(elements[0].reference_image_urls).toEqual(base.referenceImageUrls);
  });

  it("omits face elements on v2.6 even when orientation is video", () => {
    const { payload } = buildFalKlingMotionControlRemixPayload({
      ...base,
      includeFaceElement: false,
    });
    expect(payload.image_url).toBe(base.frontalImageUrl);
    expect(payload.video_url).toBe(base.videoUrl);
    expect(payload.character_orientation).toBe("video");
    expect(payload.elements).toBeUndefined();
  });

  it("omits face elements when orientation is image (camera)", () => {
    const { payload } = buildFalKlingMotionControlRemixPayload({
      ...base,
      orientation: "image",
    });
    expect(payload.character_orientation).toBe("image");
    expect(payload.elements).toBeUndefined();
  });

  it("passes keep_original_sound=false when the user opts out", () => {
    const { payload } = buildFalKlingMotionControlRemixPayload({
      ...base,
      keepAudio: false,
    });
    expect(payload.keep_original_sound).toBe(false);
  });

  it("throws without a public character image", () => {
    expect(() =>
      buildFalKlingMotionControlRemixPayload({
        ...base,
        frontalImageUrl: "file://tmp/x.jpg",
      })
    ).toThrow(/character image/i);
  });
});

describe("buildFalKlingO1V2vEditPayload", () => {
  it("binds @Element1 to the character still and keeps motion", () => {
    const { payload, prompt } = buildFalKlingO1V2vEditPayload({
      videoUrl: "https://cdn.example/clip.mp4",
      frontalImageUrl: "https://cdn.example/front.jpg",
      keepAudio: true,
    });
    expect(prompt).toBe(REMIX_O1_EDIT_PROMPT);
    expect(payload.prompt).toBe(
      "Replace the character with @Element1 keeping same motion"
    );
    expect(payload.video_url).toBe("https://cdn.example/clip.mp4");
    expect(payload.keep_audio).toBe(true);
    const elements = payload.elements as Array<Record<string, unknown>>;
    expect(elements[0].frontal_image_url).toBe("https://cdn.example/front.jpg");
  });
});
