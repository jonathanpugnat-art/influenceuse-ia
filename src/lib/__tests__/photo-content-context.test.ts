import { describe, it, expect } from "vitest";
import {
  buildPhotoContentDescription,
  buildGenerationPreviewLines,
} from "@/lib/photo-content-context";

describe("photo-content-context", () => {
  it("builds French caption context from sceneDescription not enum keys", () => {
    const desc = buildPhotoContentDescription(
      {
        scene: "urban",
        sceneDescription:
          "terrasse de café à Paris, matin, passants flous, pas de miroir",
        pose: "candid",
        outfit: "blazer beige et jean",
        expression: "smile",
        photoStyle: "natural",
        timeOfDay: "golden_hour",
        location: "Tour Eiffel Paris",
      },
      "fr"
    );
    expect(desc).toContain("terrasse de café à Paris");
    expect(desc).not.toMatch(/^Photo: urban/i);
    expect(desc).toContain("blazer beige");
    expect(desc).toContain("Tour Eiffel");
    expect(desc).toContain("cette scène précise");
  });

  it("builds preview lines for UI", () => {
    const lines = buildGenerationPreviewLines({
      scene: "custom",
      sceneDescription: "hotel lobby, marble floor",
      pose: "candid",
      outfit: "robe rouge",
      expression: "natural",
      photoStyle: "natural",
      timeOfDay: "natural",
      location: "",
      customPrompt: "",
    });
    expect(lines.find((l) => l.key === "scene")?.value).toContain("hotel lobby");
    expect(lines.find((l) => l.key === "outfit")?.value).toBe("robe rouge");
  });
});
