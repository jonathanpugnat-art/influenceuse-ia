import { describe, it, expect } from "vitest";
import {
  inferExpressionFromSceneAndOutfit,
  inferPoseFromScene,
  usesSelfieCameraFraming,
  userRequestedSelfie,
} from "@/lib/photo-scene-inference";

describe("photo-scene-inference", () => {
  it("defaults to candid for generic scene text", () => {
    expect(
      inferPoseFromScene({
        scene: "custom",
        sceneDescription: "terrasse parisienne avec des bonbons colorés",
      })
    ).toBe("candid");
  });

  it("uses selfie pose only when user asks for it", () => {
    expect(userRequestedSelfie("selfie dans le miroir de la salle de bain")).toBe(true);
    expect(
      inferPoseFromScene({
        scene: "custom",
        sceneDescription: "selfie miroir salle de bain",
      })
    ).toBe("selfie");
  });

  it("switches expression to seductive for suggestive scenes", () => {
    expect(
      inferExpressionFromSceneAndOutfit("photo sexy sur le canapé", "robe noire", "smile")
    ).toBe("seductive");
  });

  it("does not treat candid as selfie framing", () => {
    expect(usesSelfieCameraFraming("candid", "café avec candy")).toBe(false);
    expect(usesSelfieCameraFraming("selfie", "café")).toBe(true);
  });
});
