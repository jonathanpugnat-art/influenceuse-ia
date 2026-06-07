import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { agentTurnInputSchema } from "@/lib/agent-core";
import { runAgentTurn } from "@/server/services/agent.service";
import { analyzeTrendsForInfluencer } from "@/server/services/trends-agent.service";
import { getFeedForInfluencer } from "@/server/services/trends.service";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";
import type { Plan } from "@/generated/prisma/client";

const platformValues = ["INSTAGRAM", "TIKTOK", "ONLYFANS"] as const;

async function loadOwnedInfluencer(clerkId: string, influencerId: string) {
  const user = await getDbUser(clerkId);
  const influencer = await db.influencer.findUnique({
    where: { id: influencerId },
  });
  if (!influencer || influencer.userId !== user.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Influencer not found" });
  }
  return { user, influencer };
}

export const agentRouter = createTRPCRouter({
  chatTurn: protectedProcedure
    .input(agentTurnInputSchema)
    .mutation(async ({ ctx, input }) => runAgentTurn(input, ctx.userId)),

  trends: createTRPCRouter({
    analyze: protectedProcedure
      .input(
        z.object({
          influencerId: z.string(),
          platform: z.enum(platformValues).optional(),
          language: z.enum(["fr", "en"]).optional(),
          searchQuery: z.string().max(120).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { user, influencer } = await loadOwnedInfluencer(
          ctx.userId,
          input.influencerId
        );

        const { items } = await getFeedForInfluencer(influencer, {
          limit: 10,
          platform: input.platform,
          userPlan: user.plan as Plan,
          userLocale: user.locale,
        });

        const language: "fr" | "en" =
          input.language ?? (user.locale === "en" ? "en" : "fr");

        const picks = await analyzeTrendsForInfluencer(influencer, items, {
          language,
          searchQuery: input.searchQuery,
        });

        return { picks };
      }),
  }),
});
