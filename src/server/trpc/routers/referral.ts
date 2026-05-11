import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";

const REWARD_CREDITS = 50;

function generateReferralCode(): string {
  // 8-char base32-ish code, easy to type/share.
  return randomBytes(5).toString("base64url").slice(0, 8).toUpperCase();
}

/**
 * Sprint 9 — Referral Program.
 *
 * Each user gets a unique code on demand. Sharing it grants both the
 * referrer and the new signup +REWARD_CREDITS credits when the new user
 * subscribes (handled in webhook later, exposed here as a manual claim).
 */
export const referralRouter = createTRPCRouter({
  /**
   * Returns the user's referral code, generating one on first call.
   * Idempotent — same call always returns the same code per user.
   */
  myCode: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);

    let referral = await db.referral.findFirst({
      where: { referrerId: user.id, referredId: null },
    });

    if (!referral) {
      // Generate a code, retrying on collision (extremely unlikely).
      let code = generateReferralCode();
      while (await db.referral.findUnique({ where: { code } })) {
        code = generateReferralCode();
      }
      referral = await db.referral.create({
        data: {
          referrerId: user.id,
          code,
          rewardCredits: REWARD_CREDITS,
          status: "PENDING",
        },
      });
    }

    return {
      code: referral.code,
      rewardCredits: referral.rewardCredits,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sign-up?ref=${referral.code}`,
    };
  }),

  /** Stats for the dashboard widget: how many people I've referred. */
  myStats: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);

    const referrals = await db.referral.findMany({
      where: { referrerId: user.id, NOT: { referredId: null } },
      select: {
        status: true,
        rewardCredits: true,
        convertedAt: true,
        rewardedAt: true,
      },
    });

    const total = referrals.length;
    const converted = referrals.filter((r) => r.status !== "PENDING").length;
    const rewarded = referrals.filter((r) => r.status === "REWARDED").length;
    const earnedCredits = referrals
      .filter((r) => r.status === "REWARDED")
      .reduce((acc, r) => acc + r.rewardCredits, 0);

    return { total, converted, rewarded, earnedCredits };
  }),

  /**
   * applyCode — used during sign-up flow (or just-after) to attach a
   * referral code to the current user. Creates the PENDING -> referred
   * link. Awarding credits happens at first paid sub.
   */
  applyCode: protectedProcedure
    .input(z.object({ code: z.string().min(4).max(16) }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const referral = await db.referral.findUnique({
        where: { code: input.code.toUpperCase() },
      });
      if (!referral) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid code" });
      }
      if (referral.referrerId === user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Can't refer yourself" });
      }
      if (referral.referredId) {
        throw new TRPCError({ code: "CONFLICT", message: "Code already used" });
      }

      // Block duplicate referredId on this user.
      const already = await db.referral.findUnique({
        where: { referredId: user.id },
      });
      if (already) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already used a referral code",
        });
      }

      await db.referral.update({
        where: { id: referral.id },
        data: { referredId: user.id, status: "PENDING" },
      });

      return { ok: true as const };
    }),

  /**
   * markConverted — admin/webhook callable. We expose it through tRPC so
   * the Stripe webhook can flip the state once the new user pays for the
   * first time and credit both parties.
   */
  markConverted: protectedProcedure
    .input(z.object({ referredUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      // Only the referrer themself or the referred user can call this.
      const ref = await db.referral.findUnique({
        where: { referredId: input.referredUserId },
      });
      if (!ref) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Referral not found" });
      }
      if (ref.referrerId !== user.id && ref.referredId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your referral" });
      }
      if (ref.status === "REWARDED") return { alreadyRewarded: true };

      const now = new Date();
      await db.$transaction([
        db.referral.update({
          where: { id: ref.id },
          data: {
            status: "REWARDED",
            convertedAt: ref.convertedAt ?? now,
            rewardedAt: now,
          },
        }),
        db.user.update({
          where: { id: ref.referrerId },
          data: { creditsLimit: { increment: ref.rewardCredits } },
        }),
        ...(ref.referredId
          ? [
              db.user.update({
                where: { id: ref.referredId },
                data: { creditsLimit: { increment: ref.rewardCredits } },
              }),
            ]
          : []),
      ]);

      return { rewarded: true, credits: ref.rewardCredits };
    }),
});
