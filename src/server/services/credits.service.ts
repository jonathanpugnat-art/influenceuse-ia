import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";

// ──────────────────────────────────────────────
// Credits Service
// ──────────────────────────────────────────────

export interface CreditInfo {
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Get user credit info by their internal DB id.
 */
export async function getCredits(userId: string): Promise<CreditInfo> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { creditsUsed: true, creditsLimit: true },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return {
      used: user.creditsUsed,
      limit: user.creditsLimit,
      remaining: Math.max(0, user.creditsLimit - user.creditsUsed),
    };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    console.error("[credits.service] getCredits error:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to get credits",
    });
  }
}

/**
 * Get user credit info by Clerk ID.
 */
export async function getCreditsByClerkId(
  clerkId: string
): Promise<CreditInfo & { userId: string }> {
  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true, creditsUsed: true, creditsLimit: true },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return {
      userId: user.id,
      used: user.creditsUsed,
      limit: user.creditsLimit,
      remaining: Math.max(0, user.creditsLimit - user.creditsUsed),
    };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    console.error("[credits.service] getCreditsByClerkId error:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to get credits",
    });
  }
}

/**
 * Check if user has enough credits for a given cost.
 */
export async function checkCredits(
  userId: string,
  cost: number
): Promise<boolean> {
  try {
    const credits = await getCredits(userId);
    return credits.remaining >= cost;
  } catch (error) {
    console.error("[credits.service] checkCredits error:", error);
    return false;
  }
}

/**
 * Deduct credits from a user. Throws if insufficient credits.
 */
export async function deductCredits(
  userId: string,
  cost: number
): Promise<void> {
  try {
    const credits = await getCredits(userId);

    if (credits.remaining < cost) {
      throw new TRPCError({
        code: "FORBIDDEN",
        // Tagged message for the client-side useUpgradeOnLimitError hook.
        message: `UPGRADE_REQUIRED:credits_exhausted:${cost}:${credits.remaining}`,
      });
    }

    await db.user.update({
      where: { id: userId },
      data: { creditsUsed: { increment: cost } },
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    console.error("[credits.service] deductCredits error:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to deduct credits",
    });
  }
}

/**
 * Sprint 12 — Refund credits for a user. Used when a downstream step
 * (storage upload, DB write…) fails AFTER `deductCredits` already ran. We
 * never want to charge the user for a result they didn't receive. Best-effort:
 * never throws so the original error keeps bubbling up to the client.
 */
export async function refundCredits(
  userId: string,
  cost: number
): Promise<void> {
  if (cost <= 0) return;
  try {
    await db.user.update({
      where: { id: userId },
      data: { creditsUsed: { decrement: cost } },
    });
    console.log(`[credits.service] refunded ${cost} credit(s) to user ${userId}`);
  } catch (error) {
    // Best-effort: log and swallow. We don't want to mask the original error.
    console.error("[credits.service] refundCredits error:", error);
  }
}

/**
 * Reset credits for a user (called by Stripe webhook on subscription renewal).
 */
export async function resetCredits(userId: string): Promise<void> {
  try {
    await db.user.update({
      where: { id: userId },
      data: { creditsUsed: 0 },
    });
  } catch (error) {
    console.error("[credits.service] resetCredits error:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to reset credits",
    });
  }
}

