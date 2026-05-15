import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/helpers/admin";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * Admin-only operations. Every procedure starts with `requireAdmin(ctx.userId)`
 * which throws FORBIDDEN unless the caller's email is in ADMIN_EMAILS.
 *
 * Closed-beta scope: just enough surface to run the waitlist (list,
 * promote to "INVITED" via Clerk invitation, reject). Anything broader
 * (impersonate, bump credits, edit any user) is intentionally out of
 * scope for v0.11 — we'll wire it post-beta when patterns emerge.
 */
export const adminRouter = createTRPCRouter({
  /**
   * Paginated list of waitlist entries. Filters by status and optional
   * substring search on email/name. Ordered newest first.
   */
  listWaitlist: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["PENDING", "INVITED", "SIGNED_UP", "REJECTED"])
          .optional(),
        search: z.string().trim().max(80).optional(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.userId);

      const where: Record<string, unknown> = {};
      if (input.status) where.status = input.status;
      if (input.search) {
        where.OR = [
          { email: { contains: input.search, mode: "insensitive" } },
          { name: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const items = await db.waitlistEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });
      const nextCursor =
        items.length > input.limit ? items.pop()?.id ?? null : null;

      const [pending, invited, signedUp] = await Promise.all([
        db.waitlistEntry.count({ where: { status: "PENDING" } }),
        db.waitlistEntry.count({ where: { status: "INVITED" } }),
        db.waitlistEntry.count({ where: { status: "SIGNED_UP" } }),
      ]);

      return {
        items,
        nextCursor,
        stats: { pending, invited, signedUp, total: pending + invited + signedUp },
      };
    }),

  /**
   * Promote a waitlist entry to INVITED: triggers a Clerk invitation
   * (email sent by Clerk) and stores the invitation id so we can match
   * the eventual sign-up.
   *
   * If Clerk says "already invited" (duplicate_invitation), we still
   * mark the entry as INVITED — this lets us re-flag entries after a
   * manual Clerk dashboard action without erroring out the admin UI.
   */
  inviteFromWaitlist: protectedProcedure
    .input(z.object({ entryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.userId);

      const entry = await db.waitlistEntry.findUnique({
        where: { id: input.entryId },
      });
      if (!entry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
      }
      if (entry.status === "SIGNED_UP") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Entry already converted to a signed-up user.",
        });
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      let clerkInvitationId: string | null = entry.clerkInvitationId ?? null;

      try {
        const client = await clerkClient();
        const inv = await client.invitations.createInvitation({
          emailAddress: entry.email,
          redirectUrl: `${appUrl}/sign-up`,
          publicMetadata: {
            waitlistEntryId: entry.id,
            source: entry.source ?? "landing",
          },
        });
        clerkInvitationId = inv.id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Clerk replies 422 / "duplicate_invitation" when the email
        // already has an active invitation. Treat as success.
        if (!/duplicate|already.+invited|already.+exists/i.test(msg)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Clerk invitation failed: ${msg}`,
          });
        }
      }

      const updated = await db.waitlistEntry.update({
        where: { id: entry.id },
        data: {
          status: "INVITED",
          invitedAt: new Date(),
          clerkInvitationId,
        },
      });

      return updated;
    }),

  /**
   * Mark an entry as REJECTED (spam / not the audience / abuse). Doesn't
   * delete the row so we can detect repeat sign-ups from the same email.
   */
  rejectFromWaitlist: protectedProcedure
    .input(z.object({ entryId: z.string(), note: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.userId);
      return db.waitlistEntry.update({
        where: { id: input.entryId },
        data: { status: "REJECTED", note: input.note ?? null },
      });
    }),
});
