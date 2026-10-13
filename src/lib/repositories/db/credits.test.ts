import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CREDIT_COSTS } from "@/lib/credits";
import { creditsLedger, jobs, previews, users } from "@/lib/db/schema";
import type { Traits } from "@/lib/traits";
import {
  debitCredits,
  getCreditBalance,
  refundCredits,
} from "@/lib/repositories/db/jobs";
import { grantCredits } from "@/lib/repositories/db/credits";
import {
  createTestDb,
  destroyTestDb,
  withCreditsEnforced,
  type TestDatabase,
} from "@/test/db";
import type { PGlite } from "@electric-sql/pglite";

async function seedUser(db: TestDatabase, userId: string) {
  await db.insert(users).values({ id: userId, plan: "decouverte" });
}

async function seedJob(db: TestDatabase, userId: string, jobId: string) {
  const previewId = randomUUID();
  const traits: Traits = {
    gender: "femme",
    age: "25-34",
    eyes: "marron",
    hairLength: "long",
    hairColor: "chatain",
    body: "athletique",
    skin: "claire",
  };
  await db.insert(previews).values({
    id: previewId,
    ownerId: userId,
    traits,
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  await db.insert(jobs).values({
    id: jobId,
    ownerId: userId,
    kind: "preview",
    model: "test",
    previewId,
    status: "queued",
  });
}

describe("credits ledger", () => {
  let client: PGlite;
  let db: TestDatabase;

  beforeEach(async () => {
    withCreditsEnforced(true);
    ({ client, db } = await createTestDb());
  });

  afterEach(async () => {
    await destroyTestDb(client);
  });

  it("débite quand le solde suffit et refuse sans écrire sinon", async () => {
    const userId = "user_ok";
    const jobOk = randomUUID();
    const jobKo = randomUUID();
    await seedUser(db, userId);
    await seedJob(db, userId, jobOk);
    await seedJob(db, userId, jobKo);
    await grantCredits({
      userId,
      delta: 1,
      reason: "grant",
      idempotencyKey: "grant:test:1",
    });

    const ok = await debitCredits({ userId, jobId: jobOk });
    expect(ok).toEqual({ ok: true, balance: 0 });

    const ko = await debitCredits({ userId, jobId: jobKo });
    expect(ko).toEqual({ ok: false, balance: 0 });

    const rows = await db.select().from(creditsLedger).where(eq(creditsLedger.userId, userId));
    expect(rows.filter((r) => r.reason === "generation_debit")).toHaveLength(1);
  });

  it("sérialise 20 débits concurrents sur un solde de 10", async () => {
    const userId = "user_race";
    await seedUser(db, userId);
    await grantCredits({
      userId,
      delta: 10,
      reason: "grant",
      idempotencyKey: "grant:race:10",
    });

    const jobIds = Array.from({ length: 20 }, () => randomUUID());
    await Promise.all(jobIds.map((jobId) => seedJob(db, userId, jobId)));

    const results = await Promise.all(
      jobIds.map((jobId) => debitCredits({ userId, jobId })),
    );

    const successes = results.filter((r) => r.ok).length;
    const balance = await getCreditBalance(userId);
    expect(successes).toBe(10);
    expect(balance).toBe(0);
    expect(results.every((r) => r.balance >= 0)).toBe(true);

    const sum = await db
      .select({ balance: sql<number>`coalesce(sum(${creditsLedger.delta}), 0)` })
      .from(creditsLedger)
      .where(eq(creditsLedger.userId, userId));
    expect(Number(sum[0]?.balance ?? 0)).toBe(0);
  });

  it("ne débite qu'une fois le même jobId", async () => {
    const userId = "user_idem";
    const jobId = randomUUID();
    await seedUser(db, userId);
    await seedJob(db, userId, jobId);
    await grantCredits({
      userId,
      delta: 5,
      reason: "grant",
      idempotencyKey: "grant:idem:5",
    });

    const first = await debitCredits({ userId, jobId });
    const second = await debitCredits({ userId, jobId });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.balance).toBe(4);

    const debits = await db
      .select()
      .from(creditsLedger)
      .where(eq(creditsLedger.reason, "generation_debit"));
    expect(debits).toHaveLength(1);
  });

  it("rembourse seulement si un débit existe, une seule fois", async () => {
    const userId = "user_refund";
    const jobWithoutDebit = randomUUID();
    const jobWithDebit = randomUUID();
    await seedUser(db, userId);
    await seedJob(db, userId, jobWithoutDebit);
    await seedJob(db, userId, jobWithDebit);
    await grantCredits({
      userId,
      delta: 3,
      reason: "grant",
      idempotencyKey: "grant:refund:3",
    });

    await refundCredits({ userId, jobId: jobWithoutDebit });
    expect(await getCreditBalance(userId)).toBe(3);

    await debitCredits({ userId, jobId: jobWithDebit });
    await refundCredits({ userId, jobId: jobWithDebit });
    await refundCredits({ userId, jobId: jobWithDebit });
    expect(await getCreditBalance(userId)).toBe(3);

    const refunds = await db
      .select()
      .from(creditsLedger)
      .where(eq(creditsLedger.reason, "generation_refund"));
    expect(refunds).toHaveLength(1);
  });

  it("interdit les UPDATE sur credits_ledger", async () => {
    const userId = "user_imm";
    await seedUser(db, userId);
    await grantCredits({
      userId,
      delta: 2,
      reason: "grant",
      idempotencyKey: "grant:imm:2",
    });
    const [row] = await db.select().from(creditsLedger).limit(1);
    try {
      await db
        .update(creditsLedger)
        .set({ delta: 99 })
        .where(eq(creditsLedger.id, row!.id));
      expect.unreachable("UPDATE devrait échouer");
    } catch (error) {
      const cause = error instanceof Error && "cause" in error ? error.cause : error;
      expect(String(cause)).toMatch(/immutable/i);
    }
  });

  it("KPI: solde exact après débits et remboursements", async () => {
    const userId = "user_kpi";
    await seedUser(db, userId);
    await grantCredits({
      userId,
      delta: 150,
      reason: "grant",
      idempotencyKey: "grant:kpi:150",
    });

    const jobIds = Array.from({ length: 100 }, () => randomUUID());
    await Promise.all(jobIds.map((jobId) => seedJob(db, userId, jobId)));

    const fails = new Set(jobIds.slice(0, 7));
    for (const jobId of jobIds) {
      const result = await debitCredits({ userId, jobId });
      expect(result.ok).toBe(true);
      if (fails.has(jobId)) {
        await refundCredits({ userId, jobId });
      }
    }

    const balance = await getCreditBalance(userId);
    expect(balance).toBe(57);
    const sum = await db
      .select({ balance: sql<number>`coalesce(sum(${creditsLedger.delta}), 0)` })
      .from(creditsLedger)
      .where(eq(creditsLedger.userId, userId));
    expect(Number(sum[0]?.balance ?? 0)).toBe(57);
    expect(CREDIT_COSTS.post).toBe(1);
  });

  it("rembourse le débit vidéo exact (10 crédits)", async () => {
    const userId = "user_video_refund";
    const jobId = randomUUID();
    await seedUser(db, userId);
    await seedJob(db, userId, jobId);
    await grantCredits({
      userId,
      delta: 20,
      reason: "grant",
      idempotencyKey: "grant:video:20",
    });

    const debit = await debitCredits({
      userId,
      jobId,
      amount: CREDIT_COSTS.video,
    });
    expect(debit.ok).toBe(true);
    expect(await getCreditBalance(userId)).toBe(10);

    await refundCredits({ userId, jobId });
    expect(await getCreditBalance(userId)).toBe(20);
  });
});
