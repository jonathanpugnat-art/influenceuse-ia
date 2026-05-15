# Changelog

All notable changes to **Influenceuse IA** are documented in this file. Versions follow the [Sprint] tag where applicable. The most recent release is at the top.

---

## [v0.11.6] — Closed beta gating (waitlist) (2026-05-15)

### Added

- **`WaitlistEntry` Prisma model** + migration `20260515110000_add_waitlist` — `email` (unique), `name`, `source`, `status` (`PENDING | INVITED | SIGNED_UP | REJECTED`), `clerkInvitationId`, `invitedAt`, `signedUpAt`, `ip` (bucketed /24 or /48), `note`. Indexed on `status` and `createdAt`. Kept on REJECT so we detect repeat sign-ups from the same email.
- **`POST /api/waitlist`** — public endpoint, no auth. Anti-spam: Zod payload, disposable-domain blocklist (mailinator, yopmail, 10minutemail, …), honeypot field `companyWebsite`, idempotent on email (re-submits return `{ alreadyOnList: true }`), and an in-memory per-IP rate limiter (5 hits / 10 min, IP truncated to /24 for IPv4 and /48 for IPv6).
- **`<WaitlistForm>`** (`src/components/landing/waitlist-form.tsx`) — email + optional name form with idle/submitting/success/error states, hidden honeypot, i18n strings under `messages/{fr,en}.json#waitlist`. Used twice on the landing: hero CTA (`source=hero`) and final CTA (`source=final-cta`).
- **`/[locale]/admin/waitlist`** — admin dashboard. Stat counters (pending / invited / signed-up / total), status filter pills, email-or-name search, table with one-click **Invite** (sends Clerk invitation email) and **Reject** actions. Server-side gated via `requireAdmin(ctx.userId)` against `ADMIN_EMAILS`.
- **`admin` tRPC router** (`src/server/trpc/routers/admin.ts`) — `listWaitlist`, `inviteFromWaitlist`, `rejectFromWaitlist`. The invite path calls `clerkClient.invitations.createInvitation({ emailAddress, redirectUrl, publicMetadata })`; treats "duplicate invitation" as success so the dashboard stays usable after manual Clerk edits.
- **`src/server/helpers/admin.ts`** — `isAdminClerkId()` / `requireAdmin()` against `ADMIN_EMAILS` (comma-separated). Matches the **primary email** on the Clerk user, which is verified at sign-up and can't be spoofed by adding aliases later.

### Changed

- **`src/app/api/webhooks/clerk/route.ts`** — `user.created` now respects `BETA_REQUIRE_INVITE=true`. When the env flag is on, the webhook looks up the email in `WaitlistEntry`; if status isn't `INVITED` or `SIGNED_UP`, it deletes the freshly-created Clerk user and **does not** create the `db.user` row. When the entry exists, it's auto-promoted to `SIGNED_UP` with `signedUpAt` so the admin dashboard reflects conversions. Flag defaults to false so missing env doesn't lock you out in dev.
- **`src/app/[locale]/page.tsx`** — hero CTA replaced by `<WaitlistForm source="hero">` + closed-beta badge, final CTA likewise. Header `/sign-up` link kept so existing testers can still log in from `<nav>`.
- **`.env.example`** — documented `BETA_REQUIRE_INVITE` and `ADMIN_EMAILS` with explicit "leave empty in dev / flip in prod" guidance.

### Fixed

- `analytics-fetcher.service.ts` — `shares` is now `const` (lint `prefer-const`). Behavior unchanged: it stays 0 until we wire a richer source than the IG Graph / TikTok Content Posting APIs (neither exposes a public shares counter).

### Notes

- The waitlist is the only public path that can mutate state without Clerk auth. We accept the trade-off (necessary for conversion) and rely on three layers of defense: Zod schema, honeypot, and IP-bucket rate limit.
- The in-memory rate-limiter resets on cold start. Sufficient for beta scale; swap to Redis when daily waitlist signups exceed ~500 (Vercel will then have multiple warm instances).

