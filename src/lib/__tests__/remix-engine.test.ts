import { beforeEach, describe, expect, it } from "vitest";
import {
  classifyRemixProviderError,
  consumeRemixContentPolicyAdvance,
  deriveRemixEngineLabel,
  getRemixEngine,
  planRemixAttempts,
  REMIX_CASCADE_MAX_ATTEMPTS,
  REMIX_CONTENT_POLICY_RATE_LIMIT,
  REMIX_CONTENT_POLICY_RATE_WINDOW_MS,
  REMIX_CONTENT_POLICY_USER_MESSAGE,
  REMIX_O1_EDIT_PROMPT,
  resetRemixContentPolicyRateLimit,
  shortRemixFalRequestId,
} from "@/lib/remix-engine";
import { getSceneEngine } from "@/lib/scene-engine";

describe("remix-engine routing", () => {
  it("defaults REMIX_ENGINE to motion_control_cascade", () => {
    expect(getRemixEngine({})).toBe("motion_control_cascade");
    expect(getRemixEngine({ REMIX_ENGINE: "unknown" })).toBe(
      "motion_control_cascade"
    );
  });

  it("keeps legacy V3-only and O3 rollback switches", () => {
    expect(getRemixEngine({ REMIX_ENGINE: "motion_control_v3_std" })).toBe(
      "motion_control_v3_std"
    );
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

describe("planRemixAttempts cascade", () => {
  it("without Viggle: v2.6 → v3 std → Wan (cap 3, no v3 pro)", () => {
    const attempts = planRemixAttempts({
      engine: "motion_control_cascade",
      orientation: "video",
      clipDurationSec: 10,
      tier: "standard",
      env: {},
    });
    expect(attempts.length).toBeLessThanOrEqual(REMIX_CASCADE_MAX_ATTEMPTS);
    expect(attempts.map((a) => [a.kind, a.engine, a.modelId])).toEqual([
      [
        "motion_control",
        "motion_control_v26_std",
        "fal-ai/kling-video/v2.6/standard/motion-control",
      ],
      [
        "motion_control",
        "motion_control_v3_std",
        "fal-ai/kling-video/v3/standard/motion-control",
      ],
      ["wan_replace", "wan_replace", "fal-ai/wan/v2.2-14b/animate/replace"],
    ]);
    expect(attempts.some((a) => a.engine === "motion_control_v3_pro")).toBe(
      false
    );
    expect(attempts[0]).toMatchObject({
      kind: "motion_control",
      includeFaceElement: false,
      orientation: "video",
    });
    expect(attempts[1]).toMatchObject({
      includeFaceElement: true,
      orientation: "video",
    });
  });

  it("with Viggle: v2.6 → Viggle → Wan (cap 3, no v3 std/pro)", () => {
    const attempts = planRemixAttempts({
      engine: "motion_control_cascade",
      orientation: "video",
      clipDurationSec: 10,
      tier: "standard",
      env: { VIGGLE_API_KEY: "vg-test" },
    });
    expect(attempts.length).toBeLessThanOrEqual(REMIX_CASCADE_MAX_ATTEMPTS);
    expect(attempts.map((a) => [a.kind, a.engine, a.modelId])).toEqual([
      [
        "motion_control",
        "motion_control_v26_std",
        "fal-ai/kling-video/v2.6/standard/motion-control",
      ],
      ["viggle", "viggle", "viggle.ai/v1/renders"],
      ["wan_replace", "wan_replace", "fal-ai/wan/v2.2-14b/animate/replace"],
    ]);
  });

  it("does not bind a face element on v3 when orientation is image", () => {
    const attempts = planRemixAttempts({
      engine: "motion_control_cascade",
      orientation: "image",
      clipDurationSec: 8,
      tier: "standard",
      env: {},
    });
    const mc = attempts.filter((a) => a.kind === "motion_control");
    expect(mc.every((a) => a.includeFaceElement === false)).toBe(true);
  });
});

describe("planRemixAttempts legacy", () => {
  it("plans video → image → O1 for legacy motion_control_v3_std", () => {
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

describe("deriveRemixEngineLabel", () => {
  it("labels the last accepted attempt honestly (kind wins)", () => {
    expect(
      deriveRemixEngineLabel(
        {
          attempts: [
            { kind: "motion_control", modelId: "fal-ai/kling-video/v2.6/standard/motion-control" },
            { kind: "viggle", modelId: "viggle.ai/v1/renders" },
          ],
        },
        "viggle.ai/v1/renders"
      )
    ).toBe("Viggle");

    expect(
      deriveRemixEngineLabel(
        {
          attempts: [
            { kind: "motion_control", modelId: "fal-ai/kling-video/v2.6/standard/motion-control" },
            { kind: "wan_replace", modelId: "fal-ai/wan/v2.2-14b/animate/replace" },
          ],
        },
        "fal-ai/wan/v2.2-14b/animate/replace"
      )
    ).toBe("Wan replace");
  });

  it("labels every Kling Motion Control variant the same", () => {
    for (const modelId of [
      "fal-ai/kling-video/v2.6/standard/motion-control",
      "fal-ai/kling-video/v3/standard/motion-control",
      "fal-ai/kling-video/v3/pro/motion-control",
    ]) {
      expect(
        deriveRemixEngineLabel(
          { attempts: [{ kind: "motion_control", modelId }] },
          modelId
        )
      ).toBe("Kling Motion Control");
    }
  });

  it("falls back to falModel when metadata is absent (older jobs)", () => {
    expect(deriveRemixEngineLabel(null, "viggle.ai/v1/renders")).toBe("Viggle");
    expect(
      deriveRemixEngineLabel(null, "fal-ai/wan/v2.2-14b/animate/replace")
    ).toBe("Wan replace");
    expect(
      deriveRemixEngineLabel(
        null,
        "fal-ai/kling-video/v3/pro/motion-control"
      )
    ).toBe("Kling Motion Control");
  });

  it("never claims Motion Control when the model is viggle or wan", () => {
    expect(
      deriveRemixEngineLabel(
        { attempts: [] },
        "viggle.ai/v1/renders"
      )
    ).not.toBe("Kling Motion Control");
    expect(
      deriveRemixEngineLabel(
        { attempts: [] },
        "fal-ai/wan/v2.2-14b/animate/replace"
      )
    ).not.toBe("Kling Motion Control");
  });

  it("returns a safe generic label when everything is unknown", () => {
    expect(deriveRemixEngineLabel(null, null)).toBe("Moteur remix");
    expect(deriveRemixEngineLabel({ attempts: [] }, "")).toBe("Moteur remix");
  });
});

describe("shortRemixFalRequestId", () => {
  it("truncates long provider ids and drops fallback locks", () => {
    expect(shortRemixFalRequestId("abcdef0123456789")).toBe("abcdef01…");
    expect(shortRemixFalRequestId("short")).toBe("short");
    expect(shortRemixFalRequestId(null)).toBeNull();
    expect(
      shortRemixFalRequestId("fallback-pending:remix_123:2")
    ).toBeNull();
  });
});

describe("content_policy rate limit", () => {
  beforeEach(() => {
    resetRemixContentPolicyRateLimit();
  });

  it("allows 6 advances then blocks until the 10 min window elapses", () => {
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < REMIX_CONTENT_POLICY_RATE_LIMIT; i++) {
      expect(consumeRemixContentPolicyAdvance("u1", t0 + i)).toBe(true);
    }
    expect(consumeRemixContentPolicyAdvance("u1", t0 + 10)).toBe(false);
    expect(
      consumeRemixContentPolicyAdvance(
        "u1",
        t0 + REMIX_CONTENT_POLICY_RATE_WINDOW_MS + 1
      )
    ).toBe(true);
    expect(consumeRemixContentPolicyAdvance("u2", t0 + 10)).toBe(true);
  });
});
