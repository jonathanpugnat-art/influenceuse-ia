export type Reel = {
  id: string;
  url: string;
  caption: string;
  plays: number;
  likes: number;
  thumbnail: string | null;
  owner: string;
  hashtag: string;
  fetchedAt: string;
};

type ApifyItem = {
  id?: unknown;
  shortCode?: unknown;
  url?: unknown;
  caption?: unknown;
  videoPlayCount?: unknown;
  videoViewCount?: unknown;
  likesCount?: unknown;
  displayUrl?: unknown;
  ownerUsername?: unknown;
  type?: unknown;
  productType?: unknown;
};

const ACTOR = "apify~instagram-scraper";
const HASHTAG = /^[\p{L}\p{N}_]{2,40}$/u;

export function parseHashtag(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const tag = input.trim().replace(/^#/, "").toLowerCase();
  return HASHTAG.test(tag) ? tag : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function httpsUrl(value: unknown): string | null {
  const text = asString(value);
  try {
    return new URL(text).protocol === "https:" ? text : null;
  } catch {
    return null;
  }
}

export function toReel(item: ApifyItem, hashtag: string, fetchedAt: string): Reel | null {
  const id = asString(item.shortCode) || asString(item.id);
  const url = asString(item.url);
  if (!id || !url.startsWith("https://www.instagram.com/")) return null;
  const isVideo = item.type === "Video" || item.productType === "clips";
  if (!isVideo) return null;
  return {
    id,
    url,
    caption: asString(item.caption).slice(0, 300),
    plays: asNumber(item.videoPlayCount) || asNumber(item.videoViewCount),
    likes: asNumber(item.likesCount),
    thumbnail: httpsUrl(item.displayUrl),
    owner: asString(item.ownerUsername),
    hashtag,
    fetchedAt,
  };
}

export function isReel(value: unknown): value is Reel {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.url === "string" &&
    item.url.startsWith("https://www.instagram.com/") &&
    typeof item.caption === "string" &&
    typeof item.plays === "number" &&
    typeof item.likes === "number" &&
    (item.thumbnail === null ||
      (typeof item.thumbnail === "string" && item.thumbnail.startsWith("https://"))) &&
    typeof item.owner === "string" &&
    typeof item.hashtag === "string" &&
    typeof item.fetchedAt === "string"
  );
}

export function rankReels(reels: Reel[]): Reel[] {
  return [...reels].sort((a, b) => b.plays - a.plays || b.likes - a.likes);
}

export async function fetchReels(hashtag: string, limit = 12): Promise<Reel[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("missing_key");

  const url = new URL(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`);
  url.searchParams.set("timeout", "110");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(115_000),
    body: JSON.stringify({
      search: `#${hashtag}`,
      searchType: "hashtag",
      searchLimit: 1,
      resultsType: "posts",
      resultsLimit: limit,
      onlyPostsNewerThan: "30 days",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("apify reels failed", response.status, detail.slice(0, 200));
    if (response.status === 401) throw new Error("missing_key");
    if (response.status === 403) throw new Error("quota_exceeded");
    throw new Error("scrape_failed");
  }

  const items = (await response.json()) as unknown;
  if (!Array.isArray(items)) throw new Error("scrape_failed");
  const fetchedAt = new Date().toISOString();
  const reels = items
    .map((item) => toReel(item as ApifyItem, hashtag, fetchedAt))
    .filter((reel): reel is Reel => reel !== null);
  return rankReels(reels);
}