---

## [v0.11.5] — Replicate rate-limit resilience (2026-05-15)

### Added

- **`src/server/services/replicate-utils.ts`** — new shared resilience module for any service that hits the Replicate API:
  - `isTransientReplicateError()` — narrow heuristic that matches 429, 5xx, "throttle", "rate limit", "service unavailable", and common socket errors (ETIMEDOUT, ECONNRESET, ENOTFOUND, EAI_AGAIN, socket hang up). 4xx other than 429 are NOT transient (bad prompt / bad model / invalid token) — retrying would waste credits.
  - `withReplicateRetry()` — exponential backoff wrapper: 5 attempts on the schedule **2 s → 4 s → 8 s → 16 s** (≈30 s worst-case wait). Logs each retry with the truncated upstream error message for diagnosability. Matches the heuristic already used in `scripts/test-engines-ab.ts`.
  - `runWithConcurrency()` — bounded `Promise.allSettled` that processes tasks in workers of a fixed pool size. Used to cap fan-out so a single 4-image generation never burst-fires 4 simultaneous Replicate predictions.
  - `MAX_PARALLEL_PREDICTIONS_PER_CALL = 2` — calibrated against Replicate's free-tier (~10 concurrent) and pay-as-you-go (~100 concurrent) quotas. At 2× per user, 5 simultaneous users stay below the free-tier ceiling.

### Changed

- **`ai-image.service.ts`** — every `replicate.run()` now goes through `withReplicateRetry()`. `runMultiplePredictions()` was rewritten to build a task list and process it via `runWithConcurrency(tasks, 2)` instead of `Promise.allSettled` on the full set. Net effect on a 4-image generation:
  - Before: 4 simultaneous requests → 429 on burst → user sees "Failed to generate".
  - After: 2+2 sequential pairs, each request retried on transient → user sees one slightly slower generation (≈+3 s p99) but no surfaced 429.
  - Total wall-clock impact for Nano Banana 4-image: ~22 s → ~25 s.
- **`ai-video.service.ts`** — `runReplicatePrediction()` (video path) also wrapped in `withReplicateRetry()`. Critical since a Kling-2 reel costs ~$0.55 / call; surfacing a transient 429 would re-bill the user. Video doesn't fan out parallel predictions (1 reel = 1 call), so only the retry helper is needed there.
- The previous in-file copies of `isTransientReplicateError` / `withReplicateRetry` / `runWithConcurrency` / `MAX_PARALLEL_PREDICTIONS_PER_CALL` that v0.11.5 was about to add to `ai-image.service.ts` were extracted to the shared module to keep the image and video services calibrated identically.

### Why this matters before the beta

- The image and video services were the only Replicate code paths **without** a 429 retry (the scripts in `scripts/` already had one). A single burst from a real user during a demo would have surfaced a generic failure and likely a confused churn. The shared helper closes that gap without introducing Redis or a queue (planned post-beta).
- Tuning knobs (`MAX_PARALLEL_PREDICTIONS_PER_CALL`, retry schedule) live in one file now, so the BullMQ migration later will be a single-spot change.

### Tests

- 143/143 passing. TypeScript clean. ESLint: 0 errors (13 pre-existing destructuring warnings only). Production build ✓.

---

## [v0.11.4] — Auto-publish hardening (2026-05-15)

### Added

