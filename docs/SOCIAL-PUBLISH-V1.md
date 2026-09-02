# Social Publish V1 — Instagram Reels + TikTok Direct Post

Published: Sprint “Aura Influences · V1 publish”
Owner: `src/server/services/{instagram,tiktok,publisher,scheduler}.service.ts`

## Scope

- Post an already-generated MP4 (remix / talking-head / library video) to
  **Instagram Reels** and/or **TikTok**, either **now** or **scheduled**.
- **Official APIs only.** No `instagrapi`, no mobile / unofficial endpoints,
  no scraping.
- **Business / Creator** accounts only.
- **AI labels hardcoded**: `is_ai_generated=true` (Instagram) and `is_aigc=true`
  (TikTok) on every publish. No opt-out.

### Out of scope for V1

Stories, carousel-only, photos-only, Later grid, best-time, recycle, Fanvue,
Trial Reels (kept as a later toggle), analytics.

## Data model

Content-level publish fields live directly on the existing `Content` model
(migration `20260821235000_add_social_publish_v1`):

| Column               | Type    | Meaning                                          |
| -------------------- | ------- | ------------------------------------------------ |
| `isAiGenerated`      | Boolean | Always true in V1.                              |
| `firstComment`       | String? | Optional IG first comment (best-effort).        |
| `shareToFeed`        | Boolean | IG Reels feed mirror (default true).            |
| `tiktokPrivacyLevel` | String? | `SELF_ONLY` / `MUTUAL_FOLLOW_FRIENDS` / …       |
| `igMediaId`          | String? | Meta media id after successful publish.         |
| `tiktokPublishId`    | String? | TikTok Direct Post `publish_id`.                |

`SocialAccount` gains `scopes[]` (OAuth grants) and `privacyOptions` (last
`creator_info` snapshot for the composer).

## Instagram Reels flow

Host: `https://graph.instagram.com/v21.0/…`.
Auth mode default: **Instagram Login** (no Facebook Page required).
Scopes: `instagram_business_basic,instagram_business_content_publish`.

1. `POST /{ig-user-id}/media` with:
   - `media_type=REELS`
   - `video_url` (public HTTPS)
   - `caption`
   - `share_to_feed` (from composer, default true)
   - **`is_ai_generated=true`** (hardcoded)
2. Poll `GET /{container-id}?fields=status_code` every 2 s (up to 60 s).
   `ERROR` fails the job, `EXPIRED` is treated as fail.
3. `POST /{ig-user-id}/media_publish` with the container id.
4. If `firstComment` is set, `POST /{media-id}/comments`. Best-effort: a
   missing `instagram_manage_comments` scope only logs — the publish stays
   SUCCESS.

Token refresh runs in `publisher.service.ts` when < 7 days remain
(`refreshToken()` → `ig_refresh_token`). Tokens are encrypted at rest.

## TikTok Direct Post flow

Host: `https://open.tiktokapis.com`.
Scopes: `user.info.basic,video.publish`.
Rate: 6 init/min/token.

1. `POST /v2/post/publish/creator_info/query/` → returns
   `privacy_level_options`, comment/duet/stitch flags, max duration, creator
   nickname/username/avatar. Composer uses this to render the privacy picker.
2. `POST /v2/post/publish/video/init/` with:
   - `post_info.privacy_level` (from user choice; server clamps to
     `SELF_ONLY` while unaudited — see below)
   - `post_info.is_aigc=true` (hardcoded)
   - Optional `disable_comment` / `disable_duet` / `disable_stitch`
   - `source_info.source = PULL_FROM_URL` (verified domain) or
     `FILE_UPLOAD` (chunked PUT) on `url_ownership_unverified` fallback.
3. `publish_id` returned by init is stored on `Content.tiktokPublishId`.
4. Aura's cron fires publishes at `scheduledAt` — **we do NOT use TikTok
   server-side scheduling.** Each destination is independent (IG failure
   never cancels TikTok, and vice versa).

Visible failures (never retried): `spam_risk_too_many_posts`,
`spam_risk_user_banned_from_posting`, `reached_active_user_cap`,
`invalid_privacy_level`, `url_ownership_unverified`, expired token.
`rate_limit_exceeded` and `5xx` are retried up to 3 times with backoff.

## Sandbox / Audit gating

TikTok Content Posting API is **audit-gated**. Until an app is approved:

- `creator_info.privacy_level_options` returns `["SELF_ONLY"]`.
- Aura’s server clamps any client-supplied `privacy_level` to `SELF_ONLY`
  (`isTikTokAuditApproved()` returns false by default).
- The composer shows a banner: “TikTok non auditée : SELF_ONLY forcé”.
- Flip `TIKTOK_AUDIT_APPROVED=true` in the environment ONLY after review is
  approved.

The rest of Aura keeps working in sandbox during Meta / TikTok App Review — do
not fake review approval.

## Scheduler

- Every minute `/api/cron/publish` (Vercel Cron in prod) runs
  `checkAndPublish()`.
- Content with `status = SCHEDULED` and `scheduledAt <= now` is atomically
  claimed (`SCHEDULED → GENERATING`) and dispatched to `publishContent()`.
- Idempotency: a platform with an existing `PublishResult` in `SUCCESS`
  status is skipped (`publisher.service.ts`).
- Stuck claims older than 15 min are automatically reverted to `SCHEDULED`.

## Composer UX

Rendered by `PhotoPublish` (used by both the photo studio and the reel
studio). The V1 fields sit in `PhotoPublishSocialSection`:

- AI label notice — informational.
- First comment (Instagram) — optional textarea.
- TikTok privacy picker — driven by `getTiktokCreatorInfo` tRPC procedure.
  Locked to `SELF_ONLY` when `auditApproved=false`.

## Env vars

```
INSTAGRAM_LOGIN_APP_ID=
INSTAGRAM_LOGIN_APP_SECRET=
INSTAGRAM_OAUTH_MODE=instagram   # instagram | facebook (V1 = instagram)
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_AUDIT_APPROVED=false      # flip to true after review
```

## Compliance

- `is_ai_generated` / `is_aigc` forced.
- Optional EU AI Act art. 50 caption prefix if the asset carries
  `is_synthetic_speech` (client-side today; server enforcement can be layered
  later without a schema change).
- No anti-detection, no metadata strip.
- User consents to post on **their own accounts** — Aura never posts to a
  third-party account.

## Reviews & audits

- Meta Instagram App Review: `instagram_business_basic`,
  `instagram_business_content_publish`. Provide a screencast of the reel
  composer, screencast of the OAuth flow, and the deletion callback URL
  (already at `/data-deletion`).
- TikTok Content Posting API audit: request `video.publish` and detail the
  Direct Post integration. Include a signed-in demo account.
