/**
 * v0.12 — Trends provider abstraction.
 *
 * A `TrendsProvider` knows how to fetch *raw* trend signals from one or more
 * third parties (Apify actor scraping TikTok Discover, a Predis-style HTTP
 * API, etc.). The provider is intentionally dumb: it does not personalize
 * for an influencer, it does not call our LLM, it does not write to the DB.
 *
 * The `trends.service.ts` layer is responsible for normalization, dedup,
 * upsert, and LLM personalization.
 *
 * Selecting an implementation:
 *   - `TRENDS_PROVIDER=apify`   → ApifyProvider (requires `APIFY_TOKEN`)
 *   - `TRENDS_PROVIDER=http`    → GenericHttpProvider (requires `TRENDS_HTTP_URL`)
 *   - `TRENDS_PROVIDER=stub`    → DevStubProvider (dev only, returns demo data)
 *   - unset / unknown           → auto-resolve: real provider if env keys are
 *                                 present, else `stub` in dev, else `null`
 *                                 (graceful no-op in prod).
 *
 * In production with no keys configured, the cron handler logs a warning and
 * skips the run. The UI then renders an empty state with a "Trends not
 * configured" banner — we never crash a build/runtime over a missing key.
 */

import type { Platform } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────

/**
 * A raw trend signal as returned by a provider. All fields are best-effort —
 * a provider may only know the title and a hashtag and that's fine.
 */
export interface RawTrendItem {
  /** Identifier in the source system (URL, slug, hashtag id…). Used for dedup. */
  externalId: string;
  platform: Platform;
  title: string;
  description?: string;
  /** Hashtags WITHOUT the leading `#`. */
  hashtags: string[];
  /** Trending audio / song name if any. */
  soundName?: string;
  /** Generic "how hot is this" score, 0..100. */
  growthScore?: number;
  sourceUrl?: string;
  /** Loose niche tags ("FASHION", "FITNESS", "GENERAL", …). */
  nicheTags?: string[];
  isNsfw?: boolean;
  locale?: string;
  region?: string;
}

export interface ProviderContext {
  /** Optional region filter (e.g. "FR", "US"). */
  region?: string;
  /** Optional locale filter (e.g. "fr", "en"). */
  locale?: string;
  /** Max items requested. Provider may return fewer. */
  limit?: number;
}

export interface TrendsProvider {
  /** Stable identifier saved alongside snapshots (provider lineage). */
  readonly id: string;
  /** Whether this provider is properly configured (env keys present). */
  isConfigured(): boolean;
  fetchRawTrends(ctx?: ProviderContext): Promise<RawTrendItem[]>;
}

// ──────────────────────────────────────────────
// Implementations
// ──────────────────────────────────────────────

/**
 * Dev-only stub. Returns 3 hand-curated trends so the UI / cron / LLM flow
 * can be exercised end-to-end without any third-party key. Refuses to run in
 * production so we never accidentally ship demo data to real users.
 */
export class DevStubProvider implements TrendsProvider {
  readonly id = "stub";

  isConfigured(): boolean {
    return process.env.NODE_ENV !== "production";
  }

