/**
 * v0.12 — Trends service.
 *
 * Responsibilities:
 *   - Drive the daily cron: fetch raw trends from the active provider,
 *     dedupe by hash, persist as TrendSnapshot + TrendItem rows.
 *   - Compute per-influencer feed: filter on niche / language / NSFW /
 *     freshness, ordered by growth.
 *   - Personalize trends for one influencer via the existing LLM stack and
 *     persist the result as TrendRecommendation rows.
 *   - Convert a stored recommendation into a PhotoParams-compatible JSON
 *     blob so the photo/reel creator can be pre-filled in one click.
 *
 * This service is the only place that touches the DB for trends. The tRPC
 * router is a thin layer on top.
 */

import { createHash } from "node:crypto";
import { z } from "zod";

import { getSceneInspirationText } from "@/lib/prompts/image-prompts";
import {
  formatBriefToPhotoSeed,
  formatBriefToReelSeed,
  mergeRecommendationWithBrief,
  parseTrendFormatBrief,
} from "@/lib/trends/trend-format-brief";
import {
  inferStudioLookFromBrief,
  isVideoTrendItem,
} from "@/lib/trends/trend-video-items";
import { applyStudioLook } from "@/lib/photo-studio-looks";
import {
  analyzeTrendItemFormat,
  getTrendFormatBrief,
} from "@/server/services/trend-media-analysis.service";
import { db } from "@/server/db";
import { callJsonLLM, resolveTextProvider } from "@/server/services/ai-text.service";
import {
  resolveTrendsProvider,
  type RawTrendItem,
  type TrendsProvider,
} from "@/server/services/trend-provider";
import {
  buildTrendPersonalizationPrompt,
  TREND_CONTENT_TYPES,
  TREND_EXPRESSIONS,
  TREND_PLATFORMS,
  TREND_POSES,
  TREND_SCENES,
  type TrendForPrompt,
} from "@/lib/prompts/trend-prompts";
import { JSON_REPAIR_INSTRUCTION } from "@/lib/prompts/content-plan-prompts";
import type { Influencer, Platform, TrendItem } from "@/generated/prisma/client";
import { PLANS, CREDIT_COSTS } from "@/lib/constants";

// ──────────────────────────────────────────────
// Constants & enum guards
// ──────────────────────────────────────────────

/** How long a TrendItem stays in the feed by default. */
export const TREND_FEED_TTL_HOURS = 72;
/** Soft TTL for the snapshot cache — cron skips a fetch if the latest snapshot
 *  for a platform/region is fresher than this. */
export const TREND_FETCH_TTL_HOURS = 24;

const sceneSet = new Set<string>(TREND_SCENES);
const poseSet = new Set<string>(TREND_POSES);
const expressionSet = new Set<string>(TREND_EXPRESSIONS);
const typeSet = new Set<string>(TREND_CONTENT_TYPES);
const platformSet = new Set<string>(TREND_PLATFORMS);

/** Known niche keys (matches the Prisma `Niche` enum) plus the cross-niche
 *  catch-all "GENERAL". Used to clean provider-supplied niche tags. */
export const KNOWN_NICHE_TAGS = [
  "FASHION",
  "FITNESS",
  "LIFESTYLE",
  "TRAVEL",
  "TECH",
  "GAMING",
  "ADULT",
  "FOOD",
  "GENERAL",
] as const;
const nicheTagSet = new Set<string>(KNOWN_NICHE_TAGS);

// ──────────────────────────────────────────────
// Pure helpers (covered by unit tests)
// ──────────────────────────────────────────────

/**
 * SHA-256 of a deterministic canonical JSON. We sort keys before stringify
 * so semantically-equal payloads hash equally.
 */
