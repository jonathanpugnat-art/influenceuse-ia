import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";

/**
 * Public waitlist endpoint — no auth required.
 *
 * Anyone can submit their email from the landing page to express interest
 * in the closed beta. An admin then promotes entries from /admin/waitlist
 * to send a Clerk invitation (separate router endpoint).
 *
 * Anti-spam guards (kept light: the form is the entry funnel, harsh
 * rejection costs us real conversions):
 *
 *   1. Zod schema + max length on every field.
 *   2. Email syntax + tiny disposable-domain block list.
 *   3. Honeypot field `companyWebsite` — must stay empty (bots fill it).
 *   4. Per-IP rate limit: 5 submissions / 10 min (truncated IP). Stored
 *      in-memory, fine for a single Vercel instance during the beta;
 *      replaced by Redis when traffic warrants it.
 *   5. Idempotent on email: re-submitting a known address returns
 *      `{ ok: true, alreadyOnList: true }` so the UX is friendly even
 *      under "I already signed up but forgot" reflex clicks.
 */

const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(80).optional(),
  source: z.string().trim().max(40).optional(),
  /** Honeypot — real users never see this field, bots fill it. */
  companyWebsite: z.string().max(200).optional(),
});

/**
 * Domains we never want on the waitlist (10-min throwaways). Not exhaustive
 * by design — we accept Gmail / Outlook / pro emails freely.
 */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "tempmail.com",
  "10minutemail.com",
  "throwaway.email",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "maildrop.cc",
]);

/** In-memory IP rate-limiter. Cleared on cold-start, fine for beta. */
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_HITS = 5;

function checkAndBumpRateLimit(ip: string): { allowed: boolean; resetAt: number } {
  const now = Date.now();
  const entry = ipBuckets.get(ip);
  if (!entry || entry.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, resetAt: now + RATE_WINDOW_MS };
  }
  if (entry.count >= RATE_MAX_HITS) {
    return { allowed: false, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, resetAt: entry.resetAt };
}

/**
 * Truncate the client IP for privacy / coarse rate-limiting:
 *   - IPv4 1.2.3.4 → "1.2.3.0/24" bucket key
 *   - IPv6 abcd::ef01:2345 → first 3 hextets bucket key
 * Falls back to the raw value (or "unknown") if parsing fails.
 */
function bucketIp(raw: string | null | undefined): string {
  if (!raw) return "unknown";
  const ip = raw.split(",")[0]?.trim() ?? "unknown";
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const parts = ip.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 3).join(":") + "::/48";
  }
  return ip;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 }
    );
  }

  // Honeypot: pretend success so bots don't probe.
  if (parsed.data.companyWebsite && parsed.data.companyWebsite.length > 0) {
    return NextResponse.json({ ok: true, alreadyOnList: false });
  }

  const email = parsed.data.email;
  const domain = email.split("@")[1] ?? "";
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return NextResponse.json(
      { ok: false, error: "disposable_email_blocked" },
      { status: 400 }
    );
  }

  const ipKey = bucketIp(
    req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip")
  );
  const rl = checkAndBumpRateLimit(ipKey);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAt: rl.resetAt },
      { status: 429 }
    );
  }

  try {
    const existing = await db.waitlistEntry.findUnique({
      where: { email },
      select: { id: true, status: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, alreadyOnList: true });
    }

    await db.waitlistEntry.create({
      data: {
        email,
        name: parsed.data.name ?? null,
        source: parsed.data.source ?? "landing",
        ip: ipKey,
      },
    });

    return NextResponse.json({ ok: true, alreadyOnList: false });
  } catch (err) {
    console.error("[waitlist] insert failed:", err);
    return NextResponse.json(
      { ok: false, error: "internal" },
      { status: 500 }
    );
  }
}
