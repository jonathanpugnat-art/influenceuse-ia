import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFalQueue = vi.hoisted(() => ({
  falQueueSubscribe: vi.fn(),
  isFalKeyConfigured: vi.fn(() => true),
  getFalKey: vi.fn(() => "test-key"),
}));

vi.mock("@/server/services/image-providers/fal-queue.client", () => mockFalQueue);

import {
  DEFAULT_FAL_KONTEXT_MODEL,
  isFalKontextFallbackEnabled,
  resolveFalKontextModel,
  runFalKontextSingle,
} from "@/server/services/image-providers/fal-kontext.provider";

describe("fal-kontext.provider", () => {
  const envBackup = process.env.IMAGE_T2I_PROVIDER;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFalQueue.isFalKeyConfigured.mockReturnValue(true);
    delete process.env.IMAGE_T2I_PROVIDER;
  });

  afterEach(() => {
    if (envBackup === undefined) delete process.env.IMAGE_T2I_PROVIDER;
    else process.env.IMAGE_T2I_PROVIDER = envBackup;
  });

  describe("resolveFalKontextModel", () => {
    it("defaults to fal-ai/flux-pro/kontext", () => {
      expect(resolveFalKontextModel({})).toBe(DEFAULT_FAL_KONTEXT_MODEL);
    });

    it("honors FAL_KONTEXT_MODEL override", () => {
      expect(
        resolveFalKontextModel({ FAL_KONTEXT_MODEL: "fal-ai/flux-pro/kontext/max" })
      ).toBe("fal-ai/flux-pro/kontext/max");
    });
  });

  describe("isFalKontextFallbackEnabled", () => {
    it("is enabled when FAL_KEY is configured (auto mode)", () => {
      expect(isFalKontextFallbackEnabled()).toBe(true);
    });

    it("is disabled without FAL_KEY", () => {
      mockFalQueue.isFalKeyConfigured.mockReturnValue(false);
      expect(isFalKontextFallbackEnabled()).toBe(false);
    });

    it("is disabled when IMAGE_T2I_PROVIDER forces replicate", () => {
      process.env.IMAGE_T2I_PROVIDER = "replicate";
      expect(isFalKontextFallbackEnabled()).toBe(false);
    });
  });

  describe("runFalKontextSingle", () => {
    it("maps prompt + image_url and mirrors the Replicate Kontext params", async () => {
      mockFalQueue.falQueueSubscribe.mockResolvedValue({
        images: [{ url: "https://fal.media/out.jpg" }],
      });

      const result = await runFalKontextSingle({
        prompt: "editorial portrait",
        imageUrl: "https://r2.example.com/face.jpg",
        seed: 42,
      });

      expect(result.urls).toEqual(["https://fal.media/out.jpg"]);
      expect(result.model).toBe(DEFAULT_FAL_KONTEXT_MODEL);

      const [model, input, timeout] = mockFalQueue.falQueueSubscribe.mock.calls[0];
      expect(model).toBe(DEFAULT_FAL_KONTEXT_MODEL);
      expect(input).toMatchObject({
        prompt: "editorial portrait",
        image_url: "https://r2.example.com/face.jpg",
        aspect_ratio: "3:4",
        safety_tolerance: "2",
        num_images: 1,
        seed: 42,
      });
      expect(timeout).toBe(120_000);
    });

    it("throws when FAL returns no image URLs", async () => {
      mockFalQueue.falQueueSubscribe.mockResolvedValue({ images: [] });
      await expect(
        runFalKontextSingle({ prompt: "p", imageUrl: "https://x/y.jpg" })
      ).rejects.toThrow(/no image URLs/);
    });
  });
});
