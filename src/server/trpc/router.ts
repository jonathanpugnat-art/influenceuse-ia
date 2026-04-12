import { createTRPCRouter } from "@/server/trpc";
import { influencerRouter } from "./routers/influencer";
import { contentRouter } from "./routers/content";
import { publishRouter } from "./routers/publish";
import { analyticsRouter } from "./routers/analytics";
import { billingRouter } from "./routers/billing";

export const appRouter = createTRPCRouter({
  influencer: influencerRouter,
  content: contentRouter,
  publish: publishRouter,
  analytics: analyticsRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;

