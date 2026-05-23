import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  filenameFromMediaUrl,
  isAllowedMediaDownloadUrl,
} from "@/lib/media-url-allowlist";

/**
 * GET /api/media/download?url=<encoded>
 * Proxies allowed media URLs with Content-Disposition: attachment.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let mediaUrl: string;
  try {
    mediaUrl = decodeURIComponent(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!isAllowedMediaDownloadUrl(mediaUrl)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  const upstream = await fetch(mediaUrl, { cache: "no-store" });
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream failed (${upstream.status})` },
      { status: 502 }
    );
  }

  const buffer = await upstream.arrayBuffer();
  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream";
  const filename = filenameFromMediaUrl(mediaUrl);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
