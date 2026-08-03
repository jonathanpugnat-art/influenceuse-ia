import { db } from "@/server/db";
import type { GenerationType } from "@/generated/prisma/client";

export function toGenerationErrorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function createPendingGenerationJob(opts: {
  userId: string;
  influencerId: string;
  contentId: string;
  type: GenerationType;
  prompt: string;
  creditsUsed: number;
}) {
  return db.generationJob.create({
    data: {
      userId: opts.userId,
      influencerId: opts.influencerId,
      contentId: opts.contentId,
      type: opts.type,
      status: "PENDING",
      prompt: opts.prompt,
      creditsUsed: opts.creditsUsed,
    },
  });
}

export async function markGenerationJobCompleted(
  contentId: string,
  resultUrl?: string | null
): Promise<void> {
  await db.generationJob.updateMany({
    where: { contentId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      resultUrl: resultUrl ?? undefined,
    },
  });
}

export async function markGenerationJobFailed(
  contentId: string,
  error: string
): Promise<void> {
  await db.generationJob.updateMany({
    where: { contentId },
    data: { status: "FAILED", error },
  });
}

export async function markContentFailed(contentId: string): Promise<void> {
  await db.content.update({
    where: { id: contentId },
    data: { status: "FAILED" },
  });
}

type ScheduleAfterFn = (fn: () => void | Promise<void>) => void;

/**
 * Wraps async content generation: runs `execute`, then marks the job COMPLETED
 * on success or FAILED on error (with optional custom failure handling).
 */
export function scheduleGenerationTask(
  scheduleAfter: ScheduleAfterFn,
  opts: {
    contentId: string;
    logLabel: string;
    execute: () => Promise<{ resultUrl?: string | null }>;
    onFailure?: (errorText: string) => Promise<void>;
  }
): void {
  const task = async () => {
    try {
      const result = await opts.execute();
      await markGenerationJobCompleted(opts.contentId, result.resultUrl);
    } catch (error) {
      const errText = toGenerationErrorText(error);
      console.error(`[${opts.logLabel}] failed:`, errText, error);
      if (opts.onFailure) {
        await opts.onFailure(errText);
      } else {
        await markContentFailed(opts.contentId);
      }
      await markGenerationJobFailed(opts.contentId, errText);
    }
  };

  scheduleAfter(task);
}
