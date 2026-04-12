/**
 * Service de publication unifié : dispatche vers Instagram, TikTok ou OnlyFans
 * selon les plateformes du contenu.
 */

import { db } from "@/server/db";
import { decrypt } from "@/lib/encryption";
import * as instagram from "./instagram.service";
import * as tiktok from "./tiktok.service";
import * as onlyfans from "./onlyfans.service";

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
  influencer: {
    id: string;
    socialAccounts: Array<{
      id: string;
      platform: Platform;
      accessToken: string | null;
      refreshToken: string | null;
      platformUserId: string | null;
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
export async function publishContent(content: ContentWithInfluencer): Promise<PublishResultItem[]> {
  const results: PublishResultItem[] = [];
  const caption = content.caption ?? "";
  const textWithHashtags = content.hashtags?.length
    ? `${caption}\n\n${content.hashtags.join(" ")}`
    : caption;

  for (const platform of content.platforms) {
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

      const accessToken = decrypt(account.accessToken);
      const igUserId = account.platformUserId ?? undefined;

      switch (platform) {
        case "INSTAGRAM": {
          if (!igUserId) {
            results.push({
              platform,
              status: "FAILED",
              error: "ID Instagram manquant. Reconnectez le compte.",
            });
            break;
          }
          if (content.type === "PHOTO" && content.mediaUrls[0]) {
            const { mediaId } = await instagram.publishPhoto(
              accessToken,
              igUserId,
              content.mediaUrls[0],
              textWithHashtags
            );
            results.push({
              platform,
              status: "SUCCESS",
              externalPostId: mediaId,
              publishedAt: new Date(),
            });
          } else if (content.type === "CAROUSEL" && content.mediaUrls.length) {
            const { mediaId } = await instagram.publishCarousel(
              accessToken,
              igUserId,
              content.mediaUrls,
              textWithHashtags
            );
            results.push({
              platform,
              status: "SUCCESS",
              externalPostId: mediaId,
              publishedAt: new Date(),
            });
          } else if (content.type === "REEL" && content.mediaUrls[0]) {
            const { mediaId } = await instagram.publishReel(
              accessToken,
              igUserId,
              content.mediaUrls[0],
              textWithHashtags,
              content.thumbnailUrl ?? undefined
            );
            results.push({
              platform,
              status: "SUCCESS",
              externalPostId: mediaId,
              publishedAt: new Date(),
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
          const videoUrl = content.mediaUrls[0];
          if (!videoUrl) {
            results.push({
              platform,
              status: "FAILED",
              error: "Aucune vidéo pour TikTok.",
            });
            break;
          }
          const { publishId } = await tiktok.publishVideo(
            accessToken,
            videoUrl,
            textWithHashtags
          );
          results.push({
            platform,
            status: "SUCCESS",
            externalPostId: publishId,
            publishedAt: new Date(),
            metadata: { tiktok_publish_id: publishId },
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
 * À appeler après publishContent.
 */
export async function savePublishResults(
  contentId: string,
  results: PublishResultItem[]
): Promise<void> {
  const allSuccess = results.every((r) => r.status === "SUCCESS");
  const anySuccess = results.some((r) => r.status === "SUCCESS");

  for (const r of results) {
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

  await db.content.update({
    where: { id: contentId },
    data: {
      status: allSuccess ? "PUBLISHED" : anySuccess ? "PUBLISHED" : "FAILED",
      publishedAt: anySuccess ? new Date() : undefined,
      scheduledAt: null,
    },
  });
}