  async fetchRawTrends(ctx?: ProviderContext): Promise<RawTrendItem[]> {
    if (!this.isConfigured()) {
      throw new Error(
        "DevStubProvider is disabled in production. Set TRENDS_PROVIDER to a real provider."
      );
    }
    const locale = ctx?.locale ?? "en";
    const items: RawTrendItem[] = [
      {
        externalId: "stub-grwm-running",
        platform: "TIKTOK",
        title:
          locale === "fr"
            ? "GRWM running — édition matinale"
            : "GRWM running — morning edition",
        description:
          locale === "fr"
            ? "Vlog 20s 'prépare-toi avec moi' avant un run, plan large + plans serrés tenue + sneakers."
            : "20s 'get ready with me' vlog before a run, wide shot + close-ups of outfit + sneakers.",
        hashtags: ["grwm", "running", "morningroutine", "fitnessgirl"],
        soundName: undefined,
        growthScore: 78,
        sourceUrl: undefined,
        nicheTags: ["FITNESS", "LIFESTYLE"],
        isNsfw: false,
        locale,
        region: ctx?.region,
      },
      {
        externalId: "stub-outfit-flip",
        platform: "INSTAGRAM",
        title:
          locale === "fr"
            ? "Outfit flip 3 tenues sur le même son"
            : "Outfit flip — 3 looks, one song",
        description:
          locale === "fr"
            ? "Reel 15s avec 3 changements de tenue rapides, transition saut-coupure."
            : "15s reel with 3 fast outfit swaps, jump-cut transition.",
        hashtags: ["outfit", "ootd", "transition", "fashionreel"],
        growthScore: 64,
        nicheTags: ["FASHION", "LIFESTYLE"],
        isNsfw: false,
        locale,
        region: ctx?.region,
      },
      {
        externalId: "stub-pov-cafe",
        platform: "TIKTOK",
        title:
          locale === "fr"
            ? "POV : ton café du matin en terrasse"
            : "POV: morning café on a Paris terrace",
        description:
          locale === "fr"
            ? "Photo carrousel cosy : café, journal, lumière dorée, plan large sur la rue."
            : "Cozy carousel: coffee, paper, golden hour light, wide shot of the street.",
        hashtags: ["pov", "morning", "cafe", "paris", "slowliving"],
        growthScore: 55,
        nicheTags: ["LIFESTYLE", "TRAVEL", "FOOD"],
        isNsfw: false,
        locale,
        region: ctx?.region,
      },
    ];
    return items.slice(0, ctx?.limit ?? items.length);
  }
}

// ──────────────────────────────────────────────
// Apify provider — TikTok + Instagram trending hashtags
// ──────────────────────────────────────────────
//
// We don't use `@apify/client` on purpose — it's a heavy SDK we'd carry into
// the serverless bundle just for one POST. The run-sync-get-dataset-items
// endpoint returns the dataset directly, which is exactly what we need.
//
// Two sub-fetchers wrapped behind one provider so the UI/cron see a single
// "apify" source:
//
//   1. TikTok — Trending Hashtags Scraper (default actor:
//      `scrapeengine/tiktok-trending-hashtags-scraper`). Returns the top-N
//      trending hashtags for a (country, period, industry) tuple. Each item
//      carries `hashtag_name`, `industry_info.label`, `video_views`,
//      `publish_cnt`, `rank`, optional `analytics`.
//   2. Instagram — `apify/instagram-hashtag-scraper`. Doesn't expose a
//      "trending list" so we seed with a niche-specific hashtag list and
//      surface the most engaged recent posts as "what's working" signals.
//
// Both sub-fetchers are tolerant: if one fails the other still ships. Worst
// case (both fail) we throw so the cron logs it and tries again tomorrow.

const APIFY_RUN_TIMEOUT_MS = 120_000;
const APIFY_TIKTOK_ACTOR_DEFAULT = "scrapeengine/tiktok-trending-hashtags-scraper";
const APIFY_INSTAGRAM_ACTOR_DEFAULT = "apify/instagram-hashtag-scraper";
const APIFY_INSTAGRAM_HASHTAGS_DEFAULT = [
  "fashion",
  "fitness",
  "lifestyle",
  "travel",
  "food",
  "ootd",
];

async function runApifyActor<T = unknown>(
  actorId: string,
  input: Record<string, unknown>,
  token: string
): Promise<T[]> {
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(
    actorId
  )}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&clean=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(APIFY_RUN_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apify actor ${actorId} returned HTTP ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(`Apify actor ${actorId} did not return an array`);
  }
  return data as T[];
}

/**
 * Resolve the TikTok country code from the provider context, falling back to
 * `APIFY_TIKTOK_COUNTRY` then "US". TikTok's Creative Center supports a
 * limited list (see Apify docs); we don't validate it strictly here — the
 * actor will error out and we'll log, which is the right failure mode.
 */
