import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { photoAgentTurnInputSchema } from "@/lib/photo-studio-agent";
import { runPhotoStudioAgentTurn } from "@/server/services/photo-studio-agent.service";

export const photoAgentRouter = createTRPCRouter({
  chatTurn: protectedProcedure
    .input(photoAgentTurnInputSchema)
    .mutation(async ({ input }) => runPhotoStudioAgentTurn(input)),
});
