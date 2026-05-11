// ──────────────────────────────────────────────
// API Key service (Sprint 9 — Public API)
//
// Generates, hashes, validates, and rate-limits public API keys used by
// external integrations (Zapier, custom scripts, agency dashboards…).
//
// Storage strategy:
//  - We NEVER store the plain key. Only a SHA-256 hash + a public prefix.
//  - The user sees the full key once at creation, then only the prefix in
//    the dashboard.
//  - Rate limiting uses a rolling 60s window; counters reset lazily on each
//    `validateAndConsume` call when the window expired.
// ──────────────────────────────────────────────

import { createHash, randomBytes } from "crypto";
import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";
import type { ApiKeyScope } from "@/generated/prisma/client";

const KEY_PREFIX_BYTES = 6;
const KEY_RANDOM_BYTES = 32;
const KEY_PUBLIC_PREFIX = "iia_live_";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_WINDOW = 60;

export function hashApiKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

/** Generates a fresh `iia_live_<6chars>_<32rand>` key. */
export function generateRawKey(): { plain: string; prefix: string } {
  const prefixSuffix = randomBytes(KEY_PREFIX_BYTES).toString("hex").slice(0, 8);
  const random = randomBytes(KEY_RANDOM_BYTES).toString("base64url");
  const prefix = `${KEY_PUBLIC_PREFIX}${prefixSuffix}`;
  const plain = `${prefix}.${random}`;
  return { plain, prefix };
}

export interface CreateKeyInput {
  userId: string;
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: Date | null;
}

/**
 * Creates an API key. Returns the **plain text** key once — the caller
 * MUST surface it to the user immediately and never store it server-side.
 */
export async function createApiKey(input: CreateKeyInput) {
  const { plain, prefix } = generateRawKey();
  const hashedKey = hashApiKey(plain);

  const apiKey = await db.apiKey.create({
    data: {
      userId: input.userId,
      name: input.name,
      prefix,
      hashedKey,
      scopes: input.scopes.length ? input.scopes : ["READ"],
      expiresAt: input.expiresAt ?? null,
    },
    select: {
      id: true,
      prefix: true,
      name: true,
      scopes: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  return { ...apiKey, plainKey: plain };
}

/**
 * Validates an incoming `Authorization: Bearer <key>` and consumes 1 unit
 * from its rate-limit budget. Throws on missing/invalid/exceeded keys.
 *
 * Returns the userId + scopes the caller is authorized for so the
 * downstream handler can scope its DB queries.
 */
export async function validateAndConsume(authHeader: string | null): Promise<{
  userId: string;
  scopes: ApiKeyScope[];
}> {
  const token = (authHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token || !token.startsWith(KEY_PUBLIC_PREFIX)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing or malformed API key" });
  }

  const hashed = hashApiKey(token);
  const key = await db.apiKey.findUnique({
    where: { hashedKey: hashed },
  });

  if (!key || !key.isActive) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid API key" });
  }
  if (key.expiresAt && key.expiresAt < new Date()) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "API key expired" });
  }

  // Rolling window rate limit.
  const now = new Date();
  const windowAge = now.getTime() - key.windowStartedAt.getTime();
  const startNewWindow = windowAge >= RATE_LIMIT_WINDOW_MS;
  const newCount = startNewWindow ? 1 : key.requestsThisWindow + 1;

  if (newCount > RATE_LIMIT_PER_WINDOW) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded (${RATE_LIMIT_PER_WINDOW}/min)`,
    });
  }

  await db.apiKey.update({
    where: { id: key.id },
    data: {
      lastUsedAt: now,
      requestsThisWindow: newCount,
      windowStartedAt: startNewWindow ? now : key.windowStartedAt,
    },
  });

  return { userId: key.userId, scopes: key.scopes };
}

export async function listApiKeys(userId: string) {
  return db.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      isActive: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeApiKey(userId: string, keyId: string) {
  const key = await db.apiKey.findUnique({ where: { id: keyId } });
  if (!key || key.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Key not found" });
  }
  await db.apiKey.update({
    where: { id: keyId },
    data: { isActive: false },
  });
  return { ok: true as const };
}

/**
 * Hard-delete the key. Useful when the user wants the row gone (audit
 * trail still survives because we keep request logs in the future).
 */
export async function deleteApiKey(userId: string, keyId: string) {
  const key = await db.apiKey.findUnique({ where: { id: keyId } });
  if (!key || key.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Key not found" });
  }
  await db.apiKey.delete({ where: { id: keyId } });
  return { ok: true as const };
}
