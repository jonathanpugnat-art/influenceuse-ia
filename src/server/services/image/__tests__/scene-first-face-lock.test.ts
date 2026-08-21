import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  generateFaceLockedImagesMock,
  uploadFromUrlMock,
  checkCreditsMock,
  deductCreditsMock,
  applyPhotoPromptEnrichmentMock,
} = vi.hoisted(() => ({
  generateFaceLockedImagesMock: vi.fn(),
  uploadFromUrlMock: vi.fn(),
  checkCreditsMock: vi.fn(),
  deductCreditsMock: vi.fn(),
  applyPhotoPromptEnrichmentMock: vi.fn(),
}));

vi.mock("../face-lock-pipeline", async () => {
  const actual =
    await vi.importActual<typeof import("../face-lock-pipeline")>(
      "../face-lock-pipeline"
    );
  return {
    ...actual,
    generateFaceLockedImages: generateFaceLockedImagesMock,
  };
});

vi.mock("@/server/services/storage.service", () => ({
  uploadFromUrl: uploadFromUrlMock,
}));

vi.mock("@/server/services/credits.service", () => ({
  checkCredits: checkCreditsMock,
  deductCredits: deductCreditsMock,
}));

vi.mock("../photo-enrichment", () => ({
  applyPhotoPromptEnrichment: applyPhotoPromptEnrichmentMock,
  resolveEnrichedSceneAndOutfit: vi.fn(),
}));

import { composeImageOnScenePlate } from "../scene-first-generation";
import type { ImageGenerationInput, InfluencerStyle } from "../types";

const STYLE: InfluencerStyle = {
  gender: "female",
  ethnicity: "caucasian",
  hairColor: "brown",
  hairStyle: "long straight",
  bodyType: "average",
};

function baseInput(
  overrides: Partial<ImageGenerationInput> = {}
): ImageGenerationInput & { scenePlateUrl: string } {
  return {
    influencerId: "inf_1",
    baseImageUrl: "https://cdn.example.com/portrait.jpg",
    useReferenceFace: true,
    scene: "custom",
    sceneDescription: "candid cafe window seat with soft window light",
    pose: "candid",
    outfit: "beige knit sweater and jeans",
    expression: "smile",
    style: "natural",
    lighting: "natural",
    isNsfw: false,
    numberOfImages: 2,
    scenePlateUrl: "https://cdn.example.com/plate.jpg",
    omitCreditBilling: false,
    ...overrides,
  };
}

describe("composeImageOnScenePlate — face-lock migration", () => {
  beforeEach(() => {
    generateFaceLockedImagesMock.mockReset();
    uploadFromUrlMock.mockReset();
    checkCreditsMock.mockReset().mockResolvedValue(true);
    deductCreditsMock.mockReset().mockResolvedValue(undefined);
    applyPhotoPromptEnrichmentMock
      .mockReset()
      .mockImplementation(async (input) => input);
    uploadFromUrlMock.mockImplementation(async (url: string) => `stored::${url}`);
  });

  it("runs the face-lock pipeline (PuLID by default) on the wizard portrait", async () => {
    generateFaceLockedImagesMock.mockResolvedValue({
      urls: [
        "https://out.example.com/a.webp",
        "https://out.example.com/b.webp",
      ],
      engine: "pulid",
      provider: "replicate",
      model: "bytedance/flux-pulid:abc",
    });

    const out = await composeImageOnScenePlate("user_1", 24, STYLE, baseInput());

    expect(generateFaceLockedImagesMock).toHaveBeenCalledTimes(1);
    const call = generateFaceLockedImagesMock.mock.calls[0]?.[0];
    expect(call?.faceUrl).toBe("https://cdn.example.com/portrait.jpg");
    expect(call?.numImages).toBe(2);
    expect(call?.lora).toBeUndefined();
    expect(call?.prompt).toContain("candid cafe window seat");
    expect(call?.prompt).toContain("beige knit sweater");

    expect(out.parameters).toMatchObject({
      contentEngine: "pulid",
      provider: "replicate",
      scenePlateUrl: "https://cdn.example.com/plate.jpg",
      workflow: "scene_first_face_locked",
    });
    expect(out.imageUrls).toEqual([
      "stored::https://out.example.com/a.webp",
      "stored::https://out.example.com/b.webp",
    ]);
    expect(deductCreditsMock).toHaveBeenCalledWith("user_1", expect.any(Number));
  });

  it("routes to the Pro/Agency LoRA hybrid when a trained LoRA is READY", async () => {
    generateFaceLockedImagesMock.mockResolvedValue({
      urls: ["https://out.example.com/l.jpg"],
      engine: "lora",
      provider: "fal",
      model: "fal-ai/flux-lora",
    });

    await composeImageOnScenePlate(
      "user_1",
      24,
      STYLE,
      baseInput({
        loraUrl: "https://cdn.example.com/lora.safetensors",
        loraTriggerWord: "AURA_luna",
        numberOfImages: 1,
      })
    );

    const call = generateFaceLockedImagesMock.mock.calls[0]?.[0];
    expect(call?.lora?.loraUrl).toBe("https://cdn.example.com/lora.safetensors");
    expect(call?.lora?.triggerWord).toBe("AURA_luna");
  });

  it("throws MISSING_FACE_REF when the wizard portrait URL is missing", async () => {
    await expect(
      composeImageOnScenePlate(
        "user_1",
        24,
        STYLE,
        baseInput({ baseImageUrl: undefined })
      )
    ).rejects.toThrow(/MISSING_FACE_REF/);
    expect(generateFaceLockedImagesMock).not.toHaveBeenCalled();
  });

  it("never falls back to Nano when face-lock fails — surfaces [face-lock] instead", async () => {
    generateFaceLockedImagesMock.mockRejectedValue(
      new Error("PuLID: 503 service unavailable")
    );

    await expect(
      composeImageOnScenePlate("user_1", 24, STYLE, baseInput())
    ).rejects.toThrow(/\[face-lock\]/);
    // No Nano client is imported by this file anymore — but the important
    // contract is that the failure never resolves silently.
    expect(deductCreditsMock).not.toHaveBeenCalled();
  });

  it("retries once with a softened prompt when the safety filter blocks", async () => {
    generateFaceLockedImagesMock
      .mockRejectedValueOnce(new Error("Nano safety: E005 flagged"))
      .mockResolvedValueOnce({
        urls: ["https://out.example.com/soft.webp"],
        engine: "pulid",
        provider: "replicate",
        model: "bytedance/flux-pulid:abc",
      });

    const out = await composeImageOnScenePlate(
      "user_1",
      24,
      STYLE,
      baseInput({ numberOfImages: 1 })
    );

    expect(generateFaceLockedImagesMock).toHaveBeenCalledTimes(2);
    expect(out.promptWasSoftened).toBe(true);
    expect(out.imageUrls).toHaveLength(1);
  });

  it("bills on delivered images only (partial success is allowed)", async () => {
    generateFaceLockedImagesMock.mockResolvedValue({
      urls: ["https://out.example.com/only-one.webp"],
      engine: "pulid",
      provider: "replicate",
      model: "bytedance/flux-pulid:abc",
    });

    await composeImageOnScenePlate(
      "user_1",
      24,
      STYLE,
      baseInput({ numberOfImages: 4 })
    );

    const [, amount] = deductCreditsMock.mock.calls[0] ?? [];
    // 1 delivered image × PHOTO cost — not 4.
    expect(amount).toBeGreaterThan(0);
    // Sanity — should not bill for the full 4 requested.
    expect(amount).toBeLessThan(4 * 100);
  });
});
