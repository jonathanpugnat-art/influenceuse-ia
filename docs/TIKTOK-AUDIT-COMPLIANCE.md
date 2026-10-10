# TikTok Content Posting API — Audit Compliance

Last updated: 2026-10-10 · Scope: `video.publish` (Direct Post) + `user.info.basic`

This doc tracks how Aura Influence implements each UX item TikTok requires
before approving a Content Posting API audit. It is the companion to
[`SOCIAL-PUBLISH-V1.md`](./SOCIAL-PUBLISH-V1.md); the latter describes the
Instagram and TikTok runtime, this one is the audit checklist.

Sources:

- https://developers.tiktok.com/doc/content-sharing-guidelines
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info

## Requirement → implementation map

| # | TikTok requirement | Implementation |
|---|---|---|
| 1 | Call `creator_info` when rendering the post page | `publish.getTiktokCreatorInfo` tRPC query, mounted when the composer selects TikTok (`photo-publish-tiktok-section.tsx`) |
| 2 | Show the creator's nickname + avatar | Composer header: `publishTiktokPostingTo` + `creatorAvatarUrl` from `creator_info` |
| 3 | Stop publish if creator can't post now (banned / spam-risk / audit-locked) | Both the server-side error map in `tiktok.service.ts` (`friendlyTikTokMessage`) and the `getConnectedAccounts` + `creator_info` query surface the error; `assertTikTokPublishRules` in `publish.ts` also enforces the "privacy explicitly selected" rule |
| 4 | Check video length against `max_video_post_duration_sec` | Composer displays the cap (`publishTiktokMaxDurationHint`); the service refuses to call `/video/init/` when `videoDurationSec` > creator cap (`video_duration_exceeds_max`) |
| 5 | Editable title | Caption textarea in `PhotoPublishCaptionSection`, sent as `post_info.title` |
| 6 | Privacy = dropdown, options only from `privacy_level_options`, NO default | `PhotoPublishTiktokSection` uses `<Select>` with placeholder, `tiktokPrivacyLevel` starts as `null`, publish is gated client- and server-side until the user picks a value |
| 7 | Allow Comment / Duet / Stitch checkboxes, all unchecked by default, greyed when disabled by creator settings | `InteractionCheckbox` rows in the composer; defaults are `tiktokAllow* = false` → UI model inverts to `disable_* = true`; service also forces `disable_* = true` when `creator_info` reports `*_disabled` |
| 8 | Commercial content disclosure toggle (OFF by default) → "Your brand" / "Branded content" with the correct label hints; branded content cannot be SELF_ONLY | Composer: `tiktokCommercialDisclosure` switch (off by default) + radio for `YOUR_BRAND` / `BRANDED_CONTENT` with the mandated label text (`Promotional content` / `Paid partnership`). Service sends `brand_organic_toggle` / `brand_content_toggle` and throws `branded_content_requires_public` for branded + SELF_ONLY. Router rejects the same combo with a BAD_REQUEST before any API call |
| 9 | Consent text above Publish (Music Usage Confirmation + Branded Content Policy when applicable) | `PhotoPublishTiktokSection` renders the required text with live links; branded-content path appends the Branded Content Policy link |
| 10 | Preview of the content being posted | `PublishConfirmDialog` renders the asset (video / image) + caption + hashtags before confirmation |
| 11 | No watermark or promotional branding | Aura never overlays any watermark; the composer does not inject any promo copy; `is_aigc=true` is hardcoded |
| 12 | Explicit user consent to post | Publish only runs on explicit `Publish now` / `Schedule` click; the server-side `publishNow` / `scheduleContent` procedures gate on the status machine |
| 13 | Tell user that processing can take a few minutes | After a successful TikTok publish the composer fires `publishToastTiktokProcessing` (`toast.info`, 8 s) |
| 14 | Poll `publish/status/fetch` and show status | `publish.getTiktokPostStatus` tRPC procedure proxies `/post/publish/status/fetch/`; Content model persists `tiktokPostStatus`, `tiktokPostStatusFetchedAt`, `tiktokPostId` for the calendar view |
| 15 | `is_aigc=true` label | Hardcoded in `tiktok.service.ts` — no opt-out |
| 16 | `PULL_FROM_URL` only from verified domain | Already handled: `publishVideo` falls back to chunked `FILE_UPLOAD` on `url_ownership_unverified` |
| 17 | `client_secret` kept confidential | Env-only (`TIKTOK_CLIENT_SECRET`), never bundled client-side. See the secrets-scan report in the PR body |

