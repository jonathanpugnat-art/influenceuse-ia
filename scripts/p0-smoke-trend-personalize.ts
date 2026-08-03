/**
 * Smoke: personalize one FITNESS trend for Luna Fit Test.
 * Usage: npx tsx scripts/p0-smoke-trend-personalize.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { personalizeSingleTrendForInfluencer } from "../src/server/services/trends/personalization/personalize";

const LUNA_FIT_ID = "cmpbizit8000004icudikwyen";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const influencer = await prisma.influencer.findUnique({
      where: { id: LUNA_FIT_ID },
      select: {
        id: true,
        name: true,
        gender: true,
        niche: true,
        personality: true,
        bio: true,
        isNsfw: true,
      },
    });
    if (!influencer) throw new Error(`Influencer ${LUNA_FIT_ID} not found`);

    const trend =
      (await prisma.trendItem.findFirst({
        where: {
          OR: [
            { nicheTags: { has: "FITNESS" } },
            {
              hashtags: { hasSome: ["fitness", "gym", "running", "workout"] },
            },
            { title: { contains: "gym", mode: "insensitive" } },
            { title: { contains: "run", mode: "insensitive" } },
            { title: { contains: "GRWM", mode: "insensitive" } },
          ],
        },
        orderBy: [{ growthScore: "desc" }, { fetchedAt: "desc" }],
      })) ??
      (await prisma.trendItem.findFirst({
        orderBy: [{ growthScore: "desc" }, { fetchedAt: "desc" }],
      }));

    if (!trend) throw new Error("No trend items in DB");

    console.log(
      `[smoke] personalize "${influencer.name}" × "${trend.title.slice(0, 80)}" (${trend.id})`
    );

    const result = await personalizeSingleTrendForInfluencer(
      influencer,
      trend,
      "fr",
      { skipFormatAnalysis: trend.formatBrief !== null && trend.formatBrief !== undefined }
    );

    const rec = await prisma.trendRecommendation.findUnique({
      where: { id: result.recommendationId },
    });

    console.log("[smoke] OK", {
      recommendationId: result.recommendationId,
      llmModel: result.llmModel,
      hook: rec?.generatedHook?.slice(0, 120),
      hasFormatBrief: trend.formatBrief != null,
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[smoke] FAIL", err);
  process.exit(1);
});
