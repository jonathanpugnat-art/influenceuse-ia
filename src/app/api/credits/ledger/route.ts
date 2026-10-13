import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db/client";
import { creditsLedger } from "@/lib/db/schema";
import { ensureUser } from "@/lib/repositories/db/credits";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireUserId();
  await ensureUser(userId);
  const db = getDb();
  const rows = await db
    .select({
      id: creditsLedger.id,
      delta: creditsLedger.delta,
      reason: creditsLedger.reason,
      jobId: creditsLedger.jobId,
      stripeRef: creditsLedger.stripeRef,
      createdAt: creditsLedger.createdAt,
    })
    .from(creditsLedger)
    .where(eq(creditsLedger.userId, userId))
    .orderBy(desc(creditsLedger.createdAt))
    .limit(20);

  return NextResponse.json({
    success: true,
    data: {
      entries: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    },
    error: null,
  });
}
