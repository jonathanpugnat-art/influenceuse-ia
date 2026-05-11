import { NextRequest, NextResponse } from "next/server";
import { validateAndConsume } from "@/server/services/api-key.service";
import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";

/**
 * GET /api/public/v1/influencers
 *
 * Returns the list of the authenticated user's influencers.
 * Auth: `Authorization: Bearer iia_live_…`
 * Rate limit: 60/min per key.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  try {
    const { userId, scopes } = await validateAndConsume(authHeader);
    if (!scopes.includes("READ") && !scopes.includes("ADMIN")) {
      return NextResponse.json(
        { error: "API key missing READ scope" },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
    const status = url.searchParams.get("status") ?? undefined;

    const influencers = await db.influencer.findMany({
      where: {
        userId,
        ...(status ? { status: status as "ACTIVE" | "PAUSED" | "ARCHIVED" } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        niche: true,
        gender: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ data: influencers, count: influencers.length });
  } catch (err) {
    if (err instanceof TRPCError) {
      const map: Record<string, number> = {
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        TOO_MANY_REQUESTS: 429,
      };
      return NextResponse.json(
        { error: err.message },
        { status: map[err.code] ?? 500 }
      );
    }
    console.error("[public-api] GET /influencers error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
