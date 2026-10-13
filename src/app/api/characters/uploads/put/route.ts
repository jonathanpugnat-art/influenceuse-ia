import { NextResponse } from "next/server";

import { getBlobStore } from "@/lib/blob";
import { requireUserId } from "@/lib/session";
import { detectImageType } from "@/lib/storage-ids";
import { MAX_PHOTO_BYTES } from "@/lib/traits";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  const userId = await requireUserId();
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const contentTypeParam = url.searchParams.get("contentType") ?? "";

  if (!key.startsWith(`uploads/${userId}/`) || key.includes("..")) {
    return NextResponse.json({ error: "Clé invalide." }, { status: 400 });
  }

  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Chaque photo doit faire moins de 4 Mo." }, { status: 400 });
  }

  const detected = detectImageType(buffer);
  if (!detected || detected !== contentTypeParam) {
    return NextResponse.json({ error: "Formats acceptés : JPEG, PNG, WebP." }, { status: 400 });
  }

  await getBlobStore().put({ key, body: buffer, contentType: detected });
  return NextResponse.json({ ok: true });
}
