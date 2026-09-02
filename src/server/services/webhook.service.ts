import crypto from "node:crypto";
import { db } from "@/server/db";
import type { WebhookEvent } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Outbound webhook service (Phase 5)
//
// Listens to internal events (CONTENT_PUBLISHED, CONTENT_FAILED, BATCH_COMPLETED,
// CONTENT_SCHEDULED) and POSTs a signed JSON payload to every active webhook
// registered for that event by the owning user.
//
// Each delivery is persisted as a WebhookDelivery row so the user can inspect
// failures from the UI, and so a cron job can retry transient failures with
// exponential backoff.
// ──────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000, 6 * 3_600_000];
const REQUEST_TIMEOUT_MS = 10_000;

export interface WebhookEventPayload {
  event: WebhookEvent;
  /** ISO 8601 timestamp at which the event was emitted. */
  timestamp: string;
  /** Stable identifier for this delivery (added later, see signAndSend). */
  deliveryId?: string;
  /** Arbitrary event-specific data, JSON-serializable. */
  data: Record<string, unknown>;
}

/**
 * HMAC-SHA256 signature of the raw JSON body using the webhook's shared secret.
 * Receivers should recompute this and compare in constant time.
 */
export function signPayload(secret: string, rawBody: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

/**
 * Generate a strong shared secret used to HMAC-sign payloads sent to this
 * webhook. Returned to the user only on creation.
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("base64url")}`;
}

interface DeliverInput {
  webhookId: string;
  url: string;
  secret: string;
  payload: WebhookEventPayload;
  attempt?: number;
}

/**
 * Single HTTP attempt — does not retry on its own.
 * Returns the persisted delivery row.
 */
async function deliverOnce(input: DeliverInput) {
  const attempt = (input.attempt ?? 0) + 1;
  const rawBody = JSON.stringify(input.payload);
  const signature = signPayload(input.secret, rawBody);

  const startedAt = Date.now();
  let responseCode: number | null = null;
  let responseBody: string | null = null;
  let errorMsg: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const resp = await fetch(input.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "InfluenceuseIA-Webhooks/1.0",
        "x-webhook-event": input.payload.event,
        "x-webhook-signature": `sha256=${signature}`,
        "x-webhook-delivery": input.payload.deliveryId ?? "",
        "x-webhook-attempt": String(attempt),
      },
      body: rawBody,
      signal: controller.signal,
    });
    clearTimeout(timer);
    responseCode = resp.status;
    try {
      responseBody = (await resp.text()).slice(0, 4_000);
    } catch {
      responseBody = null;
    }
    if (!resp.ok) {
      errorMsg = `HTTP ${resp.status}`;
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  const ok = responseCode !== null && responseCode >= 200 && responseCode < 300;
  const willRetry = !ok && attempt < MAX_ATTEMPTS;

  const updated = await db.webhookDelivery.update({
    where: { id: input.payload.deliveryId! },
    data: {
      attempts: attempt,
      status: ok ? "SUCCESS" : willRetry ? "RETRYING" : "FAILED",
      responseCode: responseCode ?? undefined,
      responseBody: responseBody ?? undefined,
      error: errorMsg ?? undefined,
      deliveredAt: ok ? new Date() : undefined,
      nextRetryAt: willRetry
        ? new Date(Date.now() + BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)])
        : null,
    },
  });

  if (ok) {
    await db.webhook.update({
      where: { id: input.webhookId },
      data: { lastSuccessAt: new Date(), failureCount: 0 },
    });
  } else if (!willRetry) {
    await db.webhook.update({
      where: { id: input.webhookId },
      data: { lastFailedAt: new Date(), failureCount: { increment: 1 } },
    });
  }

  console.log(
    `[webhook] ${input.payload.event} → ${input.url} attempt=${attempt} status=${updated.status} code=${responseCode ?? "n/a"} (${Date.now() - startedAt}ms)`
  );

  return updated;
}

/**
 * Public emit API — call this from anywhere in the codebase to fan out an
 * event to every active webhook the user has registered for it. Best-effort:
 * never throws, never blocks the caller's path.
 */
export async function emitEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const subscriptions = await db.webhook.findMany({
      where: {
        userId,
        isActive: true,
        events: { has: event },
      },
      select: { id: true, url: true, secret: true },
    });

    if (subscriptions.length === 0) return;

    const basePayload: Omit<WebhookEventPayload, "deliveryId"> = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    await Promise.all(
      subscriptions.map(async (sub) => {
        const delivery = await db.webhookDelivery.create({
          data: {
            webhookId: sub.id,
            event,
            payload: basePayload as object,
            status: "PENDING",
          },
        });
        await deliverOnce({
          webhookId: sub.id,
          url: sub.url,
          secret: sub.secret,
          payload: { ...basePayload, deliveryId: delivery.id },
        });
      })
    );
  } catch (err) {
    console.error("[webhook] emitEvent error:", err);
  }
}

export interface RetryResult {
  retried: number;
  succeeded: number;
  stillFailing: number;
}

/**
 * Drains the retry queue: picks RETRYING deliveries whose nextRetryAt <= now
 * and re-attempts them. Called by /api/cron/retry-webhooks every minute.
 */
export async function retryFailedDeliveries(opts?: {
  sliceSize?: number;
}): Promise<RetryResult> {
  const sliceSize = opts?.sliceSize ?? 20;
  const now = new Date();

  const due = await db.webhookDelivery.findMany({
    where: {
      status: "RETRYING",
      nextRetryAt: { lte: now },
    },
    orderBy: { nextRetryAt: "asc" },
    take: sliceSize,
    include: {
      webhook: { select: { id: true, url: true, secret: true, isActive: true } },
    },
  });

  if (due.length === 0) {
    return { retried: 0, succeeded: 0, stillFailing: 0 };
  }

  let succeeded = 0;
  let stillFailing = 0;

  for (const d of due) {
    if (!d.webhook.isActive) {
      await db.webhookDelivery.update({
        where: { id: d.id },
        data: { status: "FAILED", nextRetryAt: null, error: "Webhook deactivated" },
      });
      stillFailing++;
      continue;
    }

    const payload = (d.payload ?? {}) as unknown as WebhookEventPayload;
    payload.deliveryId = d.id;

    const updated = await deliverOnce({
      webhookId: d.webhook.id,
      url: d.webhook.url,
      secret: d.webhook.secret,
      payload,
      attempt: d.attempts,
    });
    if (updated.status === "SUCCESS") succeeded++;
    else stillFailing++;
  }

  return { retried: due.length, succeeded, stillFailing };
}

/**
 * Manual test ping — sends a synthetic event to a webhook so the user can
 * verify their integration works before going live.
 */
export async function pingWebhook(webhookId: string): Promise<{
  status: string;
  responseCode: number | null;
}> {
  const wh = await db.webhook.findUnique({ where: { id: webhookId } });
  if (!wh) throw new Error("Webhook not found");

  const basePayload: Omit<WebhookEventPayload, "deliveryId"> = {
    event: "CONTENT_PUBLISHED",
    timestamp: new Date().toISOString(),
    data: {
      test: true,
      message: "This is a test ping from Aura Influences.",
    },
  };
  const delivery = await db.webhookDelivery.create({
    data: {
      webhookId: wh.id,
      event: "CONTENT_PUBLISHED",
      payload: basePayload as object,
      status: "PENDING",
    },
  });
  const updated = await deliverOnce({
    webhookId: wh.id,
    url: wh.url,
    secret: wh.secret,
    payload: { ...basePayload, deliveryId: delivery.id },
  });
  return { status: updated.status, responseCode: updated.responseCode };
}
