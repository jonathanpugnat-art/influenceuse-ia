import Replicate from "replicate";
import { nanoid } from "nanoid";
import { uploadFromUrl } from "@/server/services/storage.service";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { CREDIT_COSTS } from "@/lib/constants";
import {
  buildVideoPrompt,
  resolveReplicateVideoModel,
  resolveLipSyncModel,
  type ReelStylePreset,
} from "@/lib/prompts/video-prompts";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface VideoGenerationInput {
  influencerId: string;
  /** First frame of the video (scene start); required. */
  baseImageUrl: string;
  /**
   * Optional second reference for MiniMax `subject_reference` (S2V identity path).
   * When omitted, `baseImageUrl` is duplicated so the model always gets a character lock.
   */
  subjectReferenceUrl?: string;
  duration: 5 | 10;
  script: string;
  videoType: string;
  /** Comma-separated effect keys (see video-prompts). */
  effects?: string;
  reelStylePreset?: ReelStylePreset;
  isNsfw: boolean;
  /**
   * Sprint 10 — when `reelStylePreset === "lip_sync"`, this audio URL is
   * applied as a post-process to align the speaker's lips with the audio.
   * The base video is still generated normally first.
   */
  audioUrl?: string;
}

export interface VideoGenerationOutput {
  videoUrl: string;
  thumbnailUrl?: string;
  parameters: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// Replicate SDK
// ──────────────────────────────────────────────

let _replicate: Replicate | null = null;

function getReplicate(): Replicate {
  if (!_replicate) {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error(
        "REPLICATE_API_TOKEN is not configured. Set it in your .env file."
      );
    }
    _replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }
  return _replicate;
}

async function runReplicatePrediction(
  model: string,
  input: Record<string, unknown>
): Promise<string[]> {
  const replicate = getReplicate();

  const output = await replicate.run(
    model as `${string}/${string}` | `${string}/${string}:${string}`,
    { input }
  );

  const urls = extractOutputUrls(output);
  if (urls.length === 0) {
    throw new Error("Replicate returned no output");
  }
  return urls;
}

function extractUrl(item: unknown): string {
  const str = String(item);
  if (str.startsWith("http")) return str;
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    if (typeof obj.url === "function") {
      const u = String((obj.url as () => unknown)());
      if (u.startsWith("http")) return u;
    }
    if (typeof obj.url === "string" && obj.url.startsWith("http"))
      return obj.url;
    if (typeof obj.href === "string" && obj.href.startsWith("http"))
      return obj.href;
  }
  throw new Error(
    `Cannot extract URL from Replicate output: ${str.slice(0, 200)}`
  );
}

function extractOutputUrls(output: unknown): string[] {
  if (Array.isArray(output)) {
    return output.map(extractUrl);
  }
  return [extractUrl(output)];
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Generate a short video from a reference image (MiniMax image-to-video).
 * Uses `subject_reference` when possible for stronger identity (Replicate MiniMax schema).
 */
export async function generateVideo(
  userId: string,
  input: VideoGenerationInput
): Promise<VideoGenerationOutput> {
  const cost = CREDIT_COSTS.REEL;
  const hasCredits = await checkCredits(userId, cost);
  if (!hasCredits) {
    throw new Error(
      `Crédits insuffisants. Coût : ${cost} crédits. Passez à un plan supérieur.`
    );
  }

  const firstFrame = input.baseImageUrl?.trim();
  if (!firstFrame) {
    throw new Error(
      "Une image de référence est obligatoire pour la génération vidéo."
    );
  }

  const preset: ReelStylePreset = input.reelStylePreset ?? "stable_face";
  const prompt = buildVideoPrompt({
    videoType: input.videoType,
    script: input.script,
    effects: input.effects,
    reelStylePreset: preset,
  });

  const subjectRef = (input.subjectReferenceUrl?.trim() || firstFrame).trim();
  const hasReferenceImage = Boolean(subjectRef);

  // Sprint 7 — pick the best model for this preset, given whether we have a
  // reference image (some models like Runway Gen-4 don't accept one).
  const modelDesc = resolveReplicateVideoModel({ preset, hasReferenceImage });
  const model = modelDesc.id;
  const usePromptOptimizer = preset === "creative" && modelDesc.internalPromptOptimizer;

  const params: Record<string, unknown> = { prompt };
  if (modelDesc.supportsImageRef && firstFrame) {
    params.first_frame_image = firstFrame;
    if (subjectRef) params.subject_reference = subjectRef;
  }
  if (modelDesc.internalPromptOptimizer) {
    params.prompt_optimizer = usePromptOptimizer;
  }

  try {
    console.log("[ai-video] Generating video...");
    console.log("[ai-video] Model:", model, "(", modelDesc.label, ")");
    console.log("[ai-video] Preset:", preset, "prompt_optimizer:", usePromptOptimizer);

    const outputUrls = await runReplicatePrediction(model, params);

    if (outputUrls.length === 0) {
      throw new Error("No video generated");
    }

    let finalVideoUrl: string = outputUrls[0];
    let lipSyncApplied = false;
    let lipSyncModel: string | null = null;

    // Sprint 10 — Lip-sync post-process. When the user picked `lip_sync` AND
    // provided an audioUrl, we run the base video through a dedicated lip-sync
    // model so the speaker's mouth matches the audio. We only consume credits
    // once for the whole pipeline (base + post-process).
    if (preset === "lip_sync" && input.audioUrl?.trim()) {
      const lipSync = resolveLipSyncModel();
      if (lipSync) {
        try {
          console.log("[ai-video] Lip-sync post-process:", lipSync.label);
          const syncOutput = await runReplicatePrediction(lipSync.id, {
            video: finalVideoUrl,
            audio: input.audioUrl.trim(),
          });
          if (syncOutput.length > 0) {
            finalVideoUrl = syncOutput[0];
            lipSyncApplied = true;
            lipSyncModel = lipSync.id;
          }
        } catch (syncErr) {
          // Soft-fail: keep the base video so the user still gets something.
          console.warn(
            "[ai-video] lip-sync post-process failed, keeping base video:",
            syncErr instanceof Error ? syncErr.message : syncErr
          );
        }
      }
    }

    const videoFilename = `reel-${input.influencerId}-${nanoid(6)}.mp4`;
    const storedUrl = await uploadFromUrl(finalVideoUrl, videoFilename);

    await deductCredits(userId, cost);

    return {
      videoUrl: storedUrl,
      parameters: {
        ...params,
        replicateModel: model,
        durationRequestedSec: input.duration,
        lipSyncApplied,
        lipSyncModel,
      },
    };
  } catch (error) {
    console.error("[ai-video] generateVideo error:", error);
    throw error;
  }
}