## Additional audit-risk mitigations (also addressed in this PR)

| Risk | Mitigation |
|---|---|
| NSFW content accidentally reaching TikTok via API caller / scheduled publish | Server-side block in `publisher.service.ts` (`content.contentMode === "NSFW"` → fail-closed) and in the router guard (`assertTikTokPublishRules`). NSFW is also hidden in the composer when TikTok is selected |
| Apify-based TikTok hashtag/trend scraping conflicts with TikTok Platform Terms | New `TIKTOK_TRENDS_ENABLED` env flag, default off. Instagram trends keep working so the Trends page is not empty. See `src/server/services/trends/providers/apify/env-config.ts` → `isTikTokTrendsScrapingEnabled()` |

## Feature flag quick reference

| Env var | Default | Purpose |
|---|---|---|
| `TIKTOK_AUDIT_APPROVED` | `false` | Server-side lock keeping `privacy_level` clamped to `SELF_ONLY`. Flip to `true` ONLY after audit approval |
| `TIKTOK_TRENDS_ENABLED` | `false` | Enables the Apify TikTok hashtag + video sub-fetches in the Trends feature. Leave off during audit |

## Demo video script (2–3 min, English captions)

Mirrors section 7 of `uploads/tiktok-audit-draft.md`:

1. **0:00** Sign in with a normal test end-user account on
   https://www.aurainfluenceai.com.
2. **0:15** Show a generated original AI video (SFW, labelled AI) in the
   library.
3. **0:30** Settings → Social → Connect TikTok → TikTok consent screen
   showing scopes `user.info.basic` and `video.publish` → redirect back
   → "TikTok connected" with the username.
4. **0:55** Open the video → Publish → tick TikTok. Show:
   - Creator avatar + "Posting to @…" header.
   - Editable title.
   - Privacy dropdown — placeholder "Pick who can see this post", then
     explicitly select one.
   - Allow comment / duet / stitch checkboxes, all off initially, then
     tick one.
   - Commercial disclosure toggle OFF → ON → pick "Your brand", show the
     prompt "Your video will be labeled 'Promotional content'".
   - The Music Usage Confirmation consent text with the live link.
   - The preview player in the confirmation dialog.
5. **1:50** Click Publish. Show the toast "may take a few minutes" and
   PROCESSING → PUBLISH_COMPLETE in the Content detail view.
6. **2:15** Open TikTok and show the post on the profile with the
   AI-generated label.
7. **2:30** Settings → Disconnect TikTok, tokens removed.

> While the app is unaudited, the demo account must be **private** and the
> post will land as SELF_ONLY (TikTok forces `privacy_level_options =
> ["SELF_ONLY"]` for unaudited apps, and Aura's server mirrors that).

## Verified test coverage

| Area | Test file |
|---|---|
| `publishVideo` — commercial toggles sent, branded + SELF_ONLY rejected, duration guard, forced disable_* | `src/server/services/__tests__/tiktok.service.test.ts` |
| `publisher.service` — NSFW TikTok block, composer fields forwarded | `src/server/services/__tests__/publisher.service.test.ts` |
| `TIKTOK_TRENDS_ENABLED` default off, parses `true`/`1`/… correctly | `src/server/services/__tests__/tiktok-trends-flag.test.ts` |

Run locally with `npm run test:run`.
