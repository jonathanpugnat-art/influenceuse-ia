import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies Replicate webhook signatures (Standard Webhooks style).
 * https://www.standardwebhooks.com/
 */
export function verifyReplicateWebhook(input: {
  body: string;
  signatureHeader: string | null;
  idHeader: string | null;
  timestampHeader: string | null;
  secret: string;
  nowMs?: number;
}): boolean {
  const { body, signatureHeader, idHeader, timestampHeader, secret } = input;
  if (!signatureHeader || !idHeader || !timestampHeader) return false;

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;
  const now = input.nowMs ?? Date.now();
  if (Math.abs(now / 1000 - timestamp) > 300) return false;

  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");

  const signedContent = `${idHeader}.${timestampHeader}.${body}`;
  const expected = createHmac("sha256", key).update(signedContent).digest("base64");

  const candidates = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.includes(",") ? part.split(",")[1] : part));

  const expectedBuf = Buffer.from(expected);
  return candidates.some((candidate) => {
    const got = Buffer.from(candidate);
    return got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf);
  });
}
