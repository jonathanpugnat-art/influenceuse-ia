import "dotenv/config";
import { mirrorFreshTrendThumbnails } from "@/server/services/trend-thumbnail-storage.service";
import { analyzeTopTrendsFormat } from "@/server/services/trends/analysis/format-analysis";
import { db } from "@/server/db";
import { Prisma } from "@/generated/prisma/client";

async function main() {
  const mirrored = await mirrorFreshTrendThumbnails(30);
  const analyzed = await analyzeTopTrendsFormat(8);

  const freshSince = new Date(Date.now() - 72 * 3600 * 1000);
  const [videos, withThumb, withBrief] = await Promise.all([
    db.trendItem.count({
      where: { fetchedAt: { gte: freshSince }, mediaKind: "video" },
    }),
    db.trendItem.count({
      where: {
        fetchedAt: { gte: freshSince },
        mediaKind: "video",
        thumbnailUrl: { not: null },
      },
    }),
    db.trendItem.findMany({
      where: {
        fetchedAt: { gte: freshSince },
        formatBrief: { not: Prisma.DbNull },
      },
      select: { formatBrief: true },
      take: 200,
    }),
  ]);

  let vision = 0;
  let textOnly = 0;
  for (const row of withBrief) {
    const from = (row.formatBrief as { analyzedFrom?: string } | null)
      ?.analyzedFrom;
    if (from === "vision") vision += 1;
    else if (from === "text_only") textOnly += 1;
  }

  console.log(
    JSON.stringify(
      { mirrored, analyzed, videos, withThumb, vision, textOnly },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
