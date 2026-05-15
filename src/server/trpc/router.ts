import { createTRPCRouter } from "@/server/trpc";
import { influencerRouter } from "./routers/influencer";
import { contentRouter } from "./routers/content";
import { publishRouter } from "./routers/publish";
import { analyticsRouter } from "./routers/analytics";
import { billingRouter } from "./routers/billing";
import { webhookRouter } from "./routers/webhook";
import { onboardingRouter } from "./routers/onboarding";
import { apiKeysRouter } from "./routers/api-keys";
import { workspaceRouter } from "./routers/workspace";
import { mediaLibraryRouter } from "./routers/media-library";
import { referralRouter } from "./routers/referral";
import { adminRouter } from "./routers/admin";

export const appRouter = createTRPCRouter({
  influencer: influencerRouter,
  content: contentRouter,
  publish: publishRouter,
  analytics: analyticsRouter,
  billing: billingRouter,
  webhook: webhookRouter,
  onboarding: onboardingRouter,
  // Sprint 9 — Scale & B2B
  apiKeys: apiKeysRouter,
  workspace: workspaceRouter,
  mediaLibrary: mediaLibraryRouter,
  referral: referralRouter,
  // v0.11 — closed beta gating
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;

