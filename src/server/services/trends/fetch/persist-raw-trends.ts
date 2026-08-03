import { db } from "@/server/db";
import type { Platform } from "@/generated/prisma/client";
import type { RawTrendItem, TrendsProvider } from "../providers/trend-provider";
import { TREND_FEED_TTL_HOURS } from "../constants";
import { hashPayload, normalizeHashtags, normalizeNicheTags } from "../normalization";
import type { CronRunResult } from "./cron-types";

export async function persistRawTrends(
  provider: TrendsProvider,
  raw: RawTrendItem[],
  ctx: { region?: string; locale?: string }
): Promise<
  Pick<CronRunResult, "snapshotsCreated" | "itemsCreated" | "itemsRefreshed"> & {
    ok: true;
    provider: string;
  }
> {
  const byPlatform = new Map<Platform, RawTrendItem[]>();
  for (const item of raw) {
    const list = byPlatform.get(item.platform) ?? [];
    list.push(item);
    byPlatform.set(item.platform, list);
  }

  let snapshotsCreated = 0;
  let itemsCreated = 0;
  let itemsRefreshed = 0;
  const expiresAt = new Date(Date.now() + TREND_FEED_TTL_HOURS * 3600 * 1000);

  for (const [platform, items] of byPlatform.entries()) {
    const contentHash = hashPayload(items.map((i) => i.externalId).sort());
    const existing = await db.trendSnapshot.findUnique({
      where: {
        provider_platform_contentHash: {
          provider: provider.id,
          platform,
          contentHash,
        },
      },
      select: { id: true },
    });
    if (existing) {
      const touch = await db.trendItem.updateMany({
        where: { snapshotId: existing.id },
        data: { fetchedAt: new Date(), expiresAt },
      });
      itemsRefreshed += touch.count;
      continue;
    }

    const snapshot = await db.trendSnapshot.create({
      data: {
        platform,
        region: ctx.region,
        locale: ctx.locale,
        provider: provider.id,
        contentHash,
        rawPayload: items as unknown as object,
      },
    });
    snapshotsCreated += 1;

    const rows = items.map((item) => ({
      snapshotId: snapshot.id,
      platform: item.platform,
      title: item.title.slice(0, 500),
      description: item.description?.slice(0, 2000) ?? null,
      hashtags: normalizeHashtags(item.hashtags),
      soundName: item.soundName?.slice(0, 200) ?? null,
      growthScore: typeof item.growthScore === "number" ? item.growthScore : null,
      sourceUrl: item.sourceUrl?.slice(0, 500) ?? null,
      thumbnailUrl: item.thumbnailUrl?.slice(0, 1000) ?? null,
      thumbnailUrlAlt: item.thumbnailUrlAlt?.slice(0, 1000) ?? null,
      embedUrl: item.embedUrl?.slice(0, 500) ?? null,
      authorHandle: item.authorHandle?.slice(0, 100) ?? null,
      mediaUrls: (item.mediaUrls ?? []).slice(0, 12),
      mediaKind: item.mediaKind?.slice(0, 40) ?? null,
      nicheTags: normalizeNicheTags(item.nicheTags),
      isNsfw: item.isNsfw ?? false,
      locale: item.locale ?? ctx.locale ?? null,
      region: item.region ?? ctx.region ?? null,
      expiresAt,
    }));

    if (rows.length > 0) {
      const result = await db.trendItem.createMany({
        data: rows,
        skipDuplicates: true,
      });
      itemsCreated += result.count;
    }
  }

  return { ok: true, provider: provider.id, snapshotsCreated, itemsCreated, itemsRefreshed };
}
