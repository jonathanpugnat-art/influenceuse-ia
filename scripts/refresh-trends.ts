// Sprint 13.2 — One-shot helper to repopulate the Trends cache after the
// schema change (added thumbnailUrl, embedUrl, etc). Wipes today's TrendItem
// rows so they get re-created with the new visual fields populated.
//
// Safe to re-run: it only deletes the curated provider's snapshot and items
// from today, then triggers a fresh fetch with the updated provider.

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { runTrendsFetch } from "../src/server/services/trends.service";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const oldItems = await db.trendItem.deleteMany({
    where: { fetchedAt: { gte: startOfDay } },
  });
  console.log(`Deleted ${oldItems.count} stale TrendItem row(s) from today.`);

  const oldSnaps = await db.trendSnapshot.deleteMany({
    where: { fetchedAt: { gte: startOfDay } },
  });
  console.log(`Deleted ${oldSnaps.count} stale TrendSnapshot row(s) from today.`);

  console.log("Triggering fresh fetch (force=true)…");
  const result = await runTrendsFetch({ force: true, locale: "fr" });
  console.log(JSON.stringify(result, null, 2));

  await db.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
