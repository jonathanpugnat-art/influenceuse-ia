import { describe, it, expect } from "vitest";
import {
  inferSceneContext,
  getCompatiblePoseIds,
  isPoseCompatibleWithScene,
  pickDefaultPoseForScene,
  resolvePosePhrase,
} from "@/lib/photo-scene-pose";
import { POSE_TEMPLATES } from "@/lib/prompts/image-prompts";

describe("photo-scene-pose", () => {
  it("infers outdoor from urban description without mirror", () => {
    expect(
      inferSceneContext({
        scene: "urban",
        sceneDescription:
          "on a real city sidewalk, shops behind, outdoor street photo, no mirror",
      })
    ).toBe("outdoor");
  });

  it("infers mirror_indoor from gym description", () => {
    expect(
      inferSceneContext({
        scene: "gym",
        sceneDescription: "gym mirror on the wall for a workout selfie",
      })
    ).toBe("mirror_indoor");
  });

  it("excludes mirror poses for outdoor context", () => {
    const allowed = getCompatiblePoseIds({
      sceneDescription: "city sidewalk, no mirror",
    });
    expect(allowed).toContain("candid");
    expect(allowed).toContain("action");
    expect(allowed).not.toContain("selfie");
    expect(allowed).not.toContain("fullBody");
  });

  it("resolves outdoor fullBody without mirror tokens", () => {
    const phrase = resolvePosePhrase(
      "fullBody",
      "female",
      "outdoor",
      POSE_TEMPLATES
    );
    expect(phrase).toContain("no mirror");
    expect(phrase).not.toContain("in front of mirror");
  });

  it("auto-picks candid when selfie incompatible", () => {
    expect(
      pickDefaultPoseForScene(
        { sceneDescription: "beach, sand and ocean, no mirror" },
        "selfie"
      )
    ).toBe("candid");
  });

  it("keeps selfie when scene is gym mirror", () => {
    expect(
      isPoseCompatibleWithScene("selfie", {
        scene: "gym",
        sceneDescription: "gym mirror on the wall",
      })
    ).toBe(true);
  });
});
