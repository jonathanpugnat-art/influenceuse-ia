// ──────────────────────────────────────────────
// Personality Memory (Sprint 8)
//
// Inspects an influencer's recent published captions to extract a tiny
// "voice fingerprint" — favorite emojis, recurring opening phrases, and a
// shortlist of recent topics. We inject this fingerprint into the caption
// generation system prompt so the AI keeps a consistent voice across posts.
//
// Lightweight, deterministic, no LLM call. Runs in <50ms even with 50 posts.
// ──────────────────────────────────────────────

import { db } from "@/server/db";

const MAX_RECENT_POSTS = 12;

export interface VoiceFingerprint {
  /** Most-used emojis (top 5). */
  topEmojis: string[];
  /** Recurring opening words/phrases (first 4 chars of caption). */
  openingPatterns: string[];
  /** Recent topics extracted from captions / hashtags (top 6 unique). */
  recentTopics: string[];
  /** Average caption length in characters (helps mimic post length). */
  avgLength: number;
  /** Number of posts the fingerprint was built from. */
  sampleSize: number;
}

const EMPTY_FINGERPRINT: VoiceFingerprint = {
  topEmojis: [],
  openingPatterns: [],
  recentTopics: [],
  avgLength: 0,
  sampleSize: 0,
};

/**
 * Loads the latest captions for an influencer and computes a voice
 * fingerprint suitable for prompt injection.
 */
export async function getVoiceFingerprint(
  influencerId: string
): Promise<VoiceFingerprint> {
  const posts = await db.content.findMany({
    where: {
      influencerId,
      status: "PUBLISHED" as const,
      caption: { not: null },
    },
    orderBy: { publishedAt: "desc" },
    take: MAX_RECENT_POSTS,
    select: {
      caption: true,
      hashtags: true,
    },
  });

  if (!posts.length) return EMPTY_FINGERPRINT;

  return computeFingerprint(
    posts.map((p) => ({ caption: p.caption ?? "", hashtags: p.hashtags ?? [] }))
  );
}

/**
 * Pure function exported separately for unit tests.
 */
export function computeFingerprint(
  posts: { caption: string; hashtags: string[] }[]
): VoiceFingerprint {
  if (!posts.length) return EMPTY_FINGERPRINT;

  const emojiCounts = new Map<string, number>();
  const openings = new Map<string, number>();
  const lengths: number[] = [];
  const topicSet = new Set<string>();

  // Unicode emoji rough-match. Covers main blocks; intentionally permissive.
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

  for (const p of posts) {
    const caption = (p.caption ?? "").trim();
    if (!caption) continue;
    lengths.push(caption.length);

    const emojis = caption.match(emojiRegex) ?? [];
    for (const e of emojis) {
      emojiCounts.set(e, (emojiCounts.get(e) ?? 0) + 1);
    }

    const firstWord = caption.split(/\s+/)[0]?.replace(emojiRegex, "").trim().toLowerCase();
    if (firstWord && firstWord.length >= 2) {
      openings.set(firstWord, (openings.get(firstWord) ?? 0) + 1);
    }

    for (const tag of p.hashtags ?? []) {
      const clean = tag.replace(/^#/, "").trim();
      if (clean.length >= 3) topicSet.add(clean.toLowerCase());
    }
  }

  const topEmojis = [...emojiCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([e]) => e);

  const openingPatterns = [...openings.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w);

  const recentTopics = [...topicSet].slice(0, 6);

  const avgLength = lengths.length
    ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
    : 0;

  return {
    topEmojis,
    openingPatterns,
    recentTopics,
    avgLength,
    sampleSize: posts.length,
  };
}

/**
 * Renders a voice fingerprint as a short prompt fragment, ready to append
 * to the caption system prompt. Returns an empty string when the
 * fingerprint is empty (e.g. brand new influencer).
 */
export function renderFingerprintPrompt(fp: VoiceFingerprint): string {
  if (fp.sampleSize === 0) return "";

  const lines: string[] = [
    "VOIX & MÉMOIRE :",
    `Cette personne a déjà publié ${fp.sampleSize} posts récents. Garde sa voix cohérente.`,
  ];
  if (fp.topEmojis.length) {
    lines.push(`Emojis signature à privilégier : ${fp.topEmojis.join(" ")}`);
  }
  if (fp.openingPatterns.length) {
    lines.push(
      `Évite de répéter les mêmes ouvertures : ${fp.openingPatterns.join(", ")}`
    );
  }
  if (fp.recentTopics.length) {
    lines.push(
      `Sujets/hashtags récents (NE PAS répéter le même thème) : ${fp.recentTopics.join(", ")}`
    );
  }
  if (fp.avgLength > 0) {
    lines.push(
      `Longueur naturelle des captions : ~${fp.avgLength} caractères. Reste dans cette plage.`
    );
  }
  return lines.join("\n");
}