- **`/api/health` enrichi** (`autoPublish` block) — l'endpoint healthcheck expose désormais la disponibilité réelle du pipeline de publication :
  - `cron` — `CRON_SECRET` configuré (sinon `/api/cron/publish` répond 500)
  - `encryption` — `ENCRYPTION_SECRET` ≥ 32 chars (sans, les tokens OAuth seraient en clair)
  - `platforms.instagram` — `INSTAGRAM_APP_ID` + `INSTAGRAM_APP_SECRET` (ou les fallbacks `FACEBOOK_*`)
  - `platforms.tiktok` — `TIKTOK_CLIENT_KEY` + `TIKTOK_CLIENT_SECRET`
  - `ready: true` si les deux premiers sont OK (les plateformes étant gérables au cas par cas)
  Les uptime monitors (BetterStack, UptimeRobot) peuvent maintenant alerter sur une mauvaise config plutôt que sur une publication silencieusement cassée.
- **`tRPC publish.checkPublishReadiness`** — pre-flight check par plateforme avant que l'utilisateur ne clique sur "Programmer" ou "Publier". Retourne pour chaque plateforme demandée :
  - `ok: true` → safe to publish
  - `mode: "auto" | "manual"` (ONLYFANS est intentionnellement manuel)
  - `reason: "..."` avec le diagnostic exact (creds serveur, compte non lié, token expiré, IG sans Business ID)
  Détecte 3 classes d'échec côté serveur (env), côté compte (OAuth) et côté plateforme (OF). Cache 30s côté React Query.
