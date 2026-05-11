import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

const mockDb = vi.hoisted(() => ({
  webhook: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  webhookDelivery: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
}));
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({ db: mockDb }));
// Replace global fetch with our spy.
globalThis.fetch = mockFetch as unknown as typeof fetch;

import {
  signPayload,
  generateWebhookSecret,
  emitEvent,
  retryFailedDeliveries,
} from "@/server/services/webhook.service";

describe("webhook.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.webhookDelivery.create.mockImplementation(async ({ data }: { data: object }) => ({
      id: "del_1",
      ...data,
    }));
    mockDb.webhookDelivery.update.mockImplementation(async ({ data }: { data: object }) => ({
      id: "del_1",
      ...data,
    }));
    mockDb.webhook.update.mockResolvedValue(undefined);
  });

  it("signs payloads with HMAC-SHA256 deterministically", () => {
    const sig = signPayload("secret", '{"foo":"bar"}');
    const expected = crypto
      .createHmac("sha256", "secret")
      .update('{"foo":"bar"}')
      .digest("hex");
    expect(sig).toBe(expected);
  });

  it("generates unique webhook secrets prefixed with whsec_", () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).toMatch(/^whsec_/);
    expect(a).not.toBe(b);
  });

  it("emitEvent skips when no active subscriptions match the event", async () => {
    mockDb.webhook.findMany.mockResolvedValue([]);
    await emitEvent("u1", "CONTENT_PUBLISHED", { foo: 1 });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockDb.webhookDelivery.create).not.toHaveBeenCalled();
  });

  it("emitEvent POSTs a signed JSON body to every matching subscription", async () => {
    mockDb.webhook.findMany.mockResolvedValue([
      { id: "w1", url: "https://hooks.example/1", secret: "s1" },
      { id: "w2", url: "https://hooks.example/2", secret: "s2" },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "ok",
    } as Response);

    await emitEvent("u1", "CONTENT_PUBLISHED", { contentId: "c1" });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [, init] = mockFetch.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers["x-webhook-event"]).toBe("CONTENT_PUBLISHED");
    expect(headers["x-webhook-signature"]).toMatch(/^sha256=/);
    expect(headers["x-webhook-delivery"]).toBeDefined();
    expect(JSON.parse(init.body as string)).toMatchObject({
      event: "CONTENT_PUBLISHED",
      data: { contentId: "c1" },
    });
  });

  it("emitEvent marks the delivery RETRYING on transient failure", async () => {
    mockDb.webhook.findMany.mockResolvedValue([
      { id: "w1", url: "https://hooks.example/1", secret: "s1" },
    ]);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "service unavailable",
    } as Response);

    await emitEvent("u1", "CONTENT_PUBLISHED", { contentId: "c1" });

    const updateCall = mockDb.webhookDelivery.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe("RETRYING");
    expect(updateCall.data.responseCode).toBe(503);
    expect(updateCall.data.nextRetryAt).toBeInstanceOf(Date);
  });

  it("retryFailedDeliveries processes due deliveries and counts outcomes", async () => {
    mockDb.webhookDelivery.findMany.mockResolvedValue([
      {
        id: "del_a",
        attempts: 1,
        payload: { event: "CONTENT_PUBLISHED", timestamp: "t", data: {} },
        webhook: {
          id: "w1",
          url: "https://hooks.example/1",
          secret: "s1",
          isActive: true,
        },
      },
      {
        id: "del_b",
        attempts: 2,
        payload: { event: "CONTENT_PUBLISHED", timestamp: "t", data: {} },
        webhook: {
          id: "w2",
          url: "https://hooks.example/2",
          secret: "s2",
          isActive: true,
        },
      },
    ]);
    // The retry path calls webhookDelivery.update; make the returned status
    // reflect what deliverOnce would persist for each call.
    let callCount = 0;
    mockDb.webhookDelivery.update.mockImplementation(async ({ data }: { data: object }) => {
      callCount++;
      return { id: callCount === 1 ? "del_a" : "del_b", ...data };
    });
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "ok" } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" } as Response);

    const r = await retryFailedDeliveries({ sliceSize: 5 });
    expect(r.retried).toBe(2);
    expect(r.succeeded).toBe(1);
    expect(r.stillFailing).toBe(1);
  });
});
