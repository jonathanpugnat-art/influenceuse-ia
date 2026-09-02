import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  filenameFromMediaUrl,
  isAllowedMediaDownloadUrl,
  isRedirectStatus,
  MAX_MEDIA_DOWNLOAD_BYTES,
  MAX_MEDIA_REDIRECTS,
  resolveMediaRedirectUrl,
} from "@/lib/media-url-allowlist";

/**
 * GET /api/media/download?url=<encoded>
 * Proxies allowed media URLs with Content-Disposition: attachment.
 * https + allowlist only; each redirect hop is re-checked. Body capped.
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

  let currentUrl = mediaUrl;
  let upstream: Response | null = null;

  for (let hop = 0; hop <= MAX_MEDIA_REDIRECTS; hop += 1) {
    if (!isAllowedMediaDownloadUrl(currentUrl)) {
      return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
    }

    upstream = await fetch(currentUrl, {
      cache: "no-store",
      redirect: "manual",
    });

    if (!isRedirectStatus(upstream.status)) {
      break;
    }

    const location = upstream.headers.get("location");
    if (!location) {
      return NextResponse.json(
        { error: "Upstream redirect missing Location" },
        { status: 502 }
      );
    }
    const nextUrl = resolveMediaRedirectUrl(location, currentUrl);
    if (!nextUrl || !isAllowedMediaDownloadUrl(nextUrl)) {
      return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
    }
    currentUrl = nextUrl;
    upstream = null;
  }

  if (!upstream) {
    return NextResponse.json({ error: "Too many redirects" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream failed (${upstream.status})` },
      { status: 502 }
    );
  }

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > MAX_MEDIA_DOWNLOAD_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }
  }

  const bodyResult = await readCappedBody(upstream);
  if (!bodyResult.ok) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream";
  const filename = filenameFromMediaUrl(mediaUrl);

  return new NextResponse(bodyResult.buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function readCappedBody(
  resp: Response
): Promise<{ ok: true; buffer: ArrayBuffer } | { ok: false }> {
  const reader = resp.body?.getReader();
  if (!reader) {
    return { ok: true, buffer: new ArrayBuffer(0) };
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > MAX_MEDIA_DOWNLOAD_BYTES) {
      await reader.cancel();
      return { ok: false };
    }
    chunks.push(value);
  }

  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, buffer: out.buffer };
}
