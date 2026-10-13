import { describe, expect, it } from "vitest";

import { faceKey, postKey, previewKey, sourceKey, uploadKey } from "@/lib/blob/keys";
import { getEnv, resetEnvCache } from "@/lib/env";
import { sanitizeProps } from "@/lib/observability/analytics";
import { scrubSentryEvent } from "@/lib/observability/sentry";
import { verifyReplicateWebhook } from "@/lib/replicate/webhook-signature";
import { createHmac } from "node:crypto";

describe("blob keys", () => {
  it("builds stable keys", () => {
    const user = "user_abc123";
    const character = "11111111-1111-4111-8111-111111111111";
    const post = "22222222-2222-4222-8222-222222222222";
    expect(faceKey(user, character, "image/jpeg")).toBe(
      `characters/${user}/${character}/face.jpg`,
    );
    expect(sourceKey(user, character, 0, "image/png")).toBe(
      `characters/${user}/${character}/sources/0.png`,
    );
    expect(postKey(user, character, post)).toBe(`posts/${user}/${character}/${post}.jpg`);
    expect(previewKey(user, post)).toBe(`previews/${user}/${post}.jpg`);
    expect(uploadKey(user, post, 0, "image/jpeg")).toBe(
      `uploads/${user}/${post}/0.jpg`,
    );
  });

  it("rejects traversal and bad ids", () => {
    expect(() => faceKey("../x", "11111111-1111-4111-8111-111111111111", "image/jpeg")).toThrow();
    expect(() => faceKey("user_abc", "not-a-uuid", "image/jpeg")).toThrow();
  });
});

describe("env", () => {
  it("rejects fs drivers in production", () => {
    resetEnvCache();
    expect(() =>
      getEnv({ NODE_ENV: "production", METADATA_DRIVER: "fs", BLOB_DRIVER: "fs" }),
    ).toThrow(/db\/r2/);
  });

  it("requires DATABASE_URL for db driver", () => {
    resetEnvCache();
    expect(() => getEnv({ METADATA_DRIVER: "db", NODE_ENV: "development" })).toThrow(/DATABASE_URL/);
  });
});

describe("replicate webhook signature", () => {
  it("accepts a valid signature", () => {
    const secret = "whsec_" + Buffer.from("test-secret").toString("base64");
    const id = "msg_1";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"id":"pred_1","status":"succeeded"}';
    const key = Buffer.from(secret.slice("whsec_".length), "base64");
    const signature = createHmac("sha256", key)
      .update(`${id}.${timestamp}.${body}`)
      .digest("base64");
    expect(
      verifyReplicateWebhook({
        body,
        secret,
        idHeader: id,
        timestampHeader: timestamp,
        signatureHeader: `v1,${signature}`,
      }),
    ).toBe(true);
  });

  it("rejects tampered body", () => {
    const secret = "whsec_" + Buffer.from("test-secret").toString("base64");
    expect(
      verifyReplicateWebhook({
        body: "{}",
        secret,
        idHeader: "msg_1",
        timestampHeader: String(Math.floor(Date.now() / 1000)),
        signatureHeader: "v1,deadbeef",
      }),
    ).toBe(false);
  });
});

describe("observability scrubbing", () => {
  it("drops prompts and signed urls from analytics props", () => {
    expect(
      sanitizeProps({
        prompt: "secret face",
        durationMs: 12,
        url: "https://r2.example/?X-Amz-Signature=abc",
      }),
    ).toEqual({ durationMs: 12 });
  });

  it("redacts sensitive sentry payloads", () => {
    const event = scrubSentryEvent({
      message: "data:image/jpeg;base64,AAAA and X-Amz-Signature=zzz",
    });
    expect(JSON.stringify(event)).not.toContain("AAAA");
    expect(JSON.stringify(event)).not.toContain("X-Amz-Signature=zzz");
  });
});
