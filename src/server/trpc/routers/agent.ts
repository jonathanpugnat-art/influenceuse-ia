import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { agentTurnInputSchema } from "@/lib/agent-core";
import { runAgentTurn } from "@/server/services/agent.service";
import {
  analyzeTrendsForInfluencer,
  mapTrendItemsForAnalysis,
  proposeWeeklyFormatsForInfluencer,
} from "@/server/services/trends-agent.service";
import { getFeedForInfluencer } from "@/server/services/trends.service";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";
import type { Plan } from "@/generated/prisma/client";

const platformValues = ["INSTAGRAM", "TIKTOK", "ONLYFANS"] as const;

const trendsAgentInputSchema = z.object({
  influencerId: z.string(),
  platform: z.enum(platformValues).optional(),
  language: z.enum(["fr", "en"]).optional(),
  searchQuery: z.string().max(120).optional(),
});

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

async function loadTrendsAgentContext(
  clerkId: string,
  input: z.infer<typeof trendsAgentInputSchema>
) {
  const { user, influencer } = await loadOwnedInfluencer(
    clerkId,
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

  return {
    influencer,
    items,
    language,
    searchQuery: input.searchQuery,
  };
}

export const agentRouter = createTRPCRouter({
  chatTurn: protectedProcedure
    .input(agentTurnInputSchema)
    .mutation(async ({ ctx, input }) => runAgentTurn(input, ctx.userId)),

  trends: createTRPCRouter({
    analyze: protectedProcedure
      .input(trendsAgentInputSchema)
      .query(async ({ ctx, input }) => {
        const { influencer, items, language, searchQuery } =
          await loadTrendsAgentContext(ctx.userId, input);

        const picks = await analyzeTrendsForInfluencer(
          influencer,
          mapTrendItemsForAnalysis(items),
          { language, searchQuery }
        );

        return { picks };
      }),

    /** 3 formats / week from scraped DB feed (Mon / Wed / Fri slots). */
    weeklyFormats: protectedProcedure
      .input(
        trendsAgentInputSchema.extend({
          weekStart: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { influencer, items, language, searchQuery } =
          await loadTrendsAgentContext(ctx.userId, input);

        return proposeWeeklyFormatsForInfluencer(
          influencer,
          mapTrendItemsForAnalysis(items),
          {
            language,
            searchQuery,
            weekStart: input.weekStart,
          }
        );
      }),
  }),
});