export function hashPayload(payload: unknown): string {
  const canonical = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

/** Coerce free-form niche tags onto our `Niche` enum (+ "GENERAL"). */
export function normalizeNicheTags(input: string[] | undefined): string[] {
  if (!input || input.length === 0) return ["GENERAL"];
  const out = new Set<string>();
  for (const raw of input) {
    const up = raw.trim().toUpperCase();
    if (nicheTagSet.has(up)) out.add(up);
  }
  if (out.size === 0) out.add("GENERAL");
  return Array.from(out);
}

/**
 * Heuristic: would a trend with these niche tags be relevant for an
 * influencer in `influencerNiche`? GENERAL trends match everything. We never
 * over-filter: when in doubt, return true and let the LLM personalize.
 */
export function matchesNiche(
  trendNiches: string[],
  influencerNiche: string
): boolean {
  if (trendNiches.length === 0) return true;
  if (trendNiches.includes("GENERAL")) return true;
  const target = influencerNiche.toUpperCase();
  return trendNiches.some((t) => t.toUpperCase() === target);
}

/** Lowercase-trim a hashtag, strip leading '#', drop empties. */
export function normalizeHashtags(hashtags: string[] | undefined): string[] {
  if (!hashtags) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of hashtags) {
    const cleaned = h.trim().replace(/^#+/, "").toLowerCase();
    if (!cleaned) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out.slice(0, 30);
}

/**
 * Clamp a free-form scene/pose/expression onto the allowed enum, falling
 * back to a safe default. Used after LLM output to guarantee the value can
 * be applied to the photo creator without extra UI translation.
 */
export function clampScene(v: string): string {
  return sceneSet.has(v) ? v : "studio";
}
export function clampPose(v: string): string {
  return poseSet.has(v) ? v : "portrait";
}
export function clampExpression(v: string): string {
  return expressionSet.has(v) ? v : "natural";
}
export function clampContentType(v: string): "PHOTO" | "REEL" | "CAROUSEL" {
  return (typeSet.has(v) ? v : "PHOTO") as "PHOTO" | "REEL" | "CAROUSEL";
}
export function clampPlatform(v: string): "INSTAGRAM" | "TIKTOK" | "ONLYFANS" {
  return (platformSet.has(v) ? v : "INSTAGRAM") as
    | "INSTAGRAM"
    | "TIKTOK"
    | "ONLYFANS";
}

// ──────────────────────────────────────────────
// LLM output schema
// ──────────────────────────────────────────────

export const trendRecommendationFieldsSchema = z.object({
  trendId: z.string().min(1),
  hook: z.string().min(1).max(240),
  concept: z.string().min(1).max(600),
  type: z.enum(TREND_CONTENT_TYPES),
  platform: z.enum(TREND_PLATFORMS),
  scene: z.string().min(1).max(40),
  pose: z.string().min(1).max(40),
  expression: z.string().min(1).max(40),
  outfit: z.string().min(0).max(200),
  customPrompt: z.string().min(0).max(400),
  /** Filled from formatBrief after vision analysis (English). */
  sceneDescription: z.string().max(800).optional(),
  /** Source trend title preserved for downstream photo enrichment. */
  trendTitle: z.string().max(500).optional(),
  /** Source trend hashtags preserved for downstream photo enrichment. */
  trendHashtags: z.array(z.string().min(1).max(80)).max(30).optional(),
  confidence: z.enum(["high", "medium", "low"]),
  citations: z.array(z.string().min(1).max(60)).max(8),
});
export type TrendRecommendationFields = z.infer<
  typeof trendRecommendationFieldsSchema
>;

const llmOutputSchema = z.array(trendRecommendationFieldsSchema).min(1).max(50);

// ──────────────────────────────────────────────
// Fetch + persist (cron path)
// ──────────────────────────────────────────────

export interface CronRunResult {
  ok: boolean;
  provider: string | null;
  /** How many snapshots were inserted. 0 = nothing to do (cached). */
  snapshotsCreated: number;
  itemsCreated: number;
  /** Set when the cron decided to no-op (missing key, recent fetch, etc.). */
  skipped?: string;
}

/**
 * Cron handler entry point. Pulls raw trends from the active provider and
 * persists everything. Idempotent — duplicate fetches dedupe on contentHash.
 */
export async function runTrendsFetch(opts?: {
  /** Force fetch even if a fresh snapshot already exists in the cache. */
  force?: boolean;
  region?: string;
  locale?: string;
  limit?: number;
}): Promise<CronRunResult> {
  const provider = resolveTrendsProvider();
  if (!provider) {
    return {
      ok: true,
      provider: null,
      snapshotsCreated: 0,
      itemsCreated: 0,
      skipped: "no-provider-configured",
    };
  }

  // Cache check — avoid re-hitting the provider if the latest snapshot is
  // newer than `TREND_FETCH_TTL_HOURS`.
  if (!opts?.force) {
    const recent = await db.trendSnapshot.findFirst({
      where: {
        provider: provider.id,
        fetchedAt: {
          gte: new Date(Date.now() - TREND_FETCH_TTL_HOURS * 3600 * 1000),
        },
      },
      orderBy: { fetchedAt: "desc" },
      select: { id: true, fetchedAt: true },
    });
    if (recent) {
      return {
        ok: true,
        provider: provider.id,
        snapshotsCreated: 0,
        itemsCreated: 0,
        skipped: `cached-until-${new Date(
          recent.fetchedAt.getTime() + TREND_FETCH_TTL_HOURS * 3600 * 1000
        ).toISOString()}`,
      };
    }
  }

  const raw = await provider.fetchRawTrends({
    region: opts?.region,
    locale: opts?.locale,
    limit: opts?.limit,
  });

  if (raw.length === 0) {
    return {
      ok: true,
      provider: provider.id,
      snapshotsCreated: 0,
      itemsCreated: 0,
      skipped: "empty-feed",
    };
  }

  return await persistRawTrends(provider, raw, {
    region: opts?.region,
    locale: opts?.locale,
  });
}

/**
 * Persist a batch of raw trends. Grouped by platform — one snapshot per
 * platform so dedup works at a sensible granularity.
 */
async function persistRawTrends(
  provider: TrendsProvider,
  raw: RawTrendItem[],
  ctx: { region?: string; locale?: string }
): Promise<CronRunResult> {
  const byPlatform = new Map<Platform, RawTrendItem[]>();
  for (const item of raw) {
    const list = byPlatform.get(item.platform) ?? [];
    list.push(item);
    byPlatform.set(item.platform, list);
  }

  let snapshotsCreated = 0;
  let itemsCreated = 0;
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
    if (existing) continue; // identical fetch, skip

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

  return { ok: true, provider: provider.id, snapshotsCreated, itemsCreated };
}

// ──────────────────────────────────────────────
// Feed (read path)
// ──────────────────────────────────────────────

export interface FeedOptions {
  /** Max items to return. The router caps this further per plan. */
  limit?: number;
  /** Pagination cursor (TrendItem.id) for "load more". */
  cursor?: string;
  /** Optional platform filter ("TIKTOK" / "INSTAGRAM"). */
  platform?: Platform;
}

/**
 * Compute the trend feed for one influencer. Applies niche / NSFW / locale
 * filters + freshness, returns rows sorted by growthScore desc then recency.
 */
export async function getFeedForInfluencer(
  influencer: Pick<Influencer, "id" | "niche" | "isNsfw">,
  opts: FeedOptions & { userPlan: keyof typeof PLANS; userLocale?: string }
): Promise<{ items: TrendItem[]; nextCursor: string | null }> {
  const planCfg = PLANS[opts.userPlan];
  const hardCap = Math.min(opts.limit ?? planCfg.trendsMaxFeed, planCfg.trendsMaxFeed);
  const freshSince = new Date(
    Date.now() - TREND_FEED_TTL_HOURS * 3600 * 1000
  );

  // NSFW gate: if the influencer is SFW, hide NSFW trends. NSFW influencer
  // still sees SFW trends (more material to work with).
  const nsfwClause = influencer.isNsfw ? {} : { isNsfw: false };

  const items = await db.trendItem.findMany({
    where: {
      ...nsfwClause,
      fetchedAt: { gte: freshSince },
      ...(opts.platform ? { platform: opts.platform } : {}),
      OR: [
        { nicheTags: { has: influencer.niche } },
        { nicheTags: { has: "GENERAL" } },
        { nicheTags: { isEmpty: true } },
      ],
    },
    orderBy: [{ growthScore: "desc" }, { fetchedAt: "desc" }],
    take: hardCap + 1, // +1 to compute nextCursor
    ...(opts.cursor
      ? { skip: 1, cursor: { id: opts.cursor } }
      : {}),
  });

  const hasMore = items.length > hardCap;
  const trimmed = hasMore ? items.slice(0, hardCap) : items;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]!.id : null;
  return { items: trimmed, nextCursor };
}

/**
 * Global trend feed — all niches, sorted by growthScore. NSFW gate only.
 */
export async function getGlobalTrendFeed(
  opts: FeedOptions & {
    isNsfw: boolean;
    userPlan: keyof typeof PLANS;
    userLocale?: string;
  }
): Promise<{ items: TrendItem[]; nextCursor: string | null }> {
  const planCfg = PLANS[opts.userPlan];
  const hardCap = Math.min(opts.limit ?? planCfg.trendsMaxFeed, planCfg.trendsMaxFeed);
  const freshSince = new Date(
    Date.now() - TREND_FEED_TTL_HOURS * 3600 * 1000
  );

  const nsfwClause = opts.isNsfw ? {} : { isNsfw: false };

  const items = await db.trendItem.findMany({
    where: {
      ...nsfwClause,
      fetchedAt: { gte: freshSince },
      ...(opts.platform ? { platform: opts.platform } : {}),
    },
    orderBy: [{ growthScore: "desc" }, { fetchedAt: "desc" }],
    take: hardCap + 1,
    ...(opts.cursor
      ? { skip: 1, cursor: { id: opts.cursor } }
      : {}),
  });

  const hasMore = items.length > hardCap;
  const trimmed = hasMore ? items.slice(0, hardCap) : items;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]!.id : null;
  return { items: trimmed, nextCursor };
}

