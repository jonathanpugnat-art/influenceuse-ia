/**
 * P0 — Smoke: generate 1 SFW fitness photo for Luna Fit Test with softened language.
 * Usage: DEMO_SKIP_BILLING=true npx tsx scripts/p0-smoke-fitness-photo.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { generateDemoTrendPhoto } from "./demo-generate-trend-photo";
import { Prisma } from "../src/generated/prisma/client";

const LUNA_ID = "cmpbizit8000004icudikwyen";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const influencer = await prisma.influencer.findUnique({
      where: { id: LUNA_ID },
    });
    if (!influencer?.baseImageUrl) {
      throw new Error("Luna Fit Test introuvable ou sans portrait");
    }

    const trend =
      (await prisma.trendItem.findFirst({
        where: {
          thumbnailUrl: { contains: "unsplash.com" },
          formatBrief: { not: Prisma.DbNull },
          OR: [
            { nicheTags: { has: "FITNESS" } },
            { title: { contains: "GRWM", mode: "insensitive" } },
            { title: { contains: "running", mode: "insensitive" } },
          ],
        },
        orderBy: { growthScore: "desc" },
      })) ??
      (await prisma.trendItem.findFirst({
        where: { formatBrief: { not: Prisma.DbNull } },
        orderBy: { growthScore: "desc" },
      }));

    if (!trend) throw new Error("Aucun trend avec formatBrief");

    console.log(`Trend: ${trend.title.slice(0, 60)}`);
    console.log("Génération photo (sans facturation)…");

    const result = await generateDemoTrendPhoto({
      influencer,
      trend,
      personalizedHook: "Matin running — on se motive ensemble",
      apply: null,
      skipBilling: true,
    });

    console.log("\n✅ Photo OK");
    console.log(result.imageUrl);
    console.log("\nPrompt (extrait):");
    console.log(result.promptUsed.slice(0, 400));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
