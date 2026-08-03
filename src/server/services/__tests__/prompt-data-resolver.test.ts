import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ImageGenerationInput } from "@/server/services/ai-image.service";

const { findFirstOrThrow } = vi.hoisted(() => ({
  findFirstOrThrow: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    influencer: {
      findFirstOrThrow,
    },
  },
}));

import { resolvePromptData } from "@/server/services/prompt-data-resolver";

describe("resolvePromptData", () => {
  beforeEach(() => {
    findFirstOrThrow.mockReset();
  });

  it("dedupes customPrompt when identical to sceneDescription", async () => {
    const scene = "selfie cozy au café";
    findFirstOrThrow.mockResolvedValue({
      id: "inf-1",
      age: 24,
      gender: "female",
      brief: null,
      style: { ethnicity: "latina", hairColor: "brun" },
      appearanceVariations: null,
      baseImageUrl: null,
    });

    const input: ImageGenerationInput = {
      influencerId: "inf-1",
      scene: "custom",
      sceneDescription: scene,
      pose: "candid",
      outfit: "pull beige",
      expression: "natural",
      style: "natural",
      lighting: "natural",
      isNsfw: false,
      customPrompt: scene,
      numberOfImages: 1,
    };

    const resolved = await resolvePromptData("inf-1", input);
    expect(resolved.sceneDescription).toBe(scene);
    expect(resolved.customPrompt).toBeUndefined();
    expect(resolved._resolved).toBe(true);
  });

  it("supports style v1 JSON without v2 fields", async () => {
    findFirstOrThrow.mockResolvedValue({
      id: "inf-2",
      age: 22,
      gender: "female",
      brief: null,
      style: {
        ethnicity: "caucasienne",
        hairColor: "blond",
        hairStyle: "long, lisse",
        bodyType: "fine",
        fashionStyle: "casual",
      },
      appearanceVariations: null,
      baseImageUrl: "https://cdn.example/portrait.jpg",
    });

    const input: ImageGenerationInput = {
      influencerId: "inf-2",
      baseImageUrl: "https://cdn.example/portrait.jpg",
      scene: "cafe",
      sceneDescription: "café parisien",
      pose: "candid",
      outfit: "robe été",
      expression: "smile",
      style: "natural",
      lighting: "golden_hour",
      isNsfw: false,
      numberOfImages: 1,
    };

    const resolved = await resolvePromptData("inf-2", input);
    expect(resolved.skinTone).toBeUndefined();
    expect(resolved.bustLevel).toBeUndefined();
    expect(resolved.ethnicity).toBe("caucasienne");
    expect(resolved.useReferenceFace).toBe(true);
    // A sent reference image carries the body → lock morphology (Alexya #3).
    expect(resolved.lockBodyToReference).toBe(true);
    expect(resolved.influencerBrief).toBeUndefined();
  });

  it("locks body to a READY LoRA even with no reference image sent", async () => {
    findFirstOrThrow.mockResolvedValue({
      id: "inf-3",
      age: 27,
      gender: "female",
      brief: null,
      style: { ethnicity: "latina", bodyType: "curvy", morphologyNotes: "abs" },
      appearanceVariations: null,
      baseImageUrl: "https://cdn.example/portrait.jpg",
      loraStatus: "READY",
      loraUrl: "https://cdn.example/lora.safetensors",
    });

    const input: ImageGenerationInput = {
      influencerId: "inf-3",
      // No baseImageUrl in the request → useReferenceFace would be false…
      scene: "studio",
      pose: "candid",
      outfit: "robe",
      expression: "natural",
      style: "natural",
      lighting: "natural",
      isNsfw: false,
      numberOfImages: 1,
    };

    const resolved = await resolvePromptData("inf-3", input);
    expect(resolved.useReferenceFace).toBe(false);
    // …but the trained LoRA carries the body, so we still lock it.
    expect(resolved.lockBodyToReference).toBe(true);
    expect(resolved.morphologyNotes).toBe("abs");
  });

  it("describes morphology in words when neither reference nor LoRA exists", async () => {
    findFirstOrThrow.mockResolvedValue({
      id: "inf-4",
      age: 24,
      gender: "female",
      brief: null,
      style: { ethnicity: "caucasienne", bodyType: "athletic" },
      appearanceVariations: null,
      baseImageUrl: null,
      loraStatus: "NONE",
      loraUrl: null,
    });

    const input: ImageGenerationInput = {
      influencerId: "inf-4",
      scene: "studio",
      pose: "candid",
      outfit: "robe",
      expression: "natural",
      style: "natural",
      lighting: "natural",
      isNsfw: false,
      numberOfImages: 1,
    };

    const resolved = await resolvePromptData("inf-4", input);
    expect(resolved.useReferenceFace).toBe(false);
    expect(resolved.lockBodyToReference).toBe(false);
  });
});