/**
 * Trend cards for the creation wizard (no influencer yet).
 * Filters by niche + NSFW gate; returns items with parsed formatBrief when present.
 */
export async function getWizardTrendInspiration(opts: {
  niche: string;
  isNsfw: boolean;
  locale?: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    title: string;
    hook: string | null;
    formatBrief: unknown;
    platform: Platform;
  }>
> {
  const limit = Math.min(opts.limit ?? 5, 8);
  const freshSince = new Date(
    Date.now() - TREND_FEED_TTL_HOURS * 3600 * 1000
  );
  const nsfwClause = opts.isNsfw ? {} : { isNsfw: false };

  const items = await db.trendItem.findMany({
    where: {
      ...nsfwClause,
      fetchedAt: { gte: freshSince },
      OR: [
        { nicheTags: { has: opts.niche } },
        { nicheTags: { has: "GENERAL" } },
        { nicheTags: { isEmpty: true } },
      ],
    },
    orderBy: [{ growthScore: "desc" }, { fetchedAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      formatBrief: true,
      platform: true,
    },
  });

  return items.map((item) => {
    const brief = parseTrendFormatBrief(item.formatBrief);
    return {
      id: item.id,
      title: item.title,
      platform: item.platform,
      hook: brief?.hook ?? null,
      formatBrief: item.formatBrief,
    };
  });
}

// ──────────────────────────────────────────────
// Personalization (LLM)
// ──────────────────────────────────────────────

export interface PersonalizationResult {
  created: number;
  recommendationIds: string[];
  llmModel: string;
}

/**
 * Generate (or refresh) LLM recommendations for an influencer over its
 * current feed. Caller is responsible for checking credits / plan.
 * Returns the count of new recommendations and their ids.
 */
export async function personalizeFeedForInfluencer(
  influencer: Pick<
    Influencer,
    | "id"
    | "name"
    | "gender"
    | "niche"
    | "personality"
    | "bio"
    | "isNsfw"
  >,
  trendItems: TrendItem[],
  language: "fr" | "en"
): Promise<PersonalizationResult> {
  if (trendItems.length === 0) {
    return { created: 0, recommendationIds: [], llmModel: resolveTextProvider() };
  }

  // Cap how many trends we ship in a single LLM call to keep latency / tokens
  // reasonable. 12 is well within deepseek's context with our prompt size.
  const batch = trendItems.slice(0, 12);

  const payload: TrendForPrompt[] = batch.map((t) =>
    trendPayloadFromItem(t, getTrendFormatBrief(t))
  );

  const { systemPrompt, userPrompt } = buildTrendPersonalizationPrompt(
    {
      influencerName: influencer.name,
      influencerGender:
        (influencer.gender as "female" | "male" | "nonbinary") ?? "female",
      niche: influencer.niche,
      personality: influencer.personality,
      bio: influencer.bio,
      isNsfw: influencer.isNsfw,
      language,
    },
    payload
  );

  const recs = await callJsonLLM<TrendRecommendationFields[]>({
    systemPrompt,
    userPrompt,
    maxTokens: 3500,
    temperature: 0.7,
    repairInstruction: JSON_REPAIR_INSTRUCTION,
    validate: (raw) => llmOutputSchema.parse(raw),
  });

  // Match each rec to its source TrendItem (LLM may shuffle order).
  const byId = new Map(batch.map((t) => [t.id, t]));
  const ids: string[] = [];
  const llmModel = resolveTextProvider();

  for (const rec of recs) {
    const trend = byId.get(rec.trendId);
    if (!trend) continue; // hallucinated id — drop

    const brief = trend ? getTrendFormatBrief(trend) : null;
    let cleaned: TrendRecommendationFields = {
      ...rec,
      scene: clampScene(rec.scene),
      pose: clampPose(rec.pose),
      expression: clampExpression(rec.expression),
      type: clampContentType(rec.type),
      platform: clampPlatform(rec.platform),
      // For SFW influencers, defensive double-check: rewrite "seductive" to
      // "playful". Prompt also forbids it but we don't trust LLMs alone.
      ...(influencer.isNsfw
        ? {}
        : {
            expression:
              rec.expression === "seductive"
                ? "playful"
                : clampExpression(rec.expression),
          }),
    };
    cleaned = mergeRecommendationWithBrief(cleaned, brief);
    if (brief?.sceneDescription) {
      cleaned.sceneDescription = brief.sceneDescription;
    }
    cleaned.trendTitle = trend.title;
    cleaned.trendHashtags = trend.hashtags;

    const upserted = await db.trendRecommendation.upsert({
      where: {
        influencerId_trendItemId: {
          influencerId: influencer.id,
          trendItemId: trend.id,
        },
      },
      create: {
        influencerId: influencer.id,
        trendItemId: trend.id,
        generatedHook: cleaned.hook,
        generatedFields: cleaned as unknown as object,
        llmModel,
      },
      update: {
        generatedHook: cleaned.hook,
        generatedFields: cleaned as unknown as object,
        llmModel,
        userDismissed: false,
      },
      select: { id: true },
    });
    ids.push(upserted.id);
  }

  return { created: ids.length, recommendationIds: ids, llmModel };
}

/**
 * Generate a recommendation for a SINGLE trend item. Same LLM contract as
 * `personalizeFeedForInfluencer` but optimized for the "user clicks
 * Personalize on one card" path: smaller prompt, smaller token budget,
 * one DB upsert. Caller still does the credit check / deduct (router-side).
 */
export async function personalizeSingleTrendForInfluencer(
  influencer: Pick<
    Influencer,
    "id" | "name" | "gender" | "niche" | "personality" | "bio" | "isNsfw"
  >,
  trendItem: TrendItem,
  language: "fr" | "en",
  options?: { skipFormatAnalysis?: boolean }
): Promise<{ recommendationId: string; llmModel: string }> {
  let item = trendItem;
  if (!options?.skipFormatAnalysis && !item.formatBrief) {
    try {
      await ensureTrendFormatAnalyzed(item.id);
      const refreshed = await db.trendItem.findUnique({
        where: { id: item.id },
      });
      if (refreshed) item = refreshed;
    } catch (e) {
      console.warn("[trends] format analysis skipped:", e);
    }
  }

  const brief = getTrendFormatBrief(item);
  const payload: TrendForPrompt[] = [trendPayloadFromItem(item, brief)];

  const { systemPrompt, userPrompt } = buildTrendPersonalizationPrompt(
    {
      influencerName: influencer.name,
      influencerGender:
        (influencer.gender as "female" | "male" | "nonbinary") ?? "female",
      niche: influencer.niche,
      personality: influencer.personality,
      bio: influencer.bio,
      isNsfw: influencer.isNsfw,
      language,
    },
    payload
  );

  // Smaller token budget (1500 vs 3500) since we expect at most 1 record.
  const recs = await callJsonLLM<TrendRecommendationFields[]>({
    systemPrompt,
    userPrompt,
    maxTokens: 1500,
    temperature: 0.7,
    repairInstruction: JSON_REPAIR_INSTRUCTION,
    validate: (raw) => llmOutputSchema.parse(raw),
  });

  // The prompt asks the LLM to keep `trendId` stable, but it occasionally
  // hallucinates. We always treat the FIRST record as the answer for this
  // single-trend call — the LLM has no other trend to reference anyway.
  const rec = recs[0];
  if (!rec) {
    throw new Error("LLM returned no recommendation for the trend");
  }

  let cleaned: TrendRecommendationFields = {
    ...rec,
    trendId: trendItem.id,
    scene: clampScene(rec.scene),
    pose: clampPose(rec.pose),
    expression: influencer.isNsfw
      ? clampExpression(rec.expression)
      : rec.expression === "seductive"
        ? "playful"
        : clampExpression(rec.expression),
    type: clampContentType(rec.type),
    platform: clampPlatform(rec.platform),
  };
  cleaned = mergeRecommendationWithBrief(cleaned, brief);
  if (brief?.sceneDescription) {
    cleaned.sceneDescription = brief.sceneDescription;
  }
  cleaned.trendTitle = item.title;
  cleaned.trendHashtags = item.hashtags;
  if (brief?.contentType === "REEL") {
    cleaned.type = "REEL";
  } else if (isVideoTrendItem(item.mediaKind) && cleaned.type !== "PHOTO") {
    cleaned.type = "REEL";
  }

  const llmModel = resolveTextProvider();
  const upserted = await db.trendRecommendation.upsert({
    where: {
      influencerId_trendItemId: {
        influencerId: influencer.id,
        trendItemId: trendItem.id,
      },
    },
    create: {
      influencerId: influencer.id,
      trendItemId: trendItem.id,
      generatedHook: cleaned.hook,
      generatedFields: cleaned as unknown as object,
      llmModel,
    },
    update: {
      generatedHook: cleaned.hook,
      generatedFields: cleaned as unknown as object,
      llmModel,
      userDismissed: false,
    },
    select: { id: true },
  });

  return { recommendationId: upserted.id, llmModel };
}

// ──────────────────────────────────────────────
// Apply → PhotoParams blob
// ──────────────────────────────────────────────

/**
 * Photo-creator-compatible blob. Keys match `PhotoParams` in
 * `src/hooks/use-photo-creator.ts` so the UI can `updateParams(blob)`
 * verbatim. We don't import that type to keep this file server-only.
 */
export interface ApplyToPhotoParamsResult {
  type: "PHOTO" | "REEL" | "CAROUSEL";
  platform: "INSTAGRAM" | "TIKTOK" | "ONLYFANS";
  influencerId: string;
  scene: string;
  sceneDescription: string;
  pose: string;
  outfit: string;
  expression: string;
  customPrompt: string;
  /** Caption seed (the hook) — UI may put it in caption textarea or as a hint. */
  hook: string;
  /** Hashtags the UI can pre-fill (no leading '#'). */
  hashtags: string[];
  confidence: "high" | "medium" | "low";
  citations: string[];
  /** Studio look preset when inferred from trend format. */
  lookId?: string | null;
  /** Prefer Kontext lane for trend-inspired social shots. */
  instagramShot?: boolean;
  /** Pass-through reference for analytics / re-applying later. */
  trendItemId: string;
  recommendationId: string;
  /** Optional scraped trend metadata for photo prompt enrichment. */
  trendContext?: {
    title?: string;
    hashtags?: string[];
  };
}

export type ApplyToCreatorResult =
  | (ApplyToPhotoParamsResult & { target: "photo" })
  | {
      target: "reel";
      influencerId: string;
      duration: 15 | 30 | 60;
      format: "VERTICAL" | "SQUARE";
      videoType: string;
      script: string;
      sceneDescription: string;
      outfit: string;
      music: string;
      effects: string[];
      textOverlay: string;
      hook: string;
      hashtags: string[];
      trendItemId: string;
      recommendationId: string;
    };

/**
 * Convert a stored recommendation into a creator-ready param blob. We re-clamp
 * the enums defensively in case an older row was written before a clamp change.
 */
export function recommendationToPhotoParams(
  rec: { id: string; trendItemId: string; generatedFields: unknown },
  influencerId: string,
  hashtags: string[]
): ApplyToPhotoParamsResult {
  // The DB column is JSON; parse defensively. If the row predates our schema,
  // we still return a usable best-effort blob.
  const parsed = trendRecommendationFieldsSchema.safeParse(rec.generatedFields);
  const fields: TrendRecommendationFields = parsed.success
    ? parsed.data
    : {
        trendId: rec.trendItemId,
        hook: "",
        concept: "",
        type: "PHOTO",
        platform: "INSTAGRAM",
        scene: "studio",
        pose: "portrait",
        expression: "natural",
        outfit: "",
        customPrompt: "",
        confidence: "low",
        citations: [],
      };

  const scene = clampScene(fields.scene);
  const sceneBase = getSceneInspirationText(scene);
  const customPrompt = fields.customPrompt?.trim() ?? "";
  const sceneDescription =
    fields.sceneDescription?.trim() || customPrompt || sceneBase;

  const trendTitle = fields.trendTitle?.trim();
  const trendHashtags =
    fields.trendHashtags && fields.trendHashtags.length > 0
      ? fields.trendHashtags
      : hashtags.length > 0
        ? hashtags
        : undefined;
  const trendContext =
    trendTitle || trendHashtags
      ? {
          title: trendTitle || undefined,
          hashtags: trendHashtags,
        }
      : undefined;

  return {
    type: clampContentType(fields.type),
    platform: clampPlatform(fields.platform),
    influencerId,
    scene,
    sceneDescription,
    pose: clampPose(fields.pose),
    outfit: fields.outfit,
    expression: clampExpression(fields.expression),
    customPrompt: fields.customPrompt,
    hook: fields.hook,
    hashtags,
    confidence: fields.confidence,
    citations: fields.citations,
    trendItemId: rec.trendItemId,
    recommendationId: rec.id,
    trendContext,
  };
}

/** Route to photo or reel creator based on recommendation + format brief. */
export function recommendationToCreatorParams(
  rec: { id: string; trendItemId: string; generatedFields: unknown },
  influencerId: string,
  hashtags: string[],
  trendItem: Pick<TrendItem, "formatBrief" | "mediaKind">,
  influencer: Pick<Influencer, "isNsfw" | "gender">
): ApplyToCreatorResult {
  const photoBlob = recommendationToPhotoParams(
    rec,
    influencerId,
    hashtags
  );
  const brief = getTrendFormatBrief(trendItem);
  const parsed = trendRecommendationFieldsSchema.safeParse(rec.generatedFields);
  const type = parsed.success ? parsed.data.type : photoBlob.type;
  const videoTrend = isVideoTrendItem(trendItem.mediaKind);
  const influencerIsNsfw = influencer.isNsfw;

  const applyAsReel =
    brief?.contentType === "REEL" ||
    (type === "REEL" && (brief !== null || videoTrend));

  if (applyAsReel) {
    if (brief) {
      const reel = formatBriefToReelSeed(brief, influencerId, hashtags);
      return {
        target: "reel",
        influencerId,
        duration: reel.duration,
        format: reel.format,
        videoType: reel.videoType,
        script: reel.script,
        sceneDescription: reel.sceneDescription,
        outfit: reel.outfit,
        music: reel.music,
        effects: reel.effects,
        textOverlay: reel.textOverlay,
        hook: photoBlob.hook,
        hashtags,
        trendItemId: rec.trendItemId,
        recommendationId: rec.id,
      };
    }
    return {
      target: "reel",
      influencerId,
      duration: 15,
      format: "VERTICAL",
      videoType: "talking_head",
      script: photoBlob.hook || photoBlob.sceneDescription,
      sceneDescription: photoBlob.sceneDescription,
      outfit: photoBlob.outfit,
      music: "",
      effects: [],
      textOverlay: "",
      hook: photoBlob.hook,
      hashtags,
      trendItemId: rec.trendItemId,
      recommendationId: rec.id,
    };
  }

  if (brief) {
    const premium = formatBriefToPhotoSeed(
      brief,
      influencerId,
      hashtags,
      influencerIsNsfw
    );
    const lookId = inferStudioLookFromBrief(brief);
    const gender =
      (influencer.gender as "female" | "male" | "nonbinary") ?? "female";
    const lookParams = lookId ? applyStudioLook(lookId, gender) : {};
    return {
      target: "photo",
      type: brief.contentType === "CAROUSEL" ? "CAROUSEL" : "PHOTO",
      platform: photoBlob.platform,
      influencerId,
      scene: lookParams.scene ?? premium.scene ?? photoBlob.scene,
      sceneDescription:
        premium.sceneDescription ?? photoBlob.sceneDescription,
      pose: premium.pose ?? lookParams.pose ?? photoBlob.pose,
      outfit: premium.outfit || lookParams.outfit || photoBlob.outfit,
      expression: premium.expression ?? lookParams.expression ?? photoBlob.expression,
      customPrompt: premium.customPrompt ?? photoBlob.customPrompt,
      hook: photoBlob.hook || brief.hook,
      hashtags,
      confidence: photoBlob.confidence,
      citations: photoBlob.citations,
      lookId: lookId ?? null,
      instagramShot: !influencerIsNsfw,
      trendItemId: rec.trendItemId,
      recommendationId: rec.id,
    };
  }

  return {
    target: "photo",
    ...photoBlob,
    instagramShot: videoTrend && !influencerIsNsfw,
  };
}

// ──────────────────────────────────────────────
// Misc helpers exposed for tests / router
// ──────────────────────────────────────────────

/** Cost reminder helper for the router. Single source of truth. */
export function trendAnalysisCost(): number {
  return CREDIT_COSTS.TREND_ANALYSIS;
}

/** Cost of personalizing a single trend card (cheaper than the bulk path). */
export function trendAnalysisOneCost(): number {
  return CREDIT_COSTS.TREND_ANALYSIS_ONE;
}

export function trendFormatAnalyzeCost(): number {
  return CREDIT_COSTS.TREND_FORMAT_ANALYZE;
}

function trendPayloadFromItem(
  item: TrendItem,
  brief: ReturnType<typeof getTrendFormatBrief>
): TrendForPrompt {
  return {
    trendId: item.id,
    platform: item.platform,
    title: item.title,
    description: item.description ?? undefined,
    hashtags: item.hashtags,
    soundName: item.soundName ?? undefined,
    growthScore: item.growthScore ?? undefined,
    formatBrief: brief
      ? {
          contentType: brief.contentType,
          sceneDescription: brief.sceneDescription,
          pose: brief.pose,
          expression: brief.expression,
          outfit: brief.outfit,
          mood: brief.mood,
          hook: brief.hook,
          videoType: brief.videoType,
          reelStoryboard: brief.reelStoryboard,
          confidence: brief.confidence,
          analyzedFrom: brief.analyzedFrom,
        }
      : undefined,
  };
}

/** Run vision/text format analysis (idempotent unless force). */
export async function ensureTrendFormatAnalyzed(
  trendItemId: string,
  options?: { force?: boolean }
) {
  return analyzeTrendItemFormat(trendItemId, options);
}
