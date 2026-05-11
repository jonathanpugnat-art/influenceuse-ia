import { NextResponse } from "next/server";
import { db } from "@/server/db";

/**
 * GET /api/health
 *
 * Liveness + readiness probe used by uptime monitors (Vercel, BetterStack…).
 * Returns 200 only if the DB is reachable. Lightweight query (`SELECT 1`).
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
        version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.9.0",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[health] DB check failed:", err);
    return NextResponse.json(
      {
        status: "error",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
        error: "database_unreachable",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
