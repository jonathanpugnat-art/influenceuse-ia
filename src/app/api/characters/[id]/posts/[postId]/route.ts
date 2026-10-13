import { NextResponse } from "next/server";

import { getBlobStore } from "@/lib/blob";
import { detectVideoType, postKey, videoKey } from "@/lib/blob/keys";
import { getEnv } from "@/lib/env";
import { getOwnedPost } from "@/lib/repositories/db/posts";
import { requireUserId } from "@/lib/session";
import { getOwnedCharacter, readPost } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; postId: string }> };

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: Request, context: RouteContext) {
  const userId = await requireUserId();
  const { id, postId } = await context.params;
  const character = await getOwnedCharacter(id, userId);
  if (!character) {
    return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const slug = slugify(character.name) || "post";

  let mediaKind: "image" | "video" = "image";
  let contentType = "image/jpeg";
  let key: string | null = null;
  let buffer: Buffer | null = null;

  try {
    if (getEnv().METADATA_DRIVER === "db") {
      const post = await getOwnedPost(userId, id, postId);
      if (!post || post.status !== "succeeded") {
        return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
      }
      mediaKind = post.mediaKind;
      contentType = post.contentType;
      key =
        post.imageKey ??
        (mediaKind === "video" ? videoKey(userId, id, postId) : postKey(userId, id, postId));
    }
  } catch {
    // fall through to local disk
  }

  if (key) {
    const store = getBlobStore();
    if (getEnv().BLOB_DRIVER === "r2") {
      try {
        const fileName = `${slug}-${postId.slice(0, 8)}.${mediaKind === "video" ? "mp4" : "jpg"}`;
        const url = await store.presignGet(key, {
          expiresInSeconds: 300,
          downloadFileName: download ? fileName : undefined,
        });
        return NextResponse.redirect(url, 302);
      } catch {
        return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
      }
    }
    buffer = await store.get(key);
  }

  if (!buffer) {
    buffer = await readPost(id, postId);
    if (buffer && detectVideoType(buffer)) {
      contentType = "video/mp4";
      mediaKind = "video";
    } else {
      contentType = "image/jpeg";
      mediaKind = "image";
    }
  }

  if (!buffer) {
    return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
  }

  const fileName = `${slug}-${postId.slice(0, 8)}.${mediaKind === "video" ? "mp4" : "jpg"}`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      ...(download ? { "Content-Disposition": `attachment; filename="${fileName}"` } : {}),
    },
  });
}
