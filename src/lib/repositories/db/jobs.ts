import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { creditsLedger, jobs, posts } from "@/lib/db/schema";
import { CREDIT_COSTS, debitKey, refundKey } from "@/lib/credits";
import { getEnv } from "@/lib/env";
import { ensureUser, getCreditBalance } from "@/lib/repositories/db/credits";

export { ensureUser, getCreditBalance };

export async function debitCredits(input: {
  userId: string;
  jobId: string;
  amount?: number;
}): Promise<{ ok: true; balance: number } | { ok: false; balance: number }> {
  const db = getDb();
  const env = getEnv();
  const amount = input.amount ?? CREDIT_COSTS.post;
  await ensureUser(input.userId);

  if (!env.CREDITS_ENFORCED) {
    await db
      .insert(creditsLedger)
      .values({
        userId: input.userId,
        delta: -amount,
        reason: "generation_debit",
        jobId: input.jobId,
        idempotencyKey: debitKey(input.jobId),
      })
      .onConflictDoNothing();
    return { ok: true, balance: await getCreditBalance(input.userId) };
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`);

    const existing = await tx
      .select({ id: creditsLedger.id })
      .from(creditsLedger)
      .where(eq(creditsLedger.idempotencyKey, debitKey(input.jobId)))
      .limit(1);
    if (existing.length > 0) {
      const balanceRows = await tx
        .select({
          balance: sql<number>`coalesce(sum(${creditsLedger.delta}), 0)`,
        })
        .from(creditsLedger)
        .where(eq(creditsLedger.userId, input.userId));
      return { ok: true as const, balance: Number(balanceRows[0]?.balance ?? 0) };
    }

    const balanceRows = await tx
      .select({
        balance: sql<number>`coalesce(sum(${creditsLedger.delta}), 0)`,
      })
      .from(creditsLedger)
      .where(eq(creditsLedger.userId, input.userId));
    const balance = Number(balanceRows[0]?.balance ?? 0);
    if (balance < amount) {
      return { ok: false as const, balance };
    }

    await tx.insert(creditsLedger).values({
      userId: input.userId,
      delta: -amount,
      reason: "generation_debit",
      jobId: input.jobId,
      idempotencyKey: debitKey(input.jobId),
    });

    return { ok: true as const, balance: balance - amount };
  });
}

export async function refundCredits(input: { userId: string; jobId: string }) {
  const db = getDb();
  // Refund the exact debit amount for this job (idempotent).
  await db.execute(sql`
    insert into credits_ledger (id, user_id, delta, reason, job_id, idempotency_key, created_at)
    select gen_random_uuid(), ${input.userId}, -debit.delta, 'generation_refund', ${input.jobId}, ${refundKey(input.jobId)}, now()
    from credits_ledger as debit
    where debit.idempotency_key = ${debitKey(input.jobId)}
      and debit.reason = 'generation_debit'
      and debit.delta < 0
    on conflict (idempotency_key) do nothing
  `);
}

export async function createJob(input: {
  id: string;
  ownerId: string;
  kind: "preview" | "post" | "video" | "lora_training";
  model: string;
  previewId?: string;
  postId?: string;
  characterId?: string;
}) {
  const db = getDb();
  await ensureUser(input.ownerId);
  await db.insert(jobs).values({
    id: input.id,
    ownerId: input.ownerId,
    kind: input.kind,
    model: input.model,
    previewId: input.previewId,
    postId: input.postId,
    characterId: input.characterId,
    status: "queued",
  });
}

export async function markJobRunning(jobId: string, predictionId?: string) {
  const db = getDb();
  await db
    .update(jobs)
    .set({
      status: "running",
      startedAt: new Date(),
      predictionId,
      attempts: sql`${jobs.attempts} + 1`,
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "queued")));
}

export async function markJobSucceeded(input: {
  jobId: string;
  durationMs: number;
  providerMetrics?: { predictTime?: number };
}) {
  const db = getDb();
  await db
    .update(jobs)
    .set({
      status: "succeeded",
      completedAt: new Date(),
      durationMs: input.durationMs,
      providerMetrics: input.providerMetrics,
    })
    .where(eq(jobs.id, input.jobId));
}

export async function markJobFailed(input: {
  jobId: string;
  status: "failed" | "timed_out" | "canceled";
  errorCode: string;
  errorMessage?: string;
}) {
  const db = getDb();
  await db
    .update(jobs)
    .set({
      status: input.status,
      completedAt: new Date(),
      errorCode: input.errorCode,
      errorMessage: input.errorMessage?.slice(0, 500),
    })
    .where(eq(jobs.id, input.jobId));
}

export async function getJobForOwner(jobId: string, ownerId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.ownerId, ownerId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getJobByPredictionId(predictionId: string) {
  const db = getDb();
  const rows = await db.select().from(jobs).where(eq(jobs.predictionId, predictionId)).limit(1);
  return rows[0] ?? null;
}

export async function createPendingPost(input: {
  id: string;
  characterId: string;
  ownerId: string;
  sourceKind: "format" | "scene" | "reel" | "legacy" | "post";
  sourceRef: string;
  sourceLabel: string;
  prompt: string;
  mediaKind?: "image" | "video";
  parentPostId?: string;
  regenOfPostId?: string;
  contentType?: string;
}) {
  const db = getDb();
  await ensureUser(input.ownerId);
  await db.insert(posts).values({
    id: input.id,
    characterId: input.characterId,
    ownerId: input.ownerId,
    status: "pending",
    mediaKind: input.mediaKind ?? "image",
    parentPostId: input.parentPostId,
    regenOfPostId: input.regenOfPostId,
    contentType: input.contentType ?? "image/jpeg",
    sourceKind: input.sourceKind,
    sourceRef: input.sourceRef,
    sourceLabel: input.sourceLabel,
    prompt: input.prompt,
  });
}

export async function markPostSucceeded(input: {
  postId: string;
  imageKey: string;
  caption?: string;
  contentType?: string;
  mediaKind?: "image" | "video";
}) {
  const db = getDb();
  await db
    .update(posts)
    .set({
      status: "succeeded",
      imageKey: input.imageKey,
      caption: input.caption ?? null,
      completedAt: new Date(),
      ...(input.contentType ? { contentType: input.contentType } : {}),
      ...(input.mediaKind ? { mediaKind: input.mediaKind } : {}),
    })
    .where(eq(posts.id, input.postId));
}

export async function markPostFailed(postId: string) {
  const db = getDb();
  await db
    .update(posts)
    .set({ status: "failed", completedAt: new Date() })
    .where(eq(posts.id, postId));
}

export async function markPostIdentity(input: {
  postId: string;
  score: number | null;
  status: "pending" | "fidele" | "proche" | "derive" | "non_mesure";
  model: string | null;
  attempts: number;
}) {
  const db = getDb();
  await db
    .update(posts)
    .set({
      identityScore: input.score,
      identityStatus: input.status,
      identityModel: input.model,
      generationAttempts: input.attempts,
    })
    .where(eq(posts.id, input.postId));
}

export async function p95DurationMs(
  kind: "preview" | "post" | "video" | "lora_training",
): Promise<number | null> {
  const db = getDb();
  const rows = await db.execute<{ p95: number | null }>(sql`
    select percentile_cont(0.95) within group (order by duration_ms) as p95
    from jobs
    where kind = ${kind}
      and status = 'succeeded'
      and duration_ms is not null
      and completed_at > now() - interval '7 days'
  `);
  const value = rows.rows[0]?.p95;
  return typeof value === "number" ? value : null;
}
