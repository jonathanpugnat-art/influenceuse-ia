import { describe, expect, it } from "vitest";
import {
  extractOutfitFromUserPrompt,
  isPhotoFieldLocked,
  mergePhotoParamsWithUserIntent,
  resolvePhotoUserIntent,
} from "@/lib/photo-intent-resolver";
import { composePhotoParamsFromPrompt } from "@/lib/photo-prompt-compose";

describe("photo-intent-resolver", () => {
  it("locks outfit when user names sports bra explicitly", () => {
    const intent = resolvePhotoUserIntent(
      "selfie miroir salle de sport, brassière sport noire et legging"
    );
    expect(intent.outfit?.toLowerCase()).toContain("brassière");
    expect(isPhotoFieldLocked(intent, "outfit")).toBe(true);
    expect(isPhotoFieldLocked(intent, "sceneDescription")).toBe(true);
  });

  it("does not let look presets override locked outfit in compose", () => {
    const composed = composePhotoParamsFromPrompt({
      prompt: "photo fitness, brassière sport grise et legging noir",
      gender: "female",
      influencerIsNsfw: false,
      hasNsfwPlan: false,
    });

    expect(composed.outfit?.toLowerCase()).toContain("brassière");
    expect(composed.outfit?.toLowerCase()).not.toContain("dentelle");
    expect(composed.sceneDescription).toContain("brassière");
  });

  it("keeps user scene over premium look scene description", () => {
    const merged = mergePhotoParamsWithUserIntent(
      {
        sceneDescription: "generic boudoir bedroom preset",
        outfit: "lingerie dentelle rouge",
      },
      resolvePhotoUserIntent("café parisien, tenue jean et pull beige"),
      { lookId: "boudoir-bedroom", contentMode: "NSFW" }
    );

    expect(merged.sceneDescription).toContain("café parisien");
    expect(merged.outfit).toContain("jean");
  });

  it("extractOutfitFromUserPrompt reads tenue prefix", () => {
    expect(
      extractOutfitFromUserPrompt("tenue crop top blanc, terrasse rooftop")
    ).toMatch(/crop top/i);
  });
});
