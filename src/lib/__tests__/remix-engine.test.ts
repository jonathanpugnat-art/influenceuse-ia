import { describe, expect, it } from "vitest";
import {
  classifyRemixProviderError,
  getRemixEngine,
  planRemixAttempts,
  REMIX_CONTENT_POLICY_USER_MESSAGE,
  REMIX_O1_EDIT_PROMPT,
} from "@/lib/remix-engine";
import { getSceneEngine } from "@/lib/scene-engine";

describe("remix-engine routing", () => {
  it("defaults REMIX_ENGINE to motion_control_v3_std", () => {
    expect(getRemixEngine({})).toBe("motion_control_v3_std");
    expect(getRemixEngine({ REMIX_ENGINE: "unknown" })).toBe(
      "motion_control_v3_std"
    );
  });

  it("allows kling_o3_v2v rollback", () => {
    expect(getRemixEngine({ REMIX_ENGINE: "kling_o3_v2v" })).toBe(
      "kling_o3_v2v"
    );
  });

  it("does not change SCENE_ENGINE (Kling O3 I2V, Seedance paused)", () => {
    expect(getSceneEngine({})).toBe("kling_o3_i2v");
    expect(getSceneEngine({ SCENE_ENGINE: "kling_o3_i2v" })).toBe(
      "kling_o3_i2v"
    );
  });
});

describe("planRemixAttempts", () => {
  it("plans video → image → O1 for a 10s fitness clip", () => {
    const attempts = planRemixAttempts({
      engine: "motion_control_v3_std",
      orientation: "video",
      clipDurationSec: 10,
      tier: "standard",
      env: {},
    });
    expect(attempts.map((a) => [a.kind, "orientation" in a ? a.orientation : null])).toEqual([
      ["motion_control", "video"],
      ["motion_control", "image"],
      ["o1_v2v_edit", null],
    ]);
    expect(attempts[0].modelId).toBe(
      "fal-ai/kling-video/v3/standard/motion-control"
    );
    expect(attempts[2].modelId).toBe(
      "fal-ai/kling-video/o1/video-to-video/edit"
    );
  });

  it("skips inverse image + O1 when the clip is longer than 10s", () => {
    const attempts = planRemixAttempts({
      engine: "motion_control_v3_std",
      orientation: "video",
      clipDurationSec: 25,
      tier: "standard",
      env: {},
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      kind: "motion_control",
      orientation: "video",
    });
  });

  it("plans image → video → O1 for a short camera clip", () => {
    const attempts = planRemixAttempts({
      engine: "motion_control_v3_std",
      orientation: "image",
      clipDurationSec: 8,
      tier: "pro",
      env: {},
    });
    expect(attempts.map((a) => a.kind)).toEqual([
      "motion_control",
      "motion_control",
      "o1_v2v_edit",
    ]);
    expect(attempts[0]).toMatchObject({ orientation: "image" });
    expect(attempts[1]).toMatchObject({ orientation: "video" });
    expect(attempts[0].modelId).toBe(
      "fal-ai/kling-video/v3/pro/motion-control"
    );
  });

  it("uses a single O3 attempt on rollback", () => {
    const attempts = planRemixAttempts({
      engine: "kling_o3_v2v",
      orientation: "video",
      clipDurationSec: 10,
      tier: "standard",
      env: {},
    });
    expect(attempts).toEqual([
      {
        kind: "kling_o3_v2v",
        engine: "kling_o3_v2v",
        modelId: "fal-ai/kling-video/o3/standard/video-to-video/reference",
      },
    ]);
  });
});

describe("classifyRemixProviderError", () => {
  it("treats 422 and content_policy as content_policy", () => {
    expect(
      classifyRemixProviderError({ status: 422, message: "unprocessable" })
    ).toBe("content_policy");
    expect(
      classifyRemixProviderError(new Error("FAL submit failed (422): blocked"))
    ).toBe("content_policy");
    expect(
      classifyRemixProviderError(new Error("content_policy: likeness"))
    ).toBe("content_policy");
  });

  it("treats other failures as other", () => {
    expect(classifyRemixProviderError(new Error("timeout"))).toBe("other");
    expect(classifyRemixProviderError({ status: 500 })).toBe("other");
  });
});

describe("remix copy", () => {
  it("keeps the user-facing content-policy toast and O1 prompt", () => {
    expect(REMIX_CONTENT_POLICY_USER_MESSAGE).toBe(
      "Ce clip est bloqué par le filtre du fournisseur. Essaie un autre clip ou une pose moins sensible."
    );
    expect(REMIX_O1_EDIT_PROMPT).toBe(
      "Replace the character with @Element1 keeping same motion"
    );
  });
});
