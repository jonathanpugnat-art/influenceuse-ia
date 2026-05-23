import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildVideoPrompt,
  resolveReplicateVideoModel,
  resolveLipSyncModel,
  buildVideoModelInputs,
  VIDEO_MODELS,
  VIDEO_MODEL_ALLOWLIST,
} from "@/lib/prompts/video-prompts";

describe("video-prompts", () => {
  afterEach(() => {
    delete process.env.REPLICATE_VIDEO_MODEL;
    delete process.env.REPLICATE_VIDEO_MODEL_STABLE_FACE;
    delete process.env.REPLICATE_VIDEO_MODEL_NATURAL_MOTION;
    delete process.env.REPLICATE_VIDEO_MODEL_CREATIVE;
    delete process.env.REPLICATE_VIDEO_MODEL_LIP_SYNC;
    delete process.env.REPLICATE_LIPSYNC_MODEL;
  });

  describe("buildVideoPrompt", () => {
    it("includes stable face identity instructions by default", () => {
      const p = buildVideoPrompt({
        videoType: "dance",
        script: "She starts dancing",
        reelStylePreset: "stable_face",
      });
      expect(p).toContain("same person");
      expect(p).toContain("TikTok dance trend");
      expect(p).toContain("She starts dancing");
      expect(p).toContain("NO captions");
      expect(p).toContain("finished native Instagram Reel");
    });

    it("forbids portrait morph when sceneFrameOnly", () => {
      const p = buildVideoPrompt({
        videoType: "grwm",
        script: "adjusts outfit",
        sceneFrameOnly: true,
        reelStylePreset: "natural_motion",
      });
      expect(p).toContain("no morphing from a different photo");
      expect(p).toContain("frame zero");
    });

    it("locks environment when sceneDescription is provided", () => {
      const p = buildVideoPrompt({
        videoType: "grwm",
        script: "adjusts outfit",
        sceneDescription: "modern bathroom mirror",
        reelStylePreset: "stable_face",
      });
      expect(p).toContain("modern bathroom mirror");
      expect(p).toContain("Do not change location");
    });

    it("uses creative preset prefix and omits CRITICAL block style", () => {
      const p = buildVideoPrompt({
        videoType: "travel",
        script: "Walking in the city",
        reelStylePreset: "creative",
      });
      expect(p).toContain("based on the first frame person");
      expect(p).not.toContain("CRITICAL:");
    });

    it("joins multiple effects from comma-separated string", () => {
      const p = buildVideoPrompt({
        videoType: "ootd",
        script: "Outfit reveal",
        effects: "zoom,slow-mo",
        reelStylePreset: "natural_motion",
      });
      expect(p).toContain("TikTok zoom trend");
      expect(p).toContain("slow motion");
    });

    it("supports day_in_life and sketch types", () => {
      const day = buildVideoPrompt({
        videoType: "day_in_life",
        script: "Morning routine",
      });
      expect(day).toContain("day in my life");

      const sketch = buildVideoPrompt({
        videoType: "sketch",
        script: "Punchline",
      });
      expect(sketch).toContain("comedy sketch");
    });
  });

  describe("resolveReplicateVideoModel", () => {
    it("routes stable_face to Kling by default (single start frame)", () => {
      const m = resolveReplicateVideoModel({ preset: "stable_face", hasReferenceImage: true });
      expect(m.id).toBe("kwaivgi/kling-v2.0");
    });

    it("routes natural_motion to Wan 2.5 I2V by default", () => {
      const m = resolveReplicateVideoModel({ preset: "natural_motion", hasReferenceImage: true });
      expect(m.id).toBe("wan-video/wan-2.5-i2v");
    });

    it("routes creative to Runway without a start frame, Wan when a start frame is needed", () => {
      const noRef = resolveReplicateVideoModel({ preset: "creative", hasReferenceImage: false });
      expect(noRef.id).toBe("runwayml/gen4-aleph");

      const withRef = resolveReplicateVideoModel({ preset: "creative", hasReferenceImage: true });
      expect(withRef.id).toBe("wan-video/wan-2.5-i2v");
    });

    it("preset default wins over legacy global REPLICATE_VIDEO_MODEL", () => {
      process.env.REPLICATE_VIDEO_MODEL = "minimax/video-01";
      const m = resolveReplicateVideoModel({
        preset: "natural_motion",
        hasReferenceImage: true,
      });
      expect(m.id).toBe("wan-video/wan-2.5-i2v");
    });

    it("uses global env only after built-in candidates are exhausted", () => {
      process.env.REPLICATE_VIDEO_MODEL = "minimax/video-01";
      const m = resolveReplicateVideoModel({
        preset: "creative",
        hasReferenceImage: true,
      });
      expect(m.id).toBe("wan-video/wan-2.5-i2v");
    });

    it("respects per-preset env override (REPLICATE_VIDEO_MODEL_<PRESET>)", () => {
      process.env.REPLICATE_VIDEO_MODEL_STABLE_FACE = "minimax/video-01";
      const m = resolveReplicateVideoModel({ preset: "stable_face" });
      expect(m.id).toBe("minimax/video-01");
    });

    it("warns and falls through on unknown per-preset env value", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      process.env.REPLICATE_VIDEO_MODEL_STABLE_FACE = "evil/model";
      const m = resolveReplicateVideoModel({ preset: "stable_face" });
      expect(m.id).toBe("kwaivgi/kling-v2.0");
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("includes the new models in the allowlist", () => {
      expect(VIDEO_MODEL_ALLOWLIST).toContain("kwaivgi/kling-v2.0");
      expect(VIDEO_MODEL_ALLOWLIST).toContain("wan-video/wan-2.5-i2v");
      expect(VIDEO_MODEL_ALLOWLIST).toContain("runwayml/gen4-aleph");
    });
  });

  describe("lip_sync preset (Sprint 10)", () => {
    it("buildVideoPrompt emits lip-sync-friendly framing instructions", () => {
      const p = buildVideoPrompt({
        videoType: "talking_head",
        script: "Hi everyone",
        reelStylePreset: "lip_sync",
      });
      expect(p).toMatch(/lip[- ]sync/i);
      expect(p).toMatch(/mouth visible/i);
    });

    it("resolveReplicateVideoModel(lip_sync) returns Kling as the base model", () => {
      const m = resolveReplicateVideoModel({
        preset: "lip_sync",
        hasReferenceImage: true,
      });
      expect(m.id).toBe("kwaivgi/kling-v2.0");
    });

    it("resolveLipSyncModel returns sync/sync-1.6.0 by default", () => {
      const m = resolveLipSyncModel();
      expect(m).not.toBeNull();
      expect(m!.id).toBe("sync/sync-1.6.0");
      expect(m!.requiresAudio).toBe(true);
    });

    it("resolveLipSyncModel ignores REPLICATE_LIPSYNC_MODEL when it points to a non-lip-sync model", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      process.env.REPLICATE_LIPSYNC_MODEL = "minimax/video-01";
      const m = resolveLipSyncModel();
      expect(m!.id).toBe("sync/sync-1.6.0");
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("includes sync/sync-1.6.0 in the allowlist", () => {
      expect(VIDEO_MODEL_ALLOWLIST).toContain("sync/sync-1.6.0");
    });
  });

  describe("buildVideoModelInputs (provider-specific image field mapping)", () => {
    // Regression test for the 2026-05-16 production failure: the first beta
    // reel generation crashed with MiniMax error E006 ("You cannot use both
    // first_frame_image and subject_reference at the same time"). Root cause
    // was a) MiniMax rejecting identical first/subject refs and b) the wrong
    // field name being sent to Kling/Wan. These tests lock the contract.

    it("MiniMax: sends first_frame_image and DROPS subject_reference when refs are identical", () => {
      const url = "https://r2.example.com/avatar.jpg";
      const inputs = buildVideoModelInputs(VIDEO_MODELS["minimax/video-01"], url, url);
      expect(inputs.first_frame_image).toBe(url);
      expect(inputs.subject_reference).toBeUndefined();
    });

    it("MiniMax: sends BOTH fields when subject ref is genuinely different", () => {
      const frame = "https://r2.example.com/frame.jpg";
      const subj = "https://r2.example.com/subject.jpg";
      const inputs = buildVideoModelInputs(VIDEO_MODELS["minimax/video-01"], frame, subj);
      expect(inputs.first_frame_image).toBe(frame);
      expect(inputs.subject_reference).toBe(subj);
    });

    it("Kling 2.0: uses start_image (NOT first_frame_image) and ignores subject ref", () => {
      const frame = "https://r2.example.com/frame.jpg";
      const subj = "https://r2.example.com/subject.jpg";
      const inputs = buildVideoModelInputs(VIDEO_MODELS["kwaivgi/kling-v2.0"], frame, subj);
      expect(inputs.start_image).toBe(frame);
      expect(inputs.first_frame_image).toBeUndefined();
      expect(inputs.subject_reference).toBeUndefined();
    });

    it("Wan 2.5: uses image and ignores subject ref", () => {
      const frame = "https://r2.example.com/frame.jpg";
      const inputs = buildVideoModelInputs(VIDEO_MODELS["wan-video/wan-2.5-i2v"], frame, undefined);
      expect(inputs.image).toBe(frame);
      expect(inputs.first_frame_image).toBeUndefined();
      expect(inputs.start_image).toBeUndefined();
    });

    it("Runway Gen-4: returns empty inputs (no image ref support)", () => {
      const inputs = buildVideoModelInputs(
        VIDEO_MODELS["runwayml/gen4-aleph"],
        "https://r2.example.com/x.jpg",
        "https://r2.example.com/y.jpg"
      );
      expect(inputs).toEqual({});
    });

    it("returns empty when no firstFrame is provided", () => {
      const inputs = buildVideoModelInputs(
        VIDEO_MODELS["kwaivgi/kling-v2.0"],
        undefined,
        "https://r2.example.com/x.jpg"
      );
      expect(inputs).toEqual({});
    });

    it("trims whitespace from URLs (defensive against editor-pasted refs)", () => {
      const inputs = buildVideoModelInputs(
        VIDEO_MODELS["wan-video/wan-2.5-i2v"],
        "  https://r2.example.com/x.jpg  ",
        undefined
      );
      expect(inputs.image).toBe("https://r2.example.com/x.jpg");
    });
  });
});
