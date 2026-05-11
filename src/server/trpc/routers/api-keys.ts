import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { getDbUser } from "@/server/helpers/get-db-user";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  deleteApiKey,
} from "@/server/services/api-key.service";

const scopeSchema = z.enum(["READ", "WRITE", "ADMIN"]);

export const apiKeysRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);
    return listApiKeys(user.id);
  }),

  /** Returns the plain key once. Caller MUST surface it immediately. */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(60),
        scopes: z.array(scopeSchema).min(1),
        expiresInDays: z.number().int().positive().max(365 * 2).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86_400_000)
        : null;
      return createApiKey({
        userId: user.id,
        name: input.name,
        scopes: input.scopes,
        expiresAt,
      });
    }),

  revoke: protectedProcedure
    .input(z.object({ keyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      return revokeApiKey(user.id, input.keyId);
    }),

  delete: protectedProcedure
    .input(z.object({ keyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      return deleteApiKey(user.id, input.keyId);
    }),
});