function resolveTikTokCountry(ctx?: ProviderContext): string {
  const fromCtx = ctx?.region?.trim()?.toUpperCase();
  if (fromCtx && fromCtx.length === 2) return fromCtx;
  const fromEnv = process.env.APIFY_TIKTOK_COUNTRY?.trim()?.toUpperCase();
  if (fromEnv && fromEnv.length === 2) return fromEnv;
  return "US";
}

function resolveTikTokPeriod(): "7" | "30" | "120" {
  const v = process.env.APIFY_TIKTOK_PERIOD?.trim();
  if (v === "30" || v === "120") return v;
  // 7 days = most actionable trends for short-form planning.
  return "7";
}

function resolveInstagramHashtags(): string[] {
  const raw = process.env.APIFY_INSTAGRAM_HASHTAGS;
  if (!raw) return APIFY_INSTAGRAM_HASHTAGS_DEFAULT;
  const list = raw
    .split(",")
    .map((s) => s.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : APIFY_INSTAGRAM_HASHTAGS_DEFAULT;
}

/**
 * TikTok Creative Center industries → our internal Niche enum keys.
 * The mapping is intentionally lossy — anything we can't map cleanly is
 * tagged `GENERAL` and the LLM personalization layer will figure it out.
 */
function mapTikTokIndustryToNiche(industryLabel: string | undefined): string[] {
  if (!industryLabel) return ["GENERAL"];
  const l = industryLabel.toLowerCase();
  if (l.includes("apparel") || l.includes("fashion") || l.includes("beauty")) return ["FASHION"];
  if (l.includes("sport") || l.includes("fitness") || l.includes("health")) return ["FITNESS"];
  if (l.includes("travel") || l.includes("tourism")) return ["TRAVEL"];
  if (l.includes("food") || l.includes("beverage") || l.includes("restaurant")) return ["FOOD"];
  if (l.includes("tech") || l.includes("electronics") || l.includes("software")) return ["TECH"];
  if (l.includes("game") || l.includes("gaming") || l.includes("esports")) return ["GAMING"];
  if (l.includes("lifestyle") || l.includes("home") || l.includes("daily")) return ["LIFESTYLE"];
  return ["GENERAL"];
}

/** Coarse niche tagging from a list of hashtags (used for IG). */
function inferNicheFromHashtags(hashtags: string[]): string[] {
  const joined = hashtags.join(" ").toLowerCase();
  const niches = new Set<string>();
  if (/fashion|ootd|outfit|style|streetwear|fashionista/.test(joined)) niches.add("FASHION");
  if (/fit(ness)?|workout|gym|running|crossfit|yoga/.test(joined)) niches.add("FITNESS");
  if (/travel|wanderlust|vacation|trip|explore|nomad/.test(joined)) niches.add("TRAVEL");
  if (/food|foodie|recipe|chef|dinner|brunch|coffee/.test(joined)) niches.add("FOOD");
  if (/tech|gadget|coding|developer|ai|startup/.test(joined)) niches.add("TECH");
  if (/gaming|gamer|esports|twitch|valorant|fortnite/.test(joined)) niches.add("GAMING");
  if (/lifestyle|life|daily|aesthetic|cozy|home|grwm/.test(joined)) niches.add("LIFESTYLE");
  if (niches.size === 0) niches.add("GENERAL");
  return Array.from(niches);
}

/**
 * Normalize TikTok video_views (which can be in the billions) into a 0..100
 * "growthScore" using a log scale so the UI doesn't show "9876543". Tuning:
 *   - 100k views   →  ~50
 *   - 1M  views    →  ~67
 *   - 10M views    →  ~83
 *   - 100M views   →  ~100
 */
function viewsToGrowthScore(views: number | undefined): number | undefined {
  if (typeof views !== "number" || views <= 0) return undefined;
  const score = (Math.log10(views) / 8) * 100;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

interface TikTokHashtagRow {
  hashtag_id?: string;
  hashtag_name?: string;
  industry_info?: { id?: string; label?: string; value?: string };
  video_views?: number;
  publish_cnt?: number;
  rank?: number;
  rank_diff_type?: number;
  analytics?: {
    rank?: number;
    period?: string;
    rank_change_readable?: string;
    publish_cnt?: number;
    video_views?: number;
  };
}

function mapTikTokRow(
  row: TikTokHashtagRow,
  ctx: { country: string; period: string }
): RawTrendItem | null {
  const name = row.hashtag_name?.trim();
  if (!name) return null;
  const views = row.video_views ?? row.analytics?.video_views;
  const rankChange = row.analytics?.rank_change_readable;
  const niches = mapTikTokIndustryToNiche(row.industry_info?.label);
  const description = [
    row.industry_info?.label ? `Industry: ${row.industry_info.label}.` : "",
    typeof row.publish_cnt === "number"
      ? `${row.publish_cnt.toLocaleString("en-US")} posts published`
      : "",
    typeof views === "number"
      ? `${views.toLocaleString("en-US")} aggregated video views`
      : "",
    rankChange ? `Trend direction: ${rankChange}.` : "",
    `Period: last ${ctx.period} days in ${ctx.country}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    externalId: `apify-tiktok-${row.hashtag_id ?? name.toLowerCase()}`,
    platform: "TIKTOK",
    title: `#${name}`,
    description,
    hashtags: [name],
    growthScore: viewsToGrowthScore(views),
    sourceUrl: `https://www.tiktok.com/tag/${encodeURIComponent(name)}`,
    nicheTags: niches,
    isNsfw: false,
    region: ctx.country,
  };
}

interface InstagramPostRow {
  id?: string;
  shortCode?: string;
  url?: string;
  caption?: string;
  hashtags?: string[];
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  playCount?: number;
  type?: string; // "Image" | "Video" | "Sidecar"
  inputUrl?: string;
}

/**
 * Aggregate raw Instagram posts into one trend per source hashtag. We pick
 * the top-3 most engaged posts per tag, then build a single TrendItem that
 * summarizes what's working.
 */
function aggregateInstagramPosts(
  posts: InstagramPostRow[]
): RawTrendItem[] {
  const byTag = new Map<string, InstagramPostRow[]>();
  for (const post of posts) {
    // The actor exposes the *queried* hashtag in `inputUrl` like
    //   "https://www.instagram.com/explore/tags/<tag>"
    const m = post.inputUrl?.match(/\/tags\/([^/?#]+)/i);
    const tag = m?.[1]?.toLowerCase();
    if (!tag) continue;
    const list = byTag.get(tag) ?? [];
    list.push(post);
    byTag.set(tag, list);
  }

  const out: RawTrendItem[] = [];
  for (const [tag, list] of byTag.entries()) {
    if (list.length === 0) continue;
    const ranked = [...list].sort(
      (a, b) =>
        ((b.likesCount ?? 0) + 5 * (b.commentsCount ?? 0)) -
        ((a.likesCount ?? 0) + 5 * (a.commentsCount ?? 0))
    );
    const top = ranked.slice(0, 3);
    const totalEng = ranked.reduce(
      (s, p) => s + (p.likesCount ?? 0) + (p.commentsCount ?? 0),
      0
    );
    const allHashtags = new Set<string>([tag]);
    for (const p of top) {
      for (const h of p.hashtags ?? []) allHashtags.add(h.toLowerCase());
    }
    // Caption preview — first non-empty caption from the top post, trimmed.
    const samplePost = top[0];
    const sample = samplePost?.caption?.trim();
    const description =
      (sample
        ? `Top post excerpt: "${sample.split(/\n+/)[0]?.slice(0, 200)}". `
        : "") +
      `${ranked.length} recent posts under #${tag} with ~${totalEng.toLocaleString(
        "en-US"
      )} combined likes+comments.`;

    out.push({
      externalId: `apify-instagram-${tag}`,
      platform: "INSTAGRAM",
      title: `#${tag}`,
      description,
      hashtags: Array.from(allHashtags).slice(0, 12),
      growthScore: viewsToGrowthScore(totalEng),
      sourceUrl: `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`,
      nicheTags: inferNicheFromHashtags(Array.from(allHashtags)),
      isNsfw: false,
    });
  }
  return out;
}

export class ApifyTrendsProvider implements TrendsProvider {
  readonly id = "apify";

  isConfigured(): boolean {
    return Boolean(process.env.APIFY_TOKEN);
  }

  async fetchRawTrends(ctx?: ProviderContext): Promise<RawTrendItem[]> {
    if (!this.isConfigured()) {
      throw new Error("ApifyTrendsProvider is missing APIFY_TOKEN");
    }
    const token = process.env.APIFY_TOKEN!;
    const limit = ctx?.limit ?? 60;
    // Roughly half TikTok, half Instagram — adjustable via env tweaking.
    const tiktokTarget = Math.ceil(limit * 0.6);
    const instagramTarget = Math.max(0, limit - tiktokTarget);

    const [tiktokResult, instagramResult] = await Promise.allSettled([
      this.fetchTikTok(token, ctx, tiktokTarget),
      this.fetchInstagram(token, instagramTarget),
    ]);

    const out: RawTrendItem[] = [];
    let collectedAny = false;

    if (tiktokResult.status === "fulfilled") {
      collectedAny = true;
      out.push(...tiktokResult.value);
    } else {
      console.error("[trends/apify] TikTok sub-fetch failed:", tiktokResult.reason);
    }
    if (instagramResult.status === "fulfilled") {
      collectedAny = true;
      out.push(...instagramResult.value);
    } else {
      console.error("[trends/apify] Instagram sub-fetch failed:", instagramResult.reason);
    }

    if (!collectedAny) {
      // Surface the most actionable error (TikTok is the default expectation).
      const reason =
        tiktokResult.status === "rejected"
          ? tiktokResult.reason
          : instagramResult.status === "rejected"
            ? instagramResult.reason
            : new Error("unknown");
      throw new Error(`Apify provider returned no data: ${String(reason)}`);
    }

    return out;
  }

  // ──────────────────────────────────────────────
  // Sub-fetchers (exposed as private methods for unit testing)
  // ──────────────────────────────────────────────

  private async fetchTikTok(
    token: string,
    ctx: ProviderContext | undefined,
    limit: number
  ): Promise<RawTrendItem[]> {
    if (limit <= 0) return [];
    const actorId =
      process.env.APIFY_TIKTOK_ACTOR?.trim() || APIFY_TIKTOK_ACTOR_DEFAULT;
    const country = resolveTikTokCountry(ctx);
    const period = resolveTikTokPeriod();
    const input: Record<string, unknown> = {
      result_type: "top100_with_analytics",
      country,
      top100_period: period,
      total_hashtags: Math.min(limit, 100),
      sort_order: "popular",
      industry: "",
      proxyConfiguration: { useApifyProxy: true },
    };
    const rows = await runApifyActor<TikTokHashtagRow>(actorId, input, token);
    return rows
      .map((row) => mapTikTokRow(row, { country, period }))
      .filter((r): r is RawTrendItem => r !== null);
  }

  private async fetchInstagram(
    token: string,
    limit: number
  ): Promise<RawTrendItem[]> {
    if (limit <= 0) return [];
    const actorId =
      process.env.APIFY_INSTAGRAM_ACTOR?.trim() || APIFY_INSTAGRAM_ACTOR_DEFAULT;
    const hashtags = resolveInstagramHashtags();
    // Get ~10 recent posts per hashtag — enough to rank and aggregate.
    const perHashtag = Math.max(5, Math.ceil((limit * 10) / hashtags.length));
    const input: Record<string, unknown> = {
      hashtags,
      resultsType: "posts",
      resultsLimit: perHashtag,
    };
    const rows = await runApifyActor<InstagramPostRow>(actorId, input, token);
    const aggregated = aggregateInstagramPosts(rows);
    return aggregated
      .sort((a, b) => (b.growthScore ?? 0) - (a.growthScore ?? 0))
      .slice(0, limit);
  }
}

/** Back-compat alias — old code still imports `ApifyProvider`. */
export const ApifyProvider = ApifyTrendsProvider;

// Exported for unit tests.
export const __test__ = {
  mapTikTokRow,
  aggregateInstagramPosts,
  mapTikTokIndustryToNiche,
  inferNicheFromHashtags,
  viewsToGrowthScore,
  resolveTikTokCountry,
  resolveTikTokPeriod,
  resolveInstagramHashtags,
};

/**
 * Generic HTTP provider — for any backend that exposes a `RawTrendItem[]` feed
 * directly. URL is taken from `TRENDS_HTTP_URL`, auth via optional
 * `TRENDS_HTTP_TOKEN` (Bearer). Useful for self-hosted scrapers / curated
 * feeds where you control the schema.
 */
export class GenericHttpProvider implements TrendsProvider {
  readonly id = "http";

  isConfigured(): boolean {
    return Boolean(process.env.TRENDS_HTTP_URL);
  }

  async fetchRawTrends(ctx?: ProviderContext): Promise<RawTrendItem[]> {
    if (!this.isConfigured()) {
      throw new Error("GenericHttpProvider is missing TRENDS_HTTP_URL");
    }
    const url = new URL(process.env.TRENDS_HTTP_URL!);
    if (ctx?.region) url.searchParams.set("region", ctx.region);
    if (ctx?.locale) url.searchParams.set("locale", ctx.locale);
    if (ctx?.limit) url.searchParams.set("limit", String(ctx.limit));

    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.TRENDS_HTTP_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.TRENDS_HTTP_TOKEN}`;
    }

    const res = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`Trends HTTP feed returned ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as unknown;
    const items = Array.isArray(data)
      ? data
      : Array.isArray((data as { items?: unknown }).items)
        ? (data as { items: unknown[] }).items
        : [];
    return items
      .map((row) => normalizeLooseItem(row))
      .filter((row): row is RawTrendItem => row !== null);
  }
}

// ──────────────────────────────────────────────
// Resolution
// ──────────────────────────────────────────────

/**
 * Pick the right provider based on env. Returns `null` when nothing is
 * configured and we're in production — caller must degrade gracefully.
 */
export function resolveTrendsProvider(): TrendsProvider | null {
  const choice = process.env.TRENDS_PROVIDER?.trim().toLowerCase();
  const apify = new ApifyTrendsProvider();
  const http = new GenericHttpProvider();
  const stub = new DevStubProvider();

  if (choice === "apify") return apify.isConfigured() ? apify : null;
  if (choice === "http") return http.isConfigured() ? http : null;
  if (choice === "stub") return stub.isConfigured() ? stub : null;

  // Auto-resolve: prefer a real provider if its keys are set.
  if (apify.isConfigured()) return apify;
  if (http.isConfigured()) return http;
  if (stub.isConfigured()) return stub;
  return null;
}

// ──────────────────────────────────────────────
// Defensive normalization (loose Apify / custom feed shapes)
// ──────────────────────────────────────────────

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
function asBoolean(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}
function asPlatform(v: unknown): Platform | undefined {
  if (typeof v !== "string") return undefined;
  const up = v.toUpperCase();
  if (up === "TIKTOK" || up === "INSTAGRAM" || up === "ONLYFANS") {
    return up as Platform;
  }
  return undefined;
}

function normalizeLooseItem(row: unknown): RawTrendItem | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const platform = asPlatform(r.platform);
  const title = asString(r.title) ?? asString(r.name) ?? asString(r.hashtag);
  const externalId = asString(r.externalId) ?? asString(r.id) ?? asString(r.url);
  if (!platform || !title || !externalId) return null;
  return {
    externalId,
    platform,
    title,
    description: asString(r.description),
    hashtags: asStringArray(r.hashtags).map((h) => h.replace(/^#/, "")),
    soundName: asString(r.soundName) ?? asString(r.sound),
    growthScore: asNumber(r.growthScore) ?? asNumber(r.score),
    sourceUrl: asString(r.sourceUrl) ?? asString(r.url),
    nicheTags: asStringArray(r.nicheTags),
    isNsfw: asBoolean(r.isNsfw) ?? false,
    locale: asString(r.locale),
    region: asString(r.region),
  };
}

