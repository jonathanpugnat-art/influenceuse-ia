import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { agentTurnInputSchema } from "@/lib/agent-core";
import { runAgentTurn } from "@/server/services/agent.service";

export const agentRouter = createTRPCRouter({
  chatTurn: protectedProcedure
    .input(agentTurnInputSchema)
    .mutation(async ({ ctx, input }) => runAgentTurn(input, ctx.userId)),
});
