import { db } from "@/server/db";

// ──────────────────────────────────────────────
// Stale generation watchdog
//
// Non-batch generations (photo studio, scene-first, reels) run inside
// Next.js `after()` on the same serverless invocation (maxDuration 300s on
// the tRPC route). If the function dies mid-flight (timeout, redeploy,
// crash), the Content stays GENERATING and its GenerationJob stays
// PENDING forever — the UI polls getGenerationStatus and spins endlessly.
//
// This sweeper runs from the process-batches cron (every 5 min) and fails
// those zombies out loudly so the user gets an actionable error instead of
// a dead-end.
//
// Exclusions:
//   - batch drafts (batchId != null): reclaimed by batch.service
//   - publish claims: they keep their mediaUrls (non-empty), we only touch
//     contents that never produced media
// ──────────────────────────────────────────────

/**
 * 20 min: comfortably above the worst-case legitimate generation
 * (Kling I2V 300s + retries + lip-sync), far below "user gave up".
 */
const STALE_GENERATION_MS = 20 * 60 * 1000;

export const STALE_GENERATION_ERROR =
  "La génération a été interrompue côté serveur (timeout ou redéploiement). " +
  "Aucun crédit n'est débité tant qu'aucune image n'est livrée — relance la génération.";

export interface StaleSweepResult {
  failedContents: number;
  failedJobs: number;
}

export async function failStaleGenerations(opts?: {
  olderThanMs?: number;
}): Promise<StaleSweepResult> {
  const cutoff = new Date(
    Date.now() - (opts?.olderThanMs ?? STALE_GENERATION_MS)
  );

  const stale = await db.content.findMany({
    where: {
      status: "GENERATING",
      batchId: null,
      mediaUrls: { isEmpty: true },
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
    take: 100,
  });
  if (stale.length === 0) return { failedContents: 0, failedJobs: 0 };

  const ids = stale.map((c) => c.id);
  const contents = await db.content.updateMany({
    where: { id: { in: ids }, status: "GENERATING" },
    data: { status: "FAILED" },
  });
  const jobs = await db.generationJob.updateMany({
    where: {
      contentId: { in: ids },
      status: { in: ["PENDING", "PROCESSING"] },
    },
    data: { status: "FAILED", error: STALE_GENERATION_ERROR },
  });

  // ≥3 zombies in one sweep = systemic problem (provider down, deploy storm),
  // not a one-off. error level so a log-based alert can catch it.
  const log = contents.count >= 3 ? console.error : console.warn;
  log(
    `[stale-generation] Swept ${contents.count} zombie generation(s) → FAILED (${jobs.count} job(s) updated)`
  );
  return { failedContents: contents.count, failedJobs: jobs.count };
}
