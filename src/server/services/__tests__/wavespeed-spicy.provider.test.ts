import { describe, expect, it } from "vitest";
import { buildWavespeedSpicyPayload } from "@/server/services/video-providers/wavespeed-spicy.provider";

describe("buildWavespeedSpicyPayload", () => {
  it("posts image + prompt + 5/8s + 480p/720p to the official spicy I2V id", () => {
    const built = buildWavespeedSpicyPayload(
      {
        imageUrl: "https://cdn.example.com/char.jpg",
        prompt: "slow turn toward camera",
        duration: 5,
        resolution: "480p",
      },
      {}
    );
    expect(built.modelId).toBe("wavespeed-ai/wan-2.2-spicy/image-to-video");
    expect(built.submitUrl).toBe(
      "https://api.wavespeed.ai/api/v3/wavespeed-ai/wan-2.2-spicy/image-to-video"
    );
    expect(built.payload).toEqual({
      prompt: "slow turn toward camera",
      image: "https://cdn.example.com/char.jpg",
      resolution: "480p",
      duration: 5,
    });
  });

  it("adds callback only when a webhook URL is provided", () => {
    const built = buildWavespeedSpicyPayload({
      imageUrl: "https://cdn.example.com/char.jpg",
      prompt: "motion",
      duration: 8,
      resolution: "720p",
      callbackUrl: "https://www.aurainfluenceai.com/api/webhooks/wavespeed-spicy",
    });
    expect(built.payload.callback).toContain("/api/webhooks/wavespeed-spicy");
    expect(built.payload.duration).toBe(8);
    expect(built.payload.resolution).toBe("720p");
  });
});
