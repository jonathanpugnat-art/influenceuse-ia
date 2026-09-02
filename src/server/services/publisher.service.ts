/**
 * Service de publication unifié : dispatche vers Instagram, TikTok ou OnlyFans
 * selon les plateformes du contenu.
 */

import { db } from "@/server/db";
import { decrypt, encrypt } from "@/lib/encryption";
import * as instagram from "./instagram.service";
import * as tiktok from "./tiktok.service";
import * as onlyfans from "./onlyfans.service";
import { emitEvent } from "./webhook.service";

/** IG long-lived tokens last ~60 days; refresh when <7 days remain. */
const IG_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * If the Instagram account's long-lived token is about to expire, refresh it
 * and persist the new token (encrypted). Returns the (possibly fresh) token.
 * Best-effort: a refresh failure falls back to the existing token.
 */
async function ensureFreshIgToken(
  accountId: string,
  decryptedToken: string,
  expiresAt?: Date | null,
  oauthProvider?: string | null
): Promise<string> {
  if (!expiresAt) return decryptedToken;
  const remaining = expiresAt.getTime() - Date.now();
  if (remaining > IG_REFRESH_THRESHOLD_MS) return decryptedToken;
  try {
    const refreshed = await instagram.refreshToken(
      decryptedToken,
      oauthProvider === "instagram_login" || oauthProvider === "facebook_login"
        ? oauthProvider
        : null
    );
    await db.socialAccount.update({
      where: { id: accountId },
      data: {
        accessToken: encrypt(refreshed.accessToken),
        tokenExpiresAt: refreshed.expiresAt,
      },
    });
    console.log(`[publisher] Refreshed IG token for account ${accountId}`);
    return refreshed.accessToken;
  } catch (err) {
    console.warn(`[publisher] IG token refresh failed (${err}). Using existing token.`);
    return decryptedToken;
  }
}

type Platform = "INSTAGRAM" | "TIKTOK" | "ONLYFANS";
type PublishStatus = "PENDING" | "SUCCESS" | "FAILED";
type ContentType = "PHOTO" | "CAROUSEL" | "REEL" | "STORY";

type ContentWithInfluencer = {
  id: string;
  type: ContentType;
  caption: string | null;
  hashtags: string[];
  mediaUrls: string[];
  thumbnailUrl: string | null;
  scheduledAt: Date | null;
  platforms: Platform[];
  /** Social Publish V1 fields (all optional to stay backwards compatible). */
  firstComment?: string | null;
  shareToFeed?: boolean | null;
  tiktokPrivacyLevel?: string | null;
  influencer: {
    id: string;
    socialAccounts: Array<{
      id: string;
      platform: Platform;
      accessToken: string | null;
      refreshToken: string | null;
      platformUserId: string | null;
      tokenExpiresAt?: Date | null;
      oauthProvider?: string | null;
      isConnected: boolean;
    }>;
  };
};

export type PublishResultItem = {
  platform: Platform;
  status: PublishStatus;
  externalPostId?: string | null;
  error?: string | null;
  publishedAt?: Date | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Publie un contenu sur chaque plateforme demandée.
 * Crée les PublishResult en base et retourne les résultats.
 */
const DEFAULT_TRANSIENT_RE =
  /rate.?limit|timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|429|5\d\d/i;

function isDefaultTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return DEFAULT_TRANSIENT_RE.test(msg);
}