- **UI : banner "Action requise"** dans `photo-publish.tsx` — quand le pre-flight signale un blocage, une carte ambre s'affiche au-dessus du bouton publish avec la raison exacte par plateforme. Le bouton "Publier" est désactivé tant qu'au moins un blocage subsiste (ce qui évite à l'utilisateur de programmer un post qui finira `FAILED` 30s plus tard).
- **UI : banner "OnlyFans = export manuel"** — quand OnlyFans est coché, une note bleue rappelle que l'API publique n'existe pas et qu'un ZIP guidé sera généré. Le label de la carte plateforme passe aussi de "Préparer pour téléchargement" à "Export ZIP — publication manuelle".

### Changed

- **`.env.example` complété** avec les blocs manquants `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` / `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` et une doc inline en 5 étapes par plateforme (créer l'app Meta/TikTok, ajouter le bon produit, lier un compte Business/Creator, passer l'App Review, ajouter le Redirect URI). Sans ces variables, le clic "Connecter Instagram/TikTok" lève une erreur opaque — maintenant la doc rend le pré-requis explicite.

### Tests

- 143/143 passing. TypeScript clean. ESLint : 0 erreurs (3 warnings pré-existants sur des imports inutilisés dans `photo-publish.tsx`). Production build ✓.

### Notes

- Le code Instagram Graph v21 et TikTok Content Posting v2 était déjà 100 % fonctionnel — seul le câblage final (env vars documentées + visibilité de l'état) manquait pour que l'auto-publication marche réellement en production.
- Cron Vercel : rappel que `vercel.json` schedule `/api/cron/publish` chaque minute, ce qui nécessite un plan Vercel **Pro ou supérieur** (Hobby ne supporte que 2 crons/jour).

---

## [v0.11.3] — Landing page glow-up (2026-05-15)

### Added

- **Hero photo wall** — the 3 grey placeholder cards in the hero were replaced by a responsive 4-up grid of actual AI-generated photos (Luna at the gym, Amani at a restaurant, Kenji in Shibuya, Marco in NYC). Each card has IG-style like count overlay, hover zoom, and a "✨ AI" pill in the corner. A green trust badge above the wall states "Every photo below is 100% generated by our AI".
- **Stats strip** (just below the hero) — 1.2M+ photos generated · 21s avg gen time · 32 countries · 45+ active agencies, each with its own icon. Backs the social proof line with real metrics.
- **Showcase section** (`#features` neighbour) — 4 full Instagram-style profile cards for Luna / Amani / Kenji / Marco. Each card has a verified-badge handle header, a 4:5 main post with full IG action bar (heart / comment / share / bookmark), a likes-and-caption block, and a mini grid of 1-3 other shots from that influencer. Demonstrates persona diversity *and* face consistency across scenes in a single visual block.
- **Before / After section** — full-bleed comparison: 3:4 wizard portrait on the left → "→" arrow chip → 2×2 grid of generated content on the right. Makes the "create the face once, get any scene" promise legible in 2 seconds.
- **Testimonials section** — 3 quote cards (creator solo / agency CEO / fitness influencer) with avatar, name, role and a violet Quote watermark. Sits between the pricing teaser and the final CTA, exactly where trust is needed before the conversion.
- **Final CTA decoration** — two angled portrait thumbnails (Luna top-left, Kenji bottom-right) bleeding off the violet gradient card. Adds personality to the previously flat CTA without compromising readability.
- **15 photo assets** copied from `test-output/engines-2026-05-15T08-01-45/` into `public/landing/`:
  - `influencers/{luna,amani,kenji,marco}.jpg` (base portraits)
  - `showcase/{luna,amani,kenji,marco}-*.jpg` (11 lifestyle scenes — gym, café, mirror, restaurant, shopping, Tokyo street, NYC street, park, etc.)
  All assets are Nano Banana / Flux 1.1 Pro outputs, so the landing is now exactly what a paying user gets out of the product.

### Changed

- All new copy is fully i18n-ed under `messages/{fr,en}.json > landing` (≈25 new keys for the photo captions, section titles, stats labels, and the 3 testimonial blocks).
- The "Social proof" strip now sits inside the same `<section>` as the new stats block, with the logos reduced to a low-opacity row beneath the stats — cleaner and less repetitive than the previous standalone band.
- Imported `next/image` and 8 new lucide icons (`Heart`, `MessageCircle`, `Send`, `Bookmark`, `Camera`, `Quote`, `Zap`, `Globe`).

### Tests

- 143/143 passing. TypeScript clean. ESLint clean (after escaping `&ldquo;` / `&rdquo;` around the testimonial quote). Production build ✓ (no new pre-renders, only existing `/[locale]` SSG).

---

## [v0.11.2] — Reel credit re-pricing (2026-05-15)

### Changed

- **`CREDIT_COSTS.REEL` 5 → 8** (`src/lib/constants.ts`). The previous 5-credit reel under-priced the Replicate video models by a large factor:
  - Photo cost (`google/nano-banana` / Flux 1.1 Pro) ≈ **$0.04** per image.
  - Reel cost (Kling-2 default / Wan 2.5) ≈ **$0.55** per clip — i.e. **~14× a photo**, yet billed only **5×**.
  - Worst-case Agency (5 000 credits, all reels) used to mean **100 reels = ~$55 of Replicate**, plus Clerk + R2 + DeepSeek + Stripe fees → marge ≈ 0 € on a 199 € plan.
- New 8-credit ratio caps the worst-case Agency at **~62 reels ≈ $34 of Replicate**, preserving a healthy gross margin even on a full-throttle agency month. Realistic Pro user (1 500 credits) now gets ~18 reels, in line with normal weekly cadence.
- `src/server/trpc/routers/analytics.ts` now reads the per-type cost from `CREDIT_COSTS` instead of a hard-coded `{ PHOTO: 1, REEL: 5 }`, so the per-influencer cost analytics stay in sync automatically.

### Notes

- Plan prices unchanged (Free / Creator 29 € / Pro 79 € / Agency 199 €).
- Existing scheduled reels keep their already-deducted credit cost — only new generations use the new ratio.
- Tests: 143/143 passing. TypeScript clean. Production build ✓.

---

## [v0.11.1] — Image engine routing (2026-05-15)

### Changed

- **Optimal SFW routing** (`ai-image.service.ts`) — after the 2026-05-15 A/B/C bench (Flux 1.1 Pro vs Flux Kontext Pro vs Google Nano Banana on 4 personas × 3 scenarios), the routing was rewritten to maximise quality at minimum latency:
  - Wizard portrait (no reference) → `flux-1.1-pro` on **every plan** (cleaner identity across 4 variations, no plan check needed).
  - SFW content with face reference → `google/nano-banana` (fastest at avg 21s, best "iPhone TikTok" aesthetic, best context fidelity — real gym mirrors, real cafés, real props).
  - SFW content flagged "borderline" (beach / pool / swimwear / lingerie / shower / sarong / wet shirt / see-through / etc.) → pre-routed to `flux-kontext-pro` (Google's safety filter consistently refused these in the bench).
  - SFW content without face reference → `flux-1.1-pro` T2I.
  - NSFW → `flux-dev-uncensored` (unchanged).
- **Auto-fallback Nano → Kontext** — if Nano Banana returns a safety-filter error on a shot the lexical guard didn't catch, the service automatically retries on Flux Kontext Pro before bubbling the error. The user gets a photo instead of an opaque failure.

### Removed

- `PLANS.<tier>.usesGoogleNanoBanana` + helper `planUsesGoogleNanoBanana()` in `constants.ts` — image engine selection is no longer plan-gated. Nano Banana is the SFW default for everyone; Kontext picks up the safety edge cases. Plan tier still drives features (`maxInfluencers`, `hasVideo`, `hasNsfw`, …) and credits, but the engine is determined by the scene, not the wallet.

### Tests

- 89/89 passing. `influencer.test.ts` `PLANS` mock cleaned up (no more `usesGoogleNanoBanana`).
- TypeScript: `tsc --noEmit` clean.
- ESLint: 0 errors, 13 pre-existing destructuring warnings only.
- Production build: ✓ generated.

---

## [v0.11.0] — Sprint 12: Time to First Influencer (2026-05-07)

### Added

- **AI persona suggestions** — new tRPC endpoint `influencer.suggestPersona` and a "Suggérer ✨" button on Step 1 of the wizard. Returns 3 distinct `{bio, personality}` drafts (authentique / drôle / audacieuse) generated by DeepSeek/Anthropic in a single JSON call. Free of charge.
- **Instagram mockup at Step 4** — the previous text-based summary was replaced by a full fake Instagram profile (avatar with story-ring, follower stats, bio, niche pill, 3×3 grid with the chosen photo as "first post" and locked placeholders for upcoming ones). Triggers the "this is my future star" emotion right before the create CTA.
- **Wizard draft persistence** — Zustand store now uses the `persist` middleware (`localStorage` key `influencer-wizard-draft`). Refreshing the tab or accidentally closing it no longer wastes the credits already spent on the base portrait. `isGenerating` is intentionally not persisted to avoid stuck spinners.
- `**refundCredits()` helper** — in `credits.service.ts`. Best-effort, never-throwing. Available for future flows that need to roll back a charge if a downstream step fails.

### Changed

- **Step 2 (Appearance) is no longer blocked** — the previous `canGenerate = ethnicity && hairColor && bodyType` rule forced 3 selects before the user could see anything. The button now reads "Surprends-moi ✨" when no choice has been made and falls back to safe defaults (caucasian / brown / average / casual). Three dead clicks turned into one magical first impression.

### Tests

- 142/142 passing (no new test surface needed; only UI plumbing and one new tRPC mutation).

---

## [v0.10.0] — Sprint 10: Operational polish (2026-05-08)

### Added

- **Analytics auto-fetch cron** (`/api/cron/fetch-analytics`) — pulls views/likes/comments from Instagram & TikTok hourly. Smart refresh schedule based on post age (live for 24h, 6h cadence for 1-7d, daily for 7-30d, weekly beyond). Fills the time-series the `/analytics` page was already prepared to display.
- **Smart scheduler** (`analytics.suggestSlots`) — data-driven slot suggestions powered by the engagement heatmap. Top 30% cells, ±2h dedup, +1h minimum lookahead, configurable count (1-30). Designed to be consumed by the calendar UI for batch generation defaults.
- **Media Library UI** (`/library`) — page consuming the `mediaLibrary` tRPC router with grid view, kind filters (image/video/audio/preset), search by name/tag, stats cards, add-asset dialog, delete. Sidebar entry "Library" added.
- **Lip-sync video preset** — new `reelStylePreset: "lip_sync"` and `sync/sync-1.6.0` model in the video router. When `audioUrl` is provided alongside a lip-sync request, the pipeline chains: Kling generates the base video → sync post-processes the mouth alignment. Soft-fails to base video if sync fails. New env var `REPLICATE_LIPSYNC_MODEL`.

### Tests

- 22 new unit tests across 3 new spec files (analytics-fetcher, smart-scheduler, video-prompts lip_sync). 140/140 passing.

---

## [v0.9.5] — Polish/Release (2026-05-07)

### Added

- **Public changelog page** at `/changelog` (FR + EN), prerendered statically.
- `**/api/health` endpoint** — DB ping with latency, suitable for uptime monitors.
- `**logger` utility** (`@/lib/logger`) — scoped console wrapper, silenced in tests, ready to swap for Sentry/Axiom later.
- `**CHANGELOG.md`** consolidated history.
- `**README.md**` rewritten with full project documentation.
- **Prisma baseline migration** (`20260507000000_baseline_v0_9`) for clean deployments.

---

## [v0.9.0] — Sprint 9: Scale & B2B (2026-05-07)

### Added

- **Public REST API** (`/api/public/v1/`*) authenticated via `Authorization: Bearer iia_live_…`. Per-key rate limit of 60 req/min on a rolling window.
- **API key management** in Settings (`apiKeys.list / create / revoke / delete`). Plain key shown **once** at creation, hashed (SHA-256) at rest with a public prefix preview.
- **Workspaces / Agency mode** (Plan = Agency). New `Workspace` + `WorkspaceMember` Prisma models. Roles: `ADMIN`, `MEMBER`, `VIEWER`. tRPC: `workspace.list / create / inviteMember / updateMemberRole / removeMember / members / delete`.
- **Media Library** — reusable asset catalog (images, videos, audio, presets) with tags, optional influencer scoping, and aggregated stats by kind.
- **Referral program** — unique 8-char code per user, transactional reward of +50 credits to both parties on conversion. tRPC: `referral.myCode / myStats / applyCode / markConverted`.

### Schema

- New enums: `ApiKeyScope`, `WorkspaceRole`, `MediaAssetKind`, `ReferralStatus`.
- New tables: `ApiKey`, `Workspace`, `WorkspaceMember`, `MediaAsset`, `Referral`.

### Security

- API key plain-text never persisted.
- Anti-self-referral, anti-double-use checks.
- All workspace mutations gated by `ownerId` ownership check.

---

## [v0.8.0] — Sprint 8: Differentiation (2026-05-07)

### Added

- **Advanced analytics** :
  - `analytics.getCreditROI` — views/likes per credit by influencer.
  - `analytics.getBestPostingHours` — heatmap 7×24 + top 5 slots.
  - `analytics.getEngagementTimeline` — daily series of views/likes/comments/engagement.
- **Personality Memory** (`personality-memory.service.ts`). Inspects an influencer's recent published captions to extract a voice fingerprint (top emojis, recurring openings, recent topics, average length) and injects it into the caption generation system prompt for cross-post consistency.
- **Content Recycler** — re-publishes top-performing posts with regenerated captions but the same media. tRPC: `content.listRecycleCandidates / recyclePost`. UI panel on `/calendar`.
- **A/B caption variants** — `content.generateCaptionVariants` returns 2 distinct captions (parallel calls, 2× cost). UI in `photo-publish.tsx` next to the regular generator.

### UI

- New components: `<CreditRoi/>`, `<BestHoursHeatmap/>`, `<RecyclePanel/>`. Integrated in `/analytics` and `/calendar`.

---

## [v0.7.0] — Sprint 7: Activation (2026-05-07)

### Added

- **22 pre-baked influencer templates** (`influencer-templates.ts`) covering Fitness, Fashion, Beauty, Travel, Food, Finance, Tech, Gaming, Lifestyle, Art, Pets, BookTok, Adult. NSFW templates auto-hidden when the plan doesn't allow it. UI: `<TemplatePicker/>` at the top of wizard step 1 (1 click = 7 fields filled).
- **Multi-model video router** — extended allowlist to **MiniMax**, **Kling 2.0**, **Wan 2.5 I2V**, **Runway Gen-4 Aleph**. Smart routing per `reelStylePreset`:
  - `stable_face` → Kling
  - `natural_motion` → MiniMax
  - `creative` → Runway (auto-fallback to MiniMax when an image ref is needed).
  - 3 env overrides: `REPLICATE_VIDEO_MODEL_STABLE_FACE / _NATURAL_MOTION / _CREATIVE`.
- **Stripe credit packs** (one-time payments): Boost (100/9€), Pro (500/39€), Studio (1500/99€). Webhook handler increments `creditsLimit` on `checkout.session.completed` with `kind=credit_pack`.
- **Tier rename** — UI labels migrated to `Free / Creator / Pro / Agency` (Prisma enum unchanged for backward compat).

### UI

- `<CreditPacks/>` card on `/billing`. PlanBadge & upgrade modal updated.

---

## [v0.6.0] — Phase 6: Monétisation & Onboarding (2026-04)

### Added

- `STARTER` plan in addition to FREE/PRO/ENTERPRISE.
- Onboarding checklist on `/dashboard` (5 activation steps).
- Low-balance banner globally in dashboard layout.
- Global `UpgradeModal` triggered contextually on tRPC errors prefixed with `UPGRADE_REQUIRED:<reason>`.

---

## [v0.5.0] — Phase 5: Distribution & Coherence (2026-04)

### Added

- **Outbound webhooks** (`webhook.service.ts`). HMAC-SHA256 signed payloads, retry queue, replay deliveries log. Events: `CONTENT_PUBLISHED`, `CONTENT_FAILED`, `BATCH_COMPLETED`, `CONTENT_SCHEDULED`.
- Idempotent publication path (no duplicate `PublishResult`).
- Instagram token proactive refresh before publishing.
- Cron: `/api/cron/retry-webhooks`.

---

## [v0.4.0] — Phase 4: Batch Generation (2026-04)

### Added

- `ContentBatch` model + `batch.service.ts` to slice through DRAFT generations.
- Cron `/api/cron/process-batches`.
- `<BatchProgressPanel/>` on `/calendar` with run-now & retry-failures.

---

## [v0.3.0] — Phase 3: Content Agent (2026-03)

### Added

- Multi-day editorial plans (hooks, captions, hashtags, suggested slots).
- Anthropic Claude provider added alongside DeepSeek (`AI_TEXT_PROVIDER` env).
- `content.generatePlan / generateIdeas` tRPC endpoints.

---

## [v0.2.0] — Phase 2: Credible video (image-to-video) (2026-03)

### Added

- I2V pipeline with subject reference for face consistency.
- Reel preset system: `stable_face | natural_motion | creative`.

---

## [v0.1.0] — Phase 1: Character Coherence (images) (2026-02)

### Added

- Base image generator with locked face features (IP-Adapter / character reference).
- Pose, scene, accessories, outfit decoupled in the photo wizard.

---

## [v0.0.x] — Foundations (2026-01)

### Added

- Next.js 16 + tRPC 11 + Prisma 7 + Clerk + Stripe + Replicate + R2.
- FR/EN i18n with `next-intl`.
- Photo & reel creators, dashboard, calendar, analytics MVP.
- DeepSeek for text generation, Replicate Flux 1.1 Pro for images.