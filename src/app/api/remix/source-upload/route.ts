import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { uploadFile } from "@/server/services/storage.service";
import {
  REMIX_ALLOWED_MIME_TYPES,
  REMIX_MAX_SOURCE_BYTES,
} from "@/lib/remix-config";

// Kling accepts up to 200 MB clips; we keep the same cap here. The Vercel
// serverless body budget (default 4.5 MB) is bypassed automatically for
// multipart uploads through App Router when the FE goes through us, but
// staying below the 30s function limit is only realistic for small clips —
// the FE UI enforces the 15s / 200 MB max BEFORE calling us so a 200 MB
// upload is theoretical.
export const maxDuration = 60;

/**
 * POST /api/remix/source-upload
 *
 * Multipart body with a single `file` field. We validate mime type and
 * size, then push the raw bytes to R2 and return the public URL used as
 * `video_url` in the Kling payload.
 *
 * V1 does NOT accept URLs (no TikTok/IG scraping). The `url` field in
 * the UI is oEmbed preview only.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    return NextResponse.json(
      { error: "Multipart body required", detail: String(err).slice(0, 120) },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const mime = (file.type || "").toLowerCase();
  if (!REMIX_ALLOWED_MIME_TYPES.some((m) => mime.startsWith(m))) {
    return NextResponse.json(
      {
        error: "Unsupported source format. Use MP4 or MOV.",
        mime,
      },
      { status: 415 }
    );
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > REMIX_MAX_SOURCE_BYTES) {
    return NextResponse.json(
      {
        error: `Source exceeds ${Math.floor(
          REMIX_MAX_SOURCE_BYTES / 1024 / 1024
        )} MB.`,
      },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = `remix-src-${userId.slice(0, 8)}-${nanoid(6)}.${mime.includes("quicktime") ? "mov" : "mp4"}`;

  try {
    const url = await uploadFile(buffer, safeName, mime);
    return NextResponse.json({
      ok: true,
      url,
      sizeBytes: file.size,
      mime,
    });
  } catch (err) {
    console.error("[remix/source-upload] upload failed:", err);
    return NextResponse.json(
      {
        error: "Storage upload failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
