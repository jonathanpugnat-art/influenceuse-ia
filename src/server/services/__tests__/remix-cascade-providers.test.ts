import { describe, expect, it } from "vitest";
import { buildViggleRemixPayload } from "@/server/services/video-providers/viggle-remix.provider";
import { buildFalWanReplaceRemixPayload } from "@/server/services/video-providers/fal-wan-replace-remix.provider";

describe("Viggle remix payload", () => {
  it("sends image_url + motion_video_url", () => {
    const { payload } = buildViggleRemixPayload({
      videoUrl: "https://cdn.example/clip.mp4",
      frontalImageUrl: "https://cdn.example/front.jpg",
    });
    expect(payload).toEqual({
      image_url: "https://cdn.example/front.jpg",
      motion_video_url: "https://cdn.example/clip.mp4",
      background_mode: "original",
    });
  });
});

describe("Wan replace remix payload", () => {
  it("sends image_url + video_url on the Fal replace endpoint", () => {
    const { payload } = buildFalWanReplaceRemixPayload({
      videoUrl: "https://cdn.example/clip.mp4",
      frontalImageUrl: "https://cdn.example/front.jpg",
    });
    expect(payload.image_url).toBe("https://cdn.example/front.jpg");
    expect(payload.video_url).toBe("https://cdn.example/clip.mp4");
    expect(payload.resolution).toBe("480p");
  });
});
