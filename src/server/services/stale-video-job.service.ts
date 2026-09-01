/**
 * Stale Seedance / Remix job watchdog.
 *
 * Those rows hold credits and wait for a FAL webhook. If the webhook never
 * arrives (expired queue, lost delivery, outage), the job stays PENDING or
 * IN_PROGRESS forever — the studio shows "Génération en cours" and the
 * hold is never released. Prod example: Seedance Luana 23/08 04:07,
 * 10s 480p, 180 crédits still held after 8+ days.
 *
 * N = 20 minutes (`STALE_VIDEO_JOB_MS`). Above a legitimate Seedance
 * 30s / 720p render + queue, same budget as photo/reel
 * `STALE_GENERATION_MS`. After N we:
 *   1. Try one last FAL reconcile (the video may already be ready).
 *   2. If still open, call `failSeedanceJob` / `failRemixJob` — that
 *      path `refundCredits` and marks the row REFUNDED (existing
 *      terminal fail state; the UI stops spinning).
 *
 * Hooked from the process-batches cron (global) and from get/list
 * procedures so a page view unsticks without waiting for cron.
 *
 * Does not touch the PuLID / InstantID face-lock path.
 */

import { db } from "@/server/db";
import {
  failSeedanceJob,
  reconcileSeedanceJob,
} from "@/server/services/seedance.service";
import {
  failRemixJob,
  reconcileRemixJob,
} from "@/server/services/remix.service";

/** 20 min — documented timeout before a Seedance/Remix hold is released. */
export const STALE_VIDEO_JOB_MS = 20 * 60 * 1000;

export const STALE_VIDEO_JOB_ERROR =
  "La génération vidéo n'a pas abouti (webhook manquant ou file expirée après 20 min). " +
  "Les crédits ont été remboursés — relance la génération.";

const OPEN_STATUSES = ["PENDING", "IN_PROGRESS"] as const;

export interface StaleVideoSweepResult {
  seedance: number;
  remix: number;
}

export function isStaleVideoJob(
  createdAt: Date,
  olderThanMs: number = STALE_VIDEO_JOB_MS
): boolean {
  return createdAt.getTime() < Date.now() - olderThanMs;
}

export function isOpenVideoJobStatus(status: string): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

export async function failStaleVideoJobs(opts?: {
  olderThanMs?: number;
  userId?: string;
}): Promise<StaleVideoSweepResult> {
  const olderThanMs = opts?.olderThanMs ?? STALE_VIDEO_JOB_MS;
  const cutoff = new Date(Date.now() - olderThanMs);
  const userFilter = opts?.userId ? { userId: opts.userId } : {};

  const [seedanceRows, remixRows] = await Promise.all([
    db.seedanceJob.findMany({
      where: {
        ...userFilter,
        status: { in: [...OPEN_STATUSES] },
        createdAt: { lt: cutoff },
      },
      select: { id: true, falRequestId: true },
      take: 50,
    }),
    db.remixJob.findMany({
      where: {
        ...userFilter,
        status: { in: [...OPEN_STATUSES] },
        createdAt: { lt: cutoff },
      },
      select: { id: true, falRequestId: true },
      take: 50,
    }),
  ]);

  let seedance = 0;
  for (const row of seedanceRows) {
    const failed = await settleStaleSeedanceJob(row.id, row.falRequestId);
    if (failed) seedance += 1;
  }

  let remix = 0;
  for (const row of remixRows) {
    const failed = await settleStaleRemixJob(row.id, row.falRequestId);
    if (failed) remix += 1;
  }

  if (seedance + remix > 0) {
    const log = seedance + remix >= 3 ? console.error : console.warn;
    log(
      `[stale-video-job] Swept ${seedance} Seedance + ${remix} Remix zombie(s) → REFUNDED`
    );
  }

  return { seedance, remix };
}

/**
 * Time out a single open job if it is older than N. Returns the latest
 * row so getScene / getRemix can serialize the terminal status in the
 * same response (no extra poll). Young open jobs are returned unchanged.
 */
export async function settleOpenSeedanceJobIfStale<
  T extends {
    id: string;
    status: string;
    createdAt: Date;
    falRequestId: string | null;
  },
>(job: T, opts?: { olderThanMs?: number }): Promise<T> {
  if (
    !isOpenVideoJobStatus(job.status) ||
    !isStaleVideoJob(job.createdAt, opts?.olderThanMs)
  ) {
    return job;
  }
  await settleStaleSeedanceJob(job.id, job.falRequestId);
  const fresh = await db.seedanceJob.findUnique({ where: { id: job.id } });
  return (fresh ?? job) as T;
}

export async function settleOpenRemixJobIfStale<
  T extends {
    id: string;
    status: string;
    createdAt: Date;
    falRequestId: string | null;
  },
>(job: T, opts?: { olderThanMs?: number }): Promise<T> {
  if (
    !isOpenVideoJobStatus(job.status) ||
    !isStaleVideoJob(job.createdAt, opts?.olderThanMs)
  ) {
    return job;
  }
  await settleStaleRemixJob(job.id, job.falRequestId);
  const fresh = await db.remixJob.findUnique({ where: { id: job.id } });
  return (fresh ?? job) as T;
}

async function settleStaleSeedanceJob(
  jobId: string,
  falRequestId: string | null
): Promise<boolean> {
  if (falRequestId) {
    await reconcileSeedanceJob(jobId);
  }
  const fresh = await db.seedanceJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  if (!fresh || !isOpenVideoJobStatus(fresh.status)) {
    return false;
  }
  await failSeedanceJob(jobId, STALE_VIDEO_JOB_ERROR);
  return true;
}

async function settleStaleRemixJob(
  jobId: string,
  falRequestId: string | null
): Promise<boolean> {
  if (falRequestId) {
    await reconcileRemixJob(jobId);
  }
  const fresh = await db.remixJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  if (!fresh || !isOpenVideoJobStatus(fresh.status)) {
    return false;
  }
  await failRemixJob(jobId, STALE_VIDEO_JOB_ERROR);
  return true;
}
