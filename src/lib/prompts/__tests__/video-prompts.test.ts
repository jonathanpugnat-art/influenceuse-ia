import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildVideoPrompt,
  resolveReplicateVideoModel,
  resolveLipSyncModel,
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
      expect(p).toContain("CRITICAL");
      expect(p).toContain("same person");
      expect(p).toContain("TikTok dance trend");
      expect(p).toContain("She starts dancing");
    });

    it("uses creative preset prefix and omits CRITICAL block style", () => {
      const p = buildVideoPrompt({
        videoType: "travel",
        script: "Walking in the city",
        reelStylePreset: "creative",
      });
      expect(p).toContain("based on the reference person");
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
    it("routes stable_face to Kling by default", () => {
      const m = resolveReplicateVideoModel({ preset: "stable_face", hasReferenceImage: true });
      expect(m.id).toBe("kwaivgi/kling-v2.0");
    });

    it("routes natural_motion to MiniMax by default", () => {
      const m = resolveReplicateVideoModel({ preset: "natural_motion", hasReferenceImage: true });
      expect(m.id).toBe("minimax/video-01");
    });

    it("routes creative to Runway, but falls back to MiniMax when a ref image is needed", () => {
      const noRef = resolveReplicateVideoModel({ preset: "creative", hasReferenceImage: false });
      expect(noRef.id).toBe("runwayml/gen4-aleph");

      const withRef = resolveReplicateVideoModel({ preset: "creative", hasReferenceImage: true });
      // Runway doesn't support image refs → fall through routing → MiniMax.
      expect(withRef.id).toBe("minimax/video-01");
    });

    it("respects REPLICATE_VIDEO_MODEL legacy env override", () => {
      process.env.REPLICATE_VIDEO_MODEL = "wan-video/wan-2.5-i2v";
      const m = resolveReplicateVideoModel({ preset: "stable_face" });
      expect(m.id).toBe("wan-video/wan-2.5-i2v");
    });

    it("respects per-preset env override (REPLICATE_VIDEO_MODEL_<PRESET>)", () => {
      process.env.REPLICATE_VIDEO_MODEL_STABLE_FACE = "minimax/video-01";
      const m = resolveReplicateVideoModel({ preset: "stable_face" });
      expect(m.id).toBe("minimax/video-01");
    });

    it("warns and falls through on unknown env value", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      process.env.REPLICATE_VIDEO_MODEL = "evil/model";
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
      expect(p).toMatch(/mouth fully visible/i);
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
});
