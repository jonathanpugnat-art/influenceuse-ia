import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { getDbUser } from "@/server/helpers/get-db-user";
import { uploadFile } from "@/server/services/storage.service";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB — ~1min of MP3 at 320kbps is plenty
const ALLOWED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
]);

/**
 * Voice-sample upload — talking-head V1.
 *
 * The character-sheet voice picker POSTs a multipart audio file here; we
 * upload it to R2 (or local fallback in dev), and return the public URL.
 * The client then calls `talkingHead.cloneVoice` with that URL so the
 * clone can be re-run from the audit page if needed.
 *
 * Auth: Clerk session (same protectedProcedure guard as tRPC). No user
 * without a Clerk cookie can POST here.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dbUser = await getDbUser(session.userId);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file manquant (form-data 'file')." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} Mo).` },
      { status: 413 }
    );
  }
  const contentType = (file.type || "audio/mpeg").split(";")[0]?.trim() ?? "audio/mpeg";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `Format non supporté : ${contentType}. Utilise MP3, WAV, M4A ou WebM.` },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = contentType.includes("wav")
    ? "wav"
    : contentType.includes("webm")
      ? "webm"
      : contentType.includes("ogg")
        ? "ogg"
        : contentType.includes("mp4") || contentType.includes("m4a")
          ? "m4a"
          : "mp3";
  const filename = `voice-sample-${dbUser.id}-${nanoid(8)}.${ext}`;

  const url = await uploadFile(buffer, filename, contentType);
  return NextResponse.json({ url, contentType, sizeBytes: buffer.byteLength });
}
