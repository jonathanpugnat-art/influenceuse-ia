import { NextRequest, NextResponse } from "next/server";
import { retryFailedDeliveries } from "@/server/services/webhook.service";

// Up to 20 deliveries × 10s HTTP timeout worst case.
export const maxDuration = 60;

/**
 * Cron endpoint — re-attempts WebhookDelivery rows whose status is RETRYING
 * and whose nextRetryAt has elapsed. Runs every minute.
 *
 * Protected by: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim() === "") {
    console.error("[cron/retry-webhooks] CRON_SECRET is not set");
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await retryFailedDeliveries();
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/retry-webhooks] Error:", error);
    return NextResponse.json(
      { error: "Webhook retry failed", details: String(error) },
      { status: 500 }
    );
  }
}
