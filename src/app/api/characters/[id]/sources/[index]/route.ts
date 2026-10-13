import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/session";
import { getOwnedCharacter, readSourceFile } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; index: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const userId = await requireUserId();
  const { id, index } = await context.params;
  const sourceIndex = Number(index);
  const character = await getOwnedCharacter(id, userId);
  if (!character || !Number.isInteger(sourceIndex)) {
    return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });
  }

  const source = character.sources[sourceIndex];
  if (!source) {
    return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });
  }

  const image = await readSourceFile(id, source.file);
  if (!image) {
    return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image), {
    headers: {
      "Content-Type": source.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
