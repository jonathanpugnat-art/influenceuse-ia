import { db } from "@/server/db";
import { generateContentImage } from "@/server/services/ai-image.service";
import { emitEvent } from "@/server/services/webhook.service";
import { refundCredits } from "@/server/services/credits.service";
import { CREDIT_COSTS } from "@/lib/constants";
import type { Gender } from "@/lib/prompts/image-prompts";

// ──────────────────────────────────────────────
// Batch image generation service (Phase 4)
//
// A `ContentBatch` row owns N `Content` rows in DRAFT (created by Phase 3
// `generateContentPlan`). This service walks the batch and turns each draft
// into a ready-to-publish PHOTO/REEL one by one.
//
// We process **a small slice per call** so we can run on Vercel without
// hitting function timeouts or Replicate rate-limits. The cron route just
// calls processNextBatchSlice() periodically — same pattern as the publisher.
// ──────────────────────────────────────────────

/** Hard upper bound for a single slice (server timeout / rate-limit safety). */
const DEFAULT_SLICE_SIZE = 3;
/** Time budget before the function returns and lets the next cron tick continue. */
const DEFAULT_TIME_BUDGET_MS = 45_000;

export interface BatchSliceResult {
  batchesTouched: number;
  generated: number;
  failed: number;
  remaining: number;
  durationMs: number;
}

interface DraftToProcess {
  id: string;
  scene: string;
  sceneDescription?: string;
  pose: string;
  outfit: string;
  expression: string;
  photoStyle: string;
  timeOfDay: string;
  location?: string;
  customPrompt?: string;
}

function pickStringParam(
  params: Record<string, unknown> | null | undefined,
  key: string,
  fallback: string
): string {
  const v = params?.[key];
  return typeof v === "string" && v.trim().length > 0 ? v : fallback;
}

/**
 * Process up to `sliceSize` drafts across pending batches, oldest first.
 * Each draft becomes a real PHOTO via Replicate (face reference ON by default),
 * and is moved to SCHEDULED so the publisher can pick it up at scheduledAt.
 *
 * Errors on a single draft never abort the whole slice — they mark that draft
 * FAILED and continue.
 */
function isApprovedForBatch(
  generationParams: unknown
): boolean {
  // S5: new plans set approvedForBatch:false until user validates the lot.
  // Legacy drafts without the flag stay processable.
  if (!generationParams || typeof generationParams !== "object") return true;
  const flag = (generationParams as Record<string, unknown>).approvedForBatch;
  return flag !== false;
}

/**
 * Batch drafts stuck in GENERATING (function killed mid-generation) are never
 * re-picked because the slice query only looks at DRAFT. Reclaim them as
 * FAILED after this delay so the user can see them and hit "retry failures".
 * We only touch batch items without media — publisher-claimed contents keep
 * their mediaUrls and are recovered by the publish cron instead.
 */
const STUCK_GENERATING_MS = 30 * 60 * 1000;

async function reclaimStuckGeneratingDrafts(): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_GENERATING_MS);
  const { count } = await db.content.updateMany({
    where: {
      status: "GENERATING",
      type: "PHOTO",
      batchId: { not: null },
      mediaUrls: { isEmpty: true },
      updatedAt: { lt: cutoff },
    },
    data: { status: "FAILED" },
  });
  if (count > 0) {
    console.warn(`[batch] Reclaimed ${count} stuck GENERATING draft(s) → FAILED`);
  }
}

