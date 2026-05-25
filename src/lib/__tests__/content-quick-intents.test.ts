import { describe, it, expect } from "vitest";
import {
  applyPhotoQuickIntent,
  applyReelQuickIntent,
} from "@/lib/content-quick-intents";
import { appendPromptSnippet } from "@/lib/prompt-chips";

describe("content-quick-intents", () => {
  it("applyPhotoQuickIntent cafe sets scene", () => {
    const patch = applyPhotoQuickIntent("cafe", "female");
    expect(patch.sceneDescription?.length).toBeGreaterThan(10);
    expect(patch.outfit).toBeTruthy();
  });

  it("applyReelQuickIntent talking sets lip_sync", () => {
    const patch = applyReelQuickIntent("talking");
    expect(patch.reelStylePreset).toBe("lip_sync");
    expect(patch.script?.length).toBeGreaterThan(10);
  });
});

describe("appendPromptSnippet", () => {
  it("appends without duplicate", () => {
    expect(appendPromptSnippet("café", "Paris café")).toContain("Paris");
    expect(appendPromptSnippet("Paris café terrace", "Paris café")).toBe(
      "Paris café terrace"
    );
  });
});
