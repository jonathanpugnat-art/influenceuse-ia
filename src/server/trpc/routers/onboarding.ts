import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { getOnboardingState } from "@/server/services/onboarding.service";
import { getDbUser } from "@/server/helpers/get-db-user";

export const onboardingRouter = createTRPCRouter({
  /**
   * Returns the user's activation checklist. Used by the dashboard banner
   * to show progress and surface the next step's CTA.
   */
  getState: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);
    return getOnboardingState(user.id);
  }),
});
