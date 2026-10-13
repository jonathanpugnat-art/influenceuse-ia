import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getBlobStore } from "@/lib/blob";
import { uploadKey } from "@/lib/blob/keys";
import { getEnv } from "@/lib/env";
import { requireUserId } from "@/lib/session";
import type { ImageContentType } from "@/lib/storage-ids";
import { MAX_CLONE_PHOTOS, MIN_CLONE_PHOTOS } from "@/lib/traits";

export const runtime = "nodejs";

const ALLOWED: readonly ImageContentType[] = ["image/jpeg", "image/png", "image/webp"];

function parseContentType(value: unknown): ImageContentType | null {
  if (typeof value !== "string") return null;
  return ALLOWED.includes(value as ImageContentType) ? (value as ImageContentType) : null;
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (getEnv().METADATA_DRIVER !== "db") {
    return NextResponse.json(
      { error: "Uploads directs réservés au mode cloud.", code: "driver_fs" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const contentTypes = Array.isArray(record.contentTypes) ? record.contentTypes : null;
  if (
    !contentTypes ||
    contentTypes.length < MIN_CLONE_PHOTOS ||
    contentTypes.length > MAX_CLONE_PHOTOS
  ) {
    return NextResponse.json(
      { error: `Il faut entre ${MIN_CLONE_PHOTOS} et ${MAX_CLONE_PHOTOS} photos.` },
      { status: 400 },
    );
  }

  const uploadId = randomUUID();
  const blob = getBlobStore();
  const uploads: { key: string; url: string; contentType: ImageContentType; index: number }[] =
    [];

  for (const [index, raw] of contentTypes.entries()) {
    const contentType = parseContentType(raw);
    if (!contentType) {
      return NextResponse.json(
        { error: "Formats acceptés : JPEG, PNG, WebP." },
        { status: 400 },
      );
    }
    const key = uploadKey(userId, uploadId, index, contentType);
    const url = await blob.presignPut(key, {
      contentType,
      expiresInSeconds: 900,
    });
    const resolvedUrl = url.startsWith("http")
      ? url
      : `/api/characters/uploads/put?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}`;
    uploads.push({ key, url: resolvedUrl, contentType, index });
  }

  return NextResponse.json({ uploadId, uploads });
}
