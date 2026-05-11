import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";
import { PLANS } from "@/lib/constants";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/**
 * Sprint 9 — Workspaces / Agency mode.
 *
 * A Workspace lets an agency owner (Plan = ENTERPRISE) invite team members
 * (or treat each as a "client account") with scoped roles. The agency owner
 * stays the billing entity; members consume the owner's credits.
 */
export const workspaceRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);

    const [owned, joined] = await Promise.all([
      db.workspace.findMany({
        where: { ownerId: user.id },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.workspaceMember.findMany({
        where: { userId: user.id },
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              ownerId: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return { owned, joined };
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(60),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      // Only Agency tier (ENTERPRISE) can create workspaces.
      const planConfig = PLANS[user.plan];
      if (user.plan !== "ENTERPRISE" && !planConfig.hasAdvancedAnalytics) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "UPGRADE_REQUIRED:agency_workspaces",
        });
      }

      const baseSlug = slugify(input.name) || "workspace";
      let slug = baseSlug;
      let i = 1;
      // Slug uniqueness: append a suffix until it's free.
      while (await db.workspace.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${++i}`;
      }

      return db.workspace.create({
        data: {
          ownerId: user.id,
          name: input.name,
          description: input.description ?? null,
          slug,
          members: {
            create: {
              userId: user.id,
              role: "ADMIN",
              acceptedAt: new Date(),
            },
          },
        },
        select: { id: true, name: true, slug: true },
      });
    }),

  /**
   * inviteMember — adds an existing user (matched by email) into the
   * workspace. The invitee must already have an account in the system —
   * we don't send invitation emails in this minimal version.
   */
  inviteMember: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        email: z.string().email(),
        role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const ws = await db.workspace.findUnique({
        where: { id: input.workspaceId },
      });
      if (!ws || ws.ownerId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not workspace owner" });
      }

      const invitee = await db.user.findUnique({
        where: { email: input.email },
      });
      if (!invitee) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found. They must sign up first.",
        });
      }

      const existing = await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: ws.id,
            userId: invitee.id,
          },
        },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member",
        });
      }

      return db.workspaceMember.create({
        data: {
          workspaceId: ws.id,
          userId: invitee.id,
          role: input.role,
          invitedBy: user.id,
          acceptedAt: new Date(),
        },
        select: { id: true, role: true },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ workspaceId: z.string(), memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const ws = await db.workspace.findUnique({
        where: { id: input.workspaceId },
      });
      if (!ws || ws.ownerId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not workspace owner" });
      }
      await db.workspaceMember.delete({ where: { id: input.memberId } });
      return { ok: true as const };
    }),

  updateMemberRole: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        memberId: z.string(),
        role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const ws = await db.workspace.findUnique({
        where: { id: input.workspaceId },
      });
      if (!ws || ws.ownerId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not workspace owner" });
      }
      return db.workspaceMember.update({
        where: { id: input.memberId },
        data: { role: input.role },
        select: { id: true, role: true },
      });
    }),

  members: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const ws = await db.workspace.findUnique({
        where: { id: input.workspaceId },
        include: { members: { include: { user: true } } },
      });
      if (!ws) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });

      const isMember =
        ws.ownerId === user.id ||
        ws.members.some((m) => m.userId === user.id);
      if (!isMember) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
      }

      return ws.members.map((m) => ({
        id: m.id,
        role: m.role,
        userId: m.user.id,
        email: m.user.email,
        name: m.user.name,
        imageUrl: m.user.imageUrl,
        joinedAt: m.acceptedAt ?? m.createdAt,
      }));
    }),

  delete: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const ws = await db.workspace.findUnique({
        where: { id: input.workspaceId },
      });
      if (!ws || ws.ownerId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not workspace owner" });
      }
      await db.workspace.delete({ where: { id: ws.id } });
      return { ok: true as const };
    }),
});
