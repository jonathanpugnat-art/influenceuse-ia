#!/usr/bin/env node
/**
 * Smoke KPI P1 — vérifie l'idempotence ledger via l'API (mode test).
 * Usage: node --env-file=.env.local --import tsx scripts/p1-smoke-credits.ts
 */
import { randomUUID } from "node:crypto";

import { getEnv, resetEnvCache } from "../src/lib/env";
import { setDbForTests } from "../src/lib/db/client";
import {
  debitCredits,
  getCreditBalance,
  refundCredits,
} from "../src/lib/repositories/db/jobs";
import { ensureUser, grantCredits } from "../src/lib/repositories/db/credits";
import { getDb } from "../src/lib/db/client";
import { jobs, previews } from "../src/lib/db/schema";

async function main() {
  resetEnvCache();
  process.env.CREDITS_ENFORCED = "true";
  process.env.INITIAL_CREDITS = "0";
  resetEnvCache();
  getEnv();

  const userId = `smoke_${Date.now()}`;
  await ensureUser(userId);
  await grantCredits({
    userId,
    delta: 100,
    reason: "grant",
    idempotencyKey: `smoke:grant:${userId}`,
  });

  const db = getDb();
  let success = 0;
  let refunded = 0;

  for (let i = 0; i < 100; i++) {
    const jobId = randomUUID();
    const previewId = randomUUID();
    await db.insert(previews).values({
      id: previewId,
      ownerId: userId,
      traits: {
        gender: "femme",
        age: "25-34",
        eyes: "marron",
        hairLength: "long",
        hairColor: "chatain",
        body: "athletique",
        skin: "claire",
      },
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await db.insert(jobs).values({
      id: jobId,
      ownerId: userId,
      kind: "preview",
      model: "smoke",
      previewId,
      status: "queued",
    });

    const result = await debitCredits({ userId, jobId });
    if (result.ok) {
      success += 1;
      if (i < 7) {
        await refundCredits({ userId, jobId });
        refunded += 1;
      }
    }
  }

  const balance = await getCreditBalance(userId);
  const expected = 100 - success + refunded;
  console.log(
    JSON.stringify(
      {
        userId,
        success,
        refunded,
        balance,
        expected,
        ok: balance === expected,
      },
      null,
      2,
    ),
  );
  setDbForTests(null);
  if (balance !== expected) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
