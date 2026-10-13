import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { fetchReels, parseHashtag } from "@/lib/reels";
import { requireUserId } from "@/lib/session";
import { saveTrend } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!checkRateLimit(userId, "scrape")) {
    return NextResponse.json(
      { error: "Dix scrapes par heure. Reviens un peu plus tard." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const hashtag = parseHashtag(
    body && typeof body === "object" ? (body as { hashtag?: unknown }).hashtag : null,
  );
  if (!hashtag) {
    return NextResponse.json({ error: "Donne un hashtag, lettres et chiffres." }, { status: 400 });
  }

  try {
    const reels = await fetchReels(hashtag);
    await saveTrend(hashtag, reels);
    return NextResponse.json({ hashtag, count: reels.length });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "missing_key") {
      return NextResponse.json({ error: "Le scraper n’est pas configuré." }, { status: 503 });
    }
    if (code === "quota_exceeded") {
      return NextResponse.json(
        { error: "Le quota Apify du mois est atteint." },
        { status: 503 },
      );
    }
    console.error("trend scrape failed", code);
    return NextResponse.json({ error: "Instagram n’a pas répondu." }, { status: 502 });
  }
}
