import { describe, expect, it } from "vitest";
import { applyStudioLook } from "@/lib/photo-studio-looks";
import { validatePhotoIntent } from "@/lib/photo-intent-validation";

describe("validatePhotoIntent", () => {
  it("warns when suggestive outfit is used in Social mode", () => {
    const issues = validatePhotoIntent({
      contentMode: "SFW",
      sceneDescription: "intimate bedroom with soft lamp light",
      outfit: "lingerie dentelle rouge",
      locale: "fr",
    });
    expect(issues.some((i) => i.code === "suggestive_in_social")).toBe(true);
  });

  it("flags lingerie outfit with cafe scene in Social mode", () => {
    const issues = validatePhotoIntent({
      contentMode: "SFW",
      sceneDescription: "cozy cafe aesthetic morning light",
      outfit: "lingerie dentelle",
      locale: "fr",
    });
    expect(issues.some((i) => i.code === "scene_outfit_mismatch")).toBe(true);
  });

  it("requires outfit", () => {
    const issues = validatePhotoIntent({
      contentMode: "SFW",
      sceneDescription: "street style",
      outfit: "",
    });
    expect(issues.some((i) => i.code === "missing_outfit")).toBe(true);
  });
});

describe("applyStudioLook premium lane", () => {
  it("does not force instagramShot in premium mode", () => {
    const params = applyStudioLook("boudoir-bedroom", "female", undefined, "NSFW");
    expect(params.instagramShot).toBe(false);
    expect(params.contentMode).toBe("NSFW");
  });

  it("keeps instagramShot in social mode", () => {
    const params = applyStudioLook("cafe-aesthetic", "female", undefined, "SFW");
    expect(params.instagramShot).toBe(true);
    expect(params.contentMode).toBe("SFW");
  });
});