/**
 * Retry helper: re-runs `fn` up to `maxAttempts` times when `isTransient`
 * returns true. Permanent errors (token expired, spam risk, bad request…)
 * bubble up immediately so we don't waste retries.
 */
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts = 3,
  isTransient: (err: unknown) => boolean = isDefaultTransientError
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const transient = isTransient(err);
      if (!transient || attempt === maxAttempts) throw err;
      const wait = 1500 * attempt;
      console.warn(`[publisher] ${label} attempt ${attempt} failed (${msg}). Retrying in ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

const TIKTOK_TRANSIENT_CODES = new Set(["rate_limit_exceeded"]);
const TIKTOK_PERMANENT_CODES = new Set([
  "spam_risk_too_many_posts",
  "spam_risk_user_banned_from_posting",
  "reached_active_user_cap",
  "unaudited_client_can_only_post_to_private_accounts",
  "invalid_privacy_level",
  "url_ownership_unverified",
  "access_token_invalid",
  "access_token_expired",
]);

function isTikTokTransientError(err: unknown): boolean {
  const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
  if (code && TIKTOK_PERMANENT_CODES.has(code)) return false;
  if (code && TIKTOK_TRANSIENT_CODES.has(code)) return true;
  return isDefaultTransientError(err);
}

function normalizeTikTokPrivacy(
  value: string | null | undefined
): "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY" {
  switch (value) {
    case "PUBLIC_TO_EVERYONE":
    case "MUTUAL_FOLLOW_FRIENDS":
    case "FOLLOWER_OF_CREATOR":
    case "SELF_ONLY":
      return value;
    default:
      return "SELF_ONLY";
  }
}

export async function publishContent(content: ContentWithInfluencer): Promise<PublishResultItem[]> {
  const results: PublishResultItem[] = [];
  const caption = content.caption ?? "";
  const textWithHashtags = content.hashtags?.length
    ? `${caption}\n\n${content.hashtags.join(" ")}`
    : caption;

  // Idempotency: skip platforms that already have a SUCCESS PublishResult for
  // this content. Protects against double-runs of the cron, manual retries, or
  // a user clicking "Publish now" while the scheduler is already on it.
  const existingResults = await db.publishResult.findMany({
    where: { contentId: content.id, status: "SUCCESS" },
    select: { platform: true, externalPostId: true, publishedAt: true },
  });
  const alreadyPublished = new Set(existingResults.map((r) => r.platform));
  for (const r of existingResults) {
    if (content.platforms.includes(r.platform as Platform)) {
      results.push({
        platform: r.platform as Platform,
        status: "SUCCESS",
        externalPostId: r.externalPostId,
        publishedAt: r.publishedAt,
      });
    }
  }

  for (const platform of content.platforms) {
    if (alreadyPublished.has(platform)) continue;
    try {
      const account = content.influencer.socialAccounts.find(
        (a) => a.platform === platform && a.isConnected
      );

      if (!account?.accessToken) {
        results.push({
          platform,
          status: "FAILED",
          error: "Compte non connecté ou token manquant.",
        });
        continue;
      }

      let accessToken = decrypt(account.accessToken);
      const igUserId = account.platformUserId ?? undefined;

      switch (platform) {
        case "INSTAGRAM": {
          accessToken = await ensureFreshIgToken(
            account.id,
            accessToken,
            account.tokenExpiresAt,
            account.oauthProvider
          );
          if (!igUserId) {
            results.push({
              platform,
              status: "FAILED",
              error: "ID Instagram manquant. Reconnectez le compte.",
            });
            break;
          }
          if (content.type === "PHOTO" && content.mediaUrls[0]) {
            const { mediaId } = await withRetry("instagram.publishPhoto", () =>
              instagram.publishPhoto(
                accessToken,
                igUserId,
                content.mediaUrls[0],
                textWithHashtags
              )
            );
            results.push({
              platform,
              status: "SUCCESS",
              externalPostId: mediaId,
              publishedAt: new Date(),
            });
          } else if (content.type === "CAROUSEL" && content.mediaUrls.length) {
            const { mediaId } = await withRetry("instagram.publishCarousel", () =>
              instagram.publishCarousel(
                accessToken,
                igUserId,
                content.mediaUrls,
                textWithHashtags
              )
            );
            results.push({
              platform,
              status: "SUCCESS",
              externalPostId: mediaId,
              publishedAt: new Date(),
            });
          } else if (content.type === "REEL" && content.mediaUrls[0]) {
            const { mediaId } = await withRetry("instagram.publishReel", () =>
              instagram.publishReel(
                accessToken,
                igUserId,
                content.mediaUrls[0],
                textWithHashtags,
                {
                  thumbnailUrl: content.thumbnailUrl ?? undefined,
                  // Default true when not explicitly set to false.
                  shareToFeed: content.shareToFeed !== false,
                }
              )
            );
            // First comment is best-effort: a missing scope or a private
            // account must NOT flip the whole publish to FAILED — Meta
            // already accepted the reel. Log and move on.
            const firstComment = content.firstComment?.trim();
            if (firstComment) {
              try {
                await instagram.postComment(accessToken, mediaId, firstComment);
              } catch (commentErr) {
                console.warn(
                  `[publisher] IG first comment failed for media ${mediaId}: ${
                    commentErr instanceof Error ? commentErr.message : String(commentErr)
                  }`
                );
              }
            }
            results.push({
              platform,
              status: "SUCCESS",
              externalPostId: mediaId,
              publishedAt: new Date(),
              metadata: { ig_media_id: mediaId },
            });
          } else {
            results.push({
              platform,
              status: "FAILED",
              error: "Type de contenu ou médias non supportés pour Instagram.",
            });
          }
          break;
        }

        case "TIKTOK": {
          if (content.type !== "REEL") {
            results.push({
              platform,
              status: "FAILED",
              error: "TikTok n'accepte que les vidéos (reels).",
            });
            break;
          }
          const videoUrl = content.mediaUrls[0];
          if (!videoUrl) {
            results.push({
              platform,
              status: "FAILED",
              error: "Aucune vidéo pour TikTok.",
            });
            break;
          }
          // Sanitize the requested privacy level. Un-audited apps get
          // clamped to SELF_ONLY server-side inside `publishVideo`, but we
          // also default to SELF_ONLY when the client omitted it.
          const requestedPrivacy = normalizeTikTokPrivacy(content.tiktokPrivacyLevel);
          // Retry ONLY on transient errors (rate-limit / 5xx). Spam / banned
          // / privacy-invalid must surface immediately as visible failures.
          const result = await withRetry(
            "tiktok.publishVideo",
            () =>
              tiktok.publishVideo(accessToken, videoUrl, textWithHashtags, {
                privacyLevel: requestedPrivacy,
              }),
            3,
            isTikTokTransientError
          );
          results.push({
            platform,
            status: "SUCCESS",
            externalPostId: result.publishId,
            publishedAt: new Date(),
            metadata: {
              tiktok_publish_id: result.publishId,
              tiktok_privacy_level: result.privacyLevel,
              tiktok_source: result.source,
            },
          });
          break;
        }

        case "ONLYFANS": {
          const downloadUrl = await onlyfans.prepareBundle({
            id: content.id,
            type: content.type,
            caption: content.caption,
            hashtags: content.hashtags ?? [],
            mediaUrls: content.mediaUrls,
            thumbnailUrl: content.thumbnailUrl,
            scheduledAt: content.scheduledAt,
          });
          results.push({
            platform,
            status: "SUCCESS",
            publishedAt: new Date(),
            metadata: { onlyfans_download_url: downloadUrl },
          });
          break;
        }

        default:
          results.push({
            platform,
            status: "FAILED",
            error: `Plateforme ${platform} non gérée.`,
          });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        platform,
        status: "FAILED",
        error: message,
      });
    }
  }

  return results;
}

/**
 * Persiste les résultats en base et met à jour le statut du contenu.
 * À appeler après publishContent. Émet aussi les webhooks `content.published`
 * ou `content.failed` (Phase 5).
 *
 * Idempotent: on saute la persistance d'un PublishResult SUCCESS déjà existant
 * pour la même (contentId, platform) afin d'éviter les doublons en cas de
 * double-tick du cron.
 */
export async function savePublishResults(
  contentId: string,
  results: PublishResultItem[]
): Promise<void> {
  const anySuccess = results.some((r) => r.status === "SUCCESS");
  const allSuccess = results.every((r) => r.status === "SUCCESS");

  for (const r of results) {
    if (r.status === "SUCCESS") {
      const existing = await db.publishResult.findFirst({
        where: { contentId, platform: r.platform, status: "SUCCESS" },
        select: { id: true },
      });
      if (existing) continue;
    }
    await db.publishResult.create({
      data: {
        contentId,
        platform: r.platform,
        status: r.status,
        externalPostId: r.externalPostId ?? undefined,
        error: r.error ?? undefined,
        publishedAt: r.publishedAt ?? undefined,
        metadata: r.metadata ? JSON.parse(JSON.stringify(r.metadata)) : undefined,
      },
    });
  }

  // Mirror the platform external ids on Content so PublishJob-style queries
  // (task spec) don't need to join PublishResult. IG media id + TikTok
  // publish_id are the only two the API returns synchronously.
  const igSuccess = results.find(
    (r) => r.status === "SUCCESS" && r.platform === "INSTAGRAM"
  );
  const ttSuccess = results.find(
    (r) => r.status === "SUCCESS" && r.platform === "TIKTOK"
  );
  const igMediaId = igSuccess?.externalPostId ?? undefined;
  const tiktokPublishId = ttSuccess?.externalPostId ?? undefined;

  const updated = await db.content.update({
    where: { id: contentId },
    data: {
      status: allSuccess ? "PUBLISHED" : anySuccess ? "PUBLISHED" : "FAILED",
      publishedAt: anySuccess ? new Date() : undefined,
      scheduledAt: null,
      ...(igMediaId ? { igMediaId } : {}),
      ...(tiktokPublishId ? { tiktokPublishId } : {}),
    },
    select: {
      id: true,
      type: true,
      caption: true,
      hashtags: true,
      mediaUrls: true,
      thumbnailUrl: true,
      platforms: true,
      publishedAt: true,
      influencer: { select: { id: true, name: true, userId: true } },
    },
  });

  const successPlatforms = results
    .filter((r) => r.status === "SUCCESS")
    .map((r) => ({ platform: r.platform, externalPostId: r.externalPostId ?? null }));
  const failures = results
    .filter((r) => r.status === "FAILED")
    .map((r) => ({ platform: r.platform, error: r.error ?? null }));

  const userId = updated.influencer.userId;

  if (anySuccess) {
    await emitEvent(userId, "CONTENT_PUBLISHED", {
      contentId: updated.id,
      type: updated.type,
      caption: updated.caption,
      hashtags: updated.hashtags,
      mediaUrls: updated.mediaUrls,
      thumbnailUrl: updated.thumbnailUrl,
      publishedAt: updated.publishedAt,
      influencer: { id: updated.influencer.id, name: updated.influencer.name },
      platforms: successPlatforms,
      failures: failures.length ? failures : undefined,
    });
  }
  if (!anySuccess && failures.length > 0) {
    await emitEvent(userId, "CONTENT_FAILED", {
      contentId: updated.id,
      type: updated.type,
      influencer: { id: updated.influencer.id, name: updated.influencer.name },
      failures,
    });
  }
}
