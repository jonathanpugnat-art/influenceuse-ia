import { describe, it, expect, vi, beforeEach } from "vitest";

const { runFluxLoraBatchMock, generatePremiumPulidImagesMock } = vi.hoisted(() => ({
  runFluxLoraBatchMock: vi.fn(),
  generatePremiumPulidImagesMock: vi.fn(),
}));

vi.mock("@/server/services/image-providers/flux-lora.provider", () => ({
  runFluxLoraBatch: runFluxLoraBatchMock,
}));

vi.mock(
  "@/server/services/image-providers/replicate-premium.provider",
  () => ({
    DEFAULT_REPLICATE_PULID_MODEL: "bytedance/flux-pulid",
    resolveReplicatePulidModelRef: vi.fn(),
    isPulidReplicateModel: vi.fn(),
    sanitizePulidReplicateInput: vi.fn(),
    isAishaPremiumFluxModel: vi.fn(),
    isPremiumUncensoredReplicateModel: vi.fn(),
    resolveReplicatePremiumModelRef: vi.fn(),
    buildPremiumReplicateInput: vi.fn(),
    sanitizePremiumReplicateInput: vi.fn(),
  })
);

vi.mock("../premium-pipeline", async () => {
  const actual = await vi.importActual<typeof import("../premium-pipeline")>(
    "../premium-pipeline"
  );
  return {
    ...actual,
    generatePremiumPulidImages: generatePremiumPulidImagesMock,
  };
});

import {
  generateFaceLockedImages,
  hasReadyLora,
} from "@/server/services/image/face-lock-pipeline";

describe("face-lock-pipeline", () => {
  beforeEach(() => {
    runFluxLoraBatchMock.mockReset();
    generatePremiumPulidImagesMock.mockReset();
  });

  describe("hasReadyLora", () => {
    it("requires both loraUrl and triggerWord", () => {
      expect(hasReadyLora(null)).toBe(false);
      expect(hasReadyLora({ loraUrl: "https://x", loraTriggerWord: "" })).toBe(false);
      expect(hasReadyLora({ loraUrl: "", loraTriggerWord: "AURA_x" })).toBe(false);
      expect(
        hasReadyLora({ loraUrl: "https://x", loraTriggerWord: "AURA_x" })
      ).toBe(true);
    });
  });

  it("rejects non-http face URLs before touching any provider", async () => {
    await expect(
      generateFaceLockedImages({
        faceUrl: "/local/portrait.jpg",
        prompt: "smiling",
        negativePrompt: "",
        numImages: 1,
      })
    ).rejects.toThrow(/MISSING_FACE_REF/);
    expect(runFluxLoraBatchMock).not.toHaveBeenCalled();
    expect(generatePremiumPulidImagesMock).not.toHaveBeenCalled();
  });

  it("prefers Pro LoRA when READY (hybrid img2img with the wizard portrait)", async () => {
    runFluxLoraBatchMock.mockResolvedValue({
      urls: ["https://out.example.com/1.jpg"],
      model: "fal-ai/flux-lora",
      provider: "fal",
    });

    const res = await generateFaceLockedImages({
      faceUrl: "https://cdn.example.com/portrait.jpg",
      prompt: "candid cafe shot",
      negativePrompt: "blurry",
      numImages: 1,
      lora: { loraUrl: "https://cdn.example.com/lora.safetensors", triggerWord: "AURA_luna" },
    });

    expect(res.engine).toBe("lora");
    expect(res.provider).toBe("fal");
    expect(res.model).toBe("fal-ai/flux-lora");
    expect(runFluxLoraBatchMock).toHaveBeenCalledTimes(1);
    const call = runFluxLoraBatchMock.mock.calls[0]?.[0];
    expect(call?.referenceImageUrl).toBe("https://cdn.example.com/portrait.jpg");
    expect(call?.triggerWord).toBe("AURA_luna");
    expect(generatePremiumPulidImagesMock).not.toHaveBeenCalled();
  });

  it("falls through to PuLID when no LoRA is trained", async () => {
    generatePremiumPulidImagesMock.mockResolvedValue({
      urls: ["https://out.example.com/1.webp"],
      model: "bytedance/flux-pulid:abc",
    });

    const res = await generateFaceLockedImages({
      faceUrl: "https://cdn.example.com/portrait.jpg",
      prompt: "candid cafe shot",
      negativePrompt: "blurry",
      numImages: 2,
    });

    expect(res.engine).toBe("pulid");
    expect(res.provider).toBe("replicate");
    expect(res.model).toBe("bytedance/flux-pulid:abc");
    expect(generatePremiumPulidImagesMock).toHaveBeenCalledWith(
      "https://cdn.example.com/portrait.jpg",
      "candid cafe shot",
      "blurry",
      2
    );
    expect(runFluxLoraBatchMock).not.toHaveBeenCalled();
  });

  it("propagates provider failures without silent fallback (no other person)", async () => {
    generatePremiumPulidImagesMock.mockRejectedValue(
      new Error("Replicate: 503 service unavailable")
    );

    await expect(
      generateFaceLockedImages({
        faceUrl: "https://cdn.example.com/portrait.jpg",
        prompt: "beach",
        negativePrompt: "",
        numImages: 1,
      })
    ).rejects.toThrow(/service unavailable/);
    expect(runFluxLoraBatchMock).not.toHaveBeenCalled();
  });

  it("throws when providers return zero images (never leak an empty result to the caller)", async () => {
    generatePremiumPulidImagesMock.mockResolvedValue({ urls: [], model: "x" });
    await expect(
      generateFaceLockedImages({
        faceUrl: "https://cdn.example.com/portrait.jpg",
        prompt: "cafe",
        negativePrompt: "",
        numImages: 1,
      })
    ).rejects.toThrow(/PuLID returned no images/);
  });
});
