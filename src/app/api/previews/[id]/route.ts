import { NextResponse } from "next/server";

import { requireSession } from "@/lib/session";
import { readPreviewImage } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  await requireSession();
  const { id } = await context.params;
  const image = await readPreviewImage(id);
  if (!image) {
    return NextResponse.json({ error: "Aperçu introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-store",
    },
  });
}
