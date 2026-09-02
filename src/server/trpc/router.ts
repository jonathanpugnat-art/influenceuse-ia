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
import { trendsRouter } from "./routers/trends";
import { photoAgentRouter } from "./routers/photo-agent";
import { agentRouter } from "./routers/agent";
import { basePortraitRouter } from "./routers/base-portrait";
import { talkingHeadRouter } from "./routers/talking-head";
import { remixRouter } from "./routers/remix";
import { seedanceRouter } from "./routers/seedance";

export const appRouter = createTRPCRouter({
  influencer: influencerRouter,
  content: contentRouter,
  photoAgent: photoAgentRouter,
  agent: agentRouter,
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
  // v0.12 — TikTok / Instagram trends intelligence
  trends: trendsRouter,
  // Sprint B — pre-generated base portraits gallery (wizard step 2)
  basePortrait: basePortraitRouter,
  // Viral Remix V1 — user pastes/uploads clip → locked character replays motion
  remix: remixRouter,
  // Talking-head V1 — Hedra Avatar + ElevenLabs voice
  talkingHead: talkingHeadRouter,
  // Seedance scene-video V1 — 10-30s locked-face scene with native audio
  seedance: seedanceRouter,
});

export type AppRouter = typeof appRouter;

