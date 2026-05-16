// Cleanup helper: marks any video generation job that's been "PENDING" for
// more than 2 minutes as FAILED so the user can retry without confusion.
// The webhook in production will be the long-term fix; this is a one-shot
// cleanup after the 2026-05-16 MiniMax E006 incident.

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  const cutoff = new Date(Date.now() - 2 * 60 * 1000);

  const stale = await db.generationJob.findMany({
    where: {
      type: "VIDEO",
      status: "PENDING",
      createdAt: { lt: cutoff },
    },
    select: { id: true, contentId: true, createdAt: true },
  });

  if (stale.length === 0) {
    console.log("No stale VIDEO jobs to clean up.");
  } else {
    console.log(`Marking ${stale.length} stale job(s) as FAILED:`);
    for (const j of stale) {
      console.log(`  - ${j.id} (content=${j.contentId}, created=${j.createdAt.toISOString()})`);
    }
    await db.generationJob.updateMany({
      where: { id: { in: stale.map((j) => j.id) } },
      data: { status: "FAILED", error: "Cleanup: stuck in PENDING (likely orphaned by old MiniMax E006 bug)" },
    });
    await db.content.updateMany({
      where: { id: { in: stale.map((j) => j.contentId).filter(Boolean) as string[] } },
      data: { status: "FAILED" },
    });
  }

  await db.$disconnect();
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
