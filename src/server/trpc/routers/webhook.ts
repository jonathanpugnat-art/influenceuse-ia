import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";
import {
  generateWebhookSecret,
  pingWebhook,
} from "@/server/services/webhook.service";

const eventValues = [
  "CONTENT_PUBLISHED",
  "CONTENT_FAILED",
  "BATCH_COMPLETED",
  "CONTENT_SCHEDULED",
  "REMIX_COMPLETED",
  "REMIX_FAILED",
] as const;

export const webhookRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);
    const webhooks = await db.webhook.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { deliveries: true } },
      },
    });
    return webhooks.map((w) => ({
      id: w.id,
      name: w.name,
      url: w.url,
      events: w.events,
      isActive: w.isActive,
      failureCount: w.failureCount,
      lastSuccessAt: w.lastSuccessAt,
      lastFailedAt: w.lastFailedAt,
      deliveriesCount: w._count.deliveries,
      createdAt: w.createdAt,
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
        url: z.string().url(),
        events: z.array(z.enum(eventValues)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const existingCount = await db.webhook.count({ where: { userId: user.id } });
      if (existingCount >= 20) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Limite de 20 webhooks par compte atteinte.",
        });
      }

      const secret = generateWebhookSecret();
      const wh = await db.webhook.create({
        data: {
          userId: user.id,
          name: input.name,
          url: input.url,
          events: input.events,
          secret,
        },
      });
      // The secret is returned exactly once on creation so the user can copy it.
      return { id: wh.id, secret };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(80).optional(),
        url: z.string().url().optional(),
        events: z.array(z.enum(eventValues)).min(1).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const wh = await db.webhook.findUnique({ where: { id: input.id } });
      if (!wh || wh.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }
      const { id, ...data } = input;
      const updated = await db.webhook.update({
        where: { id },
        data,
      });
      return { id: updated.id };
    }),

  rotateSecret: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const wh = await db.webhook.findUnique({ where: { id: input.id } });
      if (!wh || wh.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }
      const secret = generateWebhookSecret();
      await db.webhook.update({ where: { id: input.id }, data: { secret } });
      return { secret };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const wh = await db.webhook.findUnique({ where: { id: input.id } });
      if (!wh || wh.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }
      await db.webhook.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  ping: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const wh = await db.webhook.findUnique({ where: { id: input.id } });
      if (!wh || wh.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }
      return pingWebhook(input.id);
    }),

  /**
   * Recent deliveries for a webhook — used by the UI to show the user
   * exactly what their endpoint received and what response we got.
   */
  recentDeliveries: protectedProcedure
    .input(z.object({ webhookId: z.string(), limit: z.number().int().min(1).max(50).default(15) }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const wh = await db.webhook.findUnique({
        where: { id: input.webhookId },
        select: { userId: true },
      });
      if (!wh || wh.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }
      return db.webhookDelivery.findMany({
        where: { webhookId: input.webhookId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          event: true,
          status: true,
          responseCode: true,
          attempts: true,
          error: true,
          createdAt: true,
          deliveredAt: true,
        },
      });
    }),
});
