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
export async function checkAndPublish(): Promise<{
  processed: number;
  published: number;
  failed: number;
}> {
  const now = new Date();
  let published = 0;
  let failed = 0;

  try {
    const dueContents = await db.content.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: now },
      },
      include: {
        influencer: {
          select: { id: true, name: true },
          include: {
            socialAccounts: {
              select: {
                id: true,
                platform: true,
                accessToken: true,
                refreshToken: true,
                platformUserId: true,
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
