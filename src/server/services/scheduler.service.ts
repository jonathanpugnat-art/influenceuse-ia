import { db } from "@/server/db";
import { publishContent, savePublishResults } from "./publisher.service";

// ──────────────────────────────────────────────
// Scheduler Service (simplified — no BullMQ yet)
// Called by cron job every minute via /api/cron/publish
// ──────────────────────────────────────────────

/**
 * Check for contents with SCHEDULED status where scheduledAt <= now,
 * and publish them via the unified publisher service.
 */
/**
 * A publish claim that never completed (function killed mid-publish) leaves
 * the content GENERATING with its media intact. Put it back to SCHEDULED
 * after this delay so the next tick retries — publishContent skips platforms
 * that already have a SUCCESS PublishResult, so a half-published post won't
 * double-post.
 */
const STUCK_PUBLISHING_MS = 15 * 60 * 1000;

async function reclaimStuckPublishing(now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - STUCK_PUBLISHING_MS);
  const { count } = await db.content.updateMany({
    where: {
      status: "GENERATING",
      scheduledAt: { not: null, lte: now },
      mediaUrls: { isEmpty: false },
      updatedAt: { lt: cutoff },
    },
    data: { status: "SCHEDULED" },
  });
  if (count > 0) {
    console.warn(`[scheduler] Reclaimed ${count} stuck publish claim(s) → SCHEDULED`);
  }
}

export async function checkAndPublish(): Promise<{
  processed: number;
  published: number;
  failed: number;
}> {
  const now = new Date();
  let published = 0;
  let failed = 0;

  try {
    await reclaimStuckPublishing(now);

    const dueContents = await db.content.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: now },
      },
      include: {
        influencer: {
          select: {
            id: true,
            name: true,
            socialAccounts: {
              select: {
                id: true,
                platform: true,
                accessToken: true,
                refreshToken: true,
                platformUserId: true,
                tokenExpiresAt: true,
                oauthProvider: true,
                isConnected: true,
              },
            },
          },
        },
      },
    });

    if (dueContents.length === 0) {
      return { processed: 0, published: 0, failed: 0 };
    }

    console.log(`[scheduler] Found ${dueContents.length} content(s) to publish`);

    for (const content of dueContents) {
      // Atomic claim SCHEDULED → GENERATING (transient, reverted on save):
      // guarantees a single tick publishes this content even if the cron
      // overlaps with itself or with a manual "Publish now".
      const claimed = await db.content.updateMany({
        where: { id: content.id, status: "SCHEDULED" },
        data: { status: "GENERATING" },
      });
      if (claimed.count === 0) continue;

      try {
        const results = await publishContent(content);
        await savePublishResults(content.id, results);

        const successCount = results.filter((r) => r.status === "SUCCESS").length;
        if (successCount > 0) {
          published++;
          console.log(
            `[scheduler] Published "${content.influencer.name}" content ${content.id} (${successCount}/${results.length} platforms)`
          );
        }
        if (results.every((r) => r.status === "FAILED")) {
          failed++;
          console.error(`[scheduler] All platforms failed for content ${content.id}`);
        }
      } catch (error) {
        console.error(`[scheduler] Failed to publish content ${content.id}:`, error);
        await savePublishResults(content.id, [
          ...content.platforms.map((platform) => ({
            platform,
            status: "FAILED" as const,
            error: error instanceof Error ? error.message : String(error),
          })),
        ]);
        failed++;
      }
    }

    console.log(
      `[scheduler] Done: ${published} published, ${failed} failed out of ${dueContents.length}`
    );

    return { processed: dueContents.length, published, failed };
  } catch (error) {
    console.error("[scheduler] checkAndPublish error:", error);
    throw error;
  }
}
