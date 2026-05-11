// ──────────────────────────────────────────────
// Content Recycler (Sprint 8)
//
// Re-uses the user's top-performing posts as the basis for fresh content:
// same media (no new image generation, no Replicate cost), but a fresh
// caption + a sensible scheduled slot. Saves the new post as DRAFT/SCHEDULED
// so the user keeps control of when it goes out.
// ──────────────────────────────────────────────

import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";
import { generateCaption } from "@/server/services/ai-text.service";

const ER_THRESHOLD = 0.025; // 2.5% engagement rate => "top performer"
const MIN_DAYS_BETWEEN_RECYCLES = 21;
const TOP_LIMIT = 10;

export interface RecycleCandidate {
  contentId: string;
  influencerId: string;
  influencerName: string;
  caption: string | null;
  thumbnailUrl: string | null;
  mediaUrls: string[];
  type: "PHOTO" | "REEL";
  publishedAt: Date | null;
  bestEngagement: number;
  totalViews: number;
  platforms: ("INSTAGRAM" | "TIKTOK" | "ONLYFANS")[];
}

/**
 * Lists posts eligible for recycling. We only surface posts that:
 *  - are PUBLISHED
 *  - have at least one analytics row with engagementRate >= threshold
 *  - haven't been recycled in the last MIN_DAYS_BETWEEN_RECYCLES days
 */
export async function listRecycleCandidates(
  userId: string,
  influencerId?: string
): Promise<RecycleCandidate[]> {
  const since = new Date(Date.now() - MIN_DAYS_BETWEEN_RECYCLES * 86400_000);

  const contents = await db.content.findMany({
    where: {
      influencer: { userId, ...(influencerId ? { id: influencerId } : {}) },
      status: "PUBLISHED" as const,
      // Don't surface very recent posts that might still be ramping up.
      publishedAt: { lte: since },
      contentAnalytics: { some: { engagementRate: { gte: ER_THRESHOLD } } },
    },
    select: {
      id: true,
      influencerId: true,
      caption: true,
      thumbnailUrl: true,
      mediaUrls: true,
      type: true,
      platforms: true,
      publishedAt: true,
      generationParams: true,
      influencer: { select: { name: true } },
      contentAnalytics: {
        select: { engagementRate: true, views: true },
        orderBy: { engagementRate: "desc" },
        take: 1,
      },
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  // Filter out anything previously recycled (we tag derivative posts with a
  // `recycleSourceId` in `generationParams`).
  const recycledSourceIds = new Set<string>();
  // We can't filter `generationParams: { not: null }` cleanly with Prisma's
  // JsonNullableFilter typing, so we pull the column and filter in JS.
  // Cheap because we only ever read this metadata on demand.
  const allParams = await db.content.findMany({
    where: { influencer: { userId } },
    select: { generationParams: true },
  });
  for (const c of allParams) {
    const src = (c.generationParams as { recycleSourceId?: string } | null)
      ?.recycleSourceId;
    if (src) recycledSourceIds.add(src);
  }

  const items: RecycleCandidate[] = contents
    .filter((c) => !recycledSourceIds.has(c.id))
    .map((c) => ({
      contentId: c.id,
      influencerId: c.influencerId,
      influencerName: c.influencer.name,
      caption: c.caption,
      thumbnailUrl: c.thumbnailUrl,
      mediaUrls: c.mediaUrls,
      type: c.type as "PHOTO" | "REEL",
      publishedAt: c.publishedAt,
      bestEngagement: c.contentAnalytics[0]?.engagementRate ?? 0,
      totalViews: c.contentAnalytics[0]?.views ?? 0,
      platforms: c.platforms,
    }));

  return items
    .sort((a, b) => b.bestEngagement - a.bestEngagement)
    .slice(0, TOP_LIMIT);
}

/**
 * Re-uses the source post's media to create a brand-new Content with a
 * regenerated caption (using personality memory). The new content is saved
 * as DRAFT and references the source via `generationParams.recycleSourceId`.
 *
 * Returns the new content id.
 */
export async function recyclePost(opts: {
  userId: string;
  sourceContentId: string;
  scheduledFor?: Date;
  language?: "fr" | "en";
}): Promise<string> {
  const source = await db.content.findUnique({
    where: { id: opts.sourceContentId },
    include: {
      influencer: { select: { id: true, userId: true, name: true, niche: true, personality: true } },
    },
  });

  if (!source || source.influencer.userId !== opts.userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Source post not found" });
  }
  if (source.status !== "PUBLISHED") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only published posts can be recycled",
    });
  }
  if (!source.mediaUrls?.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Source has no media to recycle",
    });
  }

  // Pick first platform of the original post for the new caption tone.
  const targetPlatform =
    (source.platforms[0] as "INSTAGRAM" | "TIKTOK" | "ONLYFANS") ?? "INSTAGRAM";

  const newCaption = await generateCaption(opts.userId, {
    influencerName: source.influencer.name,
    personality: source.influencer.personality,
    niche: source.influencer.niche,
    platform: targetPlatform,
    contentDescription:
      source.caption?.slice(0, 200) ??
      `Re-edition d'un post ${source.type.toLowerCase()} performant`,
    language: opts.language ?? "fr",
    influencerId: source.influencer.id,
  });

  const newContent = await db.content.create({
    data: {
      influencerId: source.influencerId,
      type: source.type,
      contentMode: source.contentMode,
      status: opts.scheduledFor ? "SCHEDULED" : "DRAFT",
      caption: newCaption,
      hashtags: source.hashtags,
      mediaUrls: source.mediaUrls,
      thumbnailUrl: source.thumbnailUrl,
      platforms: source.platforms,
      scheduledAt: opts.scheduledFor ?? null,
      generationParams: {
        recycleSourceId: source.id,
        originalPublishedAt: source.publishedAt?.toISOString() ?? null,
      },
    },
    select: { id: true },
  });

  return newContent.id;
}