export async function processNextBatchSlice(opts?: {
  sliceSize?: number;
  timeBudgetMs?: number;
  /** When set, only process drafts from this batch. */
  batchId?: string;
}): Promise<BatchSliceResult> {
  const sliceSize = opts?.sliceSize ?? DEFAULT_SLICE_SIZE;
  const timeBudgetMs = opts?.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const startedAt = Date.now();

  await reclaimStuckGeneratingDrafts();

  // Over-fetch then filter approval — Prisma JSON path filters vary by DB.
  const candidates = await db.content.findMany({
    where: {
      status: "DRAFT",
      type: "PHOTO",
      batchId: opts?.batchId ? opts.batchId : { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: Math.max(sliceSize * 4, 12),
    include: {
      influencer: {
        select: {
          id: true,
          age: true,
          gender: true,
          style: true,
          baseImageUrl: true,
          avatarUrl: true,
          userId: true,
          loraStatus: true,
          loraUrl: true,
          loraTriggerWord: true,
        },
      },
    },
  });

  const drafts = candidates
    .filter((d) => isApprovedForBatch(d.generationParams))
    .slice(0, sliceSize);

  if (drafts.length === 0) {
    return {
      batchesTouched: 0,
      generated: 0,
      failed: 0,
      remaining: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  console.log(`[batch] Slice picked ${drafts.length} approved drafts`);

  const touchedBatches = new Set<string>();
  let generated = 0;
  let failed = 0;

  for (const draft of drafts) {
    if (Date.now() - startedAt > timeBudgetMs) {
      console.warn("[batch] Time budget exceeded, stopping slice early");
      break;
    }

    const inf = draft.influencer;
    if (!inf) {
      // Should not happen with FK in place, but defensively mark FAILED.
      await db.content.update({
        where: { id: draft.id },
        data: { status: "FAILED" },
      });
      failed++;
      continue;
    }

    if (draft.batchId) touchedBatches.add(draft.batchId);

    const params = (draft.generationParams ?? {}) as Record<string, unknown>;
    const draftParams: DraftToProcess = {
      id: draft.id,
      scene: pickStringParam(params, "scene", "studio"),
      sceneDescription:
        typeof params.sceneDescription === "string" &&
        params.sceneDescription.trim().length > 0
          ? params.sceneDescription.trim()
          : typeof params.concept === "string" && params.concept.trim().length > 0
            ? params.concept.trim()
            : undefined,
      pose: pickStringParam(params, "pose", "portrait"),
      outfit: pickStringParam(params, "outfit", ""),
      expression: pickStringParam(params, "expression", "natural"),
      photoStyle: pickStringParam(params, "photoStyle", "natural"),
      timeOfDay: pickStringParam(params, "timeOfDay", "natural"),
      location:
        typeof params.location === "string" ? params.location : undefined,
      customPrompt:
        typeof params.customPrompt === "string"
          ? params.customPrompt
          : typeof params.concept === "string"
          ? (params.concept as string)
          : undefined,
    };

    const style = (inf.style ?? {}) as Record<string, string | undefined>;
    const referenceImageUrl =
      inf.baseImageUrl?.trim() || inf.avatarUrl?.trim() || undefined;

    // Atomic claim DRAFT → GENERATING: the status condition guarantees only
    // one concurrent tick (cron + approveBatch kick, or overlapping crons)
    // generates — and charges credits for — this draft.
    const claimed = await db.content.updateMany({
      where: { id: draft.id, status: "DRAFT" },
      data: { status: "GENERATING" },
    });
    if (claimed.count === 0) continue;

    try {
      const result = await generateContentImage(
        inf.userId,
        inf.age,
        {
          gender: (inf.gender as Gender) ?? "female",
          ethnicity: style.ethnicity,
          hairColor: style.hairColor,
          hairStyle: style.hairStyle,
          bodyType: style.bodyType,
          fashionStyle: style.fashionStyle,
        },
        {
          influencerId: inf.id,
          baseImageUrl: referenceImageUrl,
          useReferenceFace: true,
          scene: draftParams.scene,
          sceneDescription: draftParams.sceneDescription,
          pose: draftParams.pose,
          outfit: draftParams.outfit,
          expression: draftParams.expression,
          style: draftParams.photoStyle,
          lighting: draftParams.timeOfDay,
          location: draftParams.location,
          isNsfw: draft.contentMode === "NSFW",
          customPrompt: draftParams.customPrompt,
          numberOfImages: 1,
          loraUrl:
            inf.loraStatus === "READY" && inf.loraUrl?.trim()
              ? inf.loraUrl.trim()
              : undefined,
          loraTriggerWord:
            inf.loraStatus === "READY" && inf.loraTriggerWord?.trim()
              ? inf.loraTriggerWord.trim()
              : undefined,
        }
      );

      // Promote to SCHEDULED if scheduledAt exists, otherwise READY.
      const nextStatus =
        draft.scheduledAt && draft.scheduledAt > new Date()
          ? "SCHEDULED"
          : "READY";

      try {
        await db.content.update({
          where: { id: draft.id },
          data: {
            status: nextStatus,
            mediaUrls: result.imageUrls,
            thumbnailUrl: result.imageUrls[0] ?? null,
            promptUsed: result.promptUsed,
            negativePrompt: result.negativePrompt,
            generationParams: {
              ...params,
              modelParams: result.parameters as object,
              batchProcessedAt: new Date().toISOString(),
            } as object,
          },
        });
      } catch (persistErr) {
        // Credits were charged inside generateContentImage but the result was
        // never persisted — refund so the user isn't billed for nothing.
        await refundCredits(inf.userId, CREDIT_COSTS.PHOTO);
        throw persistErr;
      }
      generated++;
    } catch (err) {
      console.error(`[batch] Draft ${draft.id} failed:`, err);
      await db.content.update({
        where: { id: draft.id },
        data: { status: "FAILED" },
      });
      failed++;
    }
  }

  // Remaining = approved DRAFTs still waiting for image generation.
  const remainingCandidates = await db.content.findMany({
    where: {
      status: "DRAFT",
      type: "PHOTO",
      batchId: opts?.batchId ? opts.batchId : { not: null },
    },
    select: { generationParams: true },
    take: 200,
  });
  const remaining = remainingCandidates.filter((d) =>
    isApprovedForBatch(d.generationParams)
  ).length;

  // Emit BATCH_COMPLETED for any touched batch that has no DRAFT/GENERATING
  // contents left (Phase 5 distribution event).
  for (const batchId of touchedBatches) {
    const remainingForBatch = await db.content.count({
      where: { batchId, status: { in: ["DRAFT", "GENERATING"] } },
    });
    if (remainingForBatch > 0) continue;

    const batch = await db.contentBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        name: true,
        influencer: { select: { id: true, name: true, userId: true } },
        contents: { select: { status: true } },
      },
    });
    if (!batch) continue;

    const total = batch.contents.length;
    const ready = batch.contents.filter(
      (c) => c.status === "READY" || c.status === "SCHEDULED" || c.status === "PUBLISHED"
    ).length;
    const failedCount = batch.contents.filter((c) => c.status === "FAILED").length;

    await emitEvent(batch.influencer.userId, "BATCH_COMPLETED", {
      batchId: batch.id,
      name: batch.name,
      total,
      ready,
      failed: failedCount,
      influencer: { id: batch.influencer.id, name: batch.influencer.name },
    });
  }

  console.log(
    `[batch] Slice done: generated=${generated} failed=${failed} remaining=${remaining}`
  );

  return {
    batchesTouched: touchedBatches.size,
    generated,
    failed,
    remaining,
    durationMs: Date.now() - startedAt,
  };
}

export interface BatchStatus {
  batchId: string;
  name: string;
  total: number;
  draft: number;
  /** DRAFTs still waiting for lot validation (approvedForBatch === false). */
  pendingReview: number;
  /** DRAFTs approved and eligible for image batch. */
  approvedDraft: number;
  generating: number;
  ready: number;
  scheduled: number;
  published: number;
  failed: number;
}

/** Lightweight stats consumed by the calendar UI to show batch progress. */
export async function getBatchStatus(batchId: string): Promise<BatchStatus | null> {
  const batch = await db.contentBatch.findUnique({
    where: { id: batchId },
    select: { id: true, name: true },
  });
  if (!batch) return null;

  const grouped = await db.content.groupBy({
    by: ["status"],
    where: { batchId },
    _count: { _all: true },
  });

  const counts: Record<string, number> = Object.fromEntries(
    grouped.map((g) => [g.status, g._count._all])
  );

  const draftRows = await db.content.findMany({
    where: { batchId, status: "DRAFT" },
    select: { generationParams: true },
  });
  const pendingReview = draftRows.filter(
    (d) => !isApprovedForBatch(d.generationParams)
  ).length;
  const approvedDraft = draftRows.length - pendingReview;

  const draft = counts["DRAFT"] ?? 0;
  const generating = counts["GENERATING"] ?? 0;
  const ready = counts["READY"] ?? 0;
  const scheduled = counts["SCHEDULED"] ?? 0;
  const published = counts["PUBLISHED"] ?? 0;
  const failed = counts["FAILED"] ?? 0;

  return {
    batchId: batch.id,
    name: batch.name,
    total: draft + generating + ready + scheduled + published + failed,
    draft,
    pendingReview,
    approvedDraft,
    generating,
    ready,
    scheduled,
    published,
    failed,
  };
}
