import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/session";
import { getOwnedCharacter, readCharacterFace } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const userId = await requireUserId();
  const { id } = await context.params;
  const character = await getOwnedCharacter(id, userId);
  if (!character) {
    return NextResponse.json({ error: "Influenceuse introuvable." }, { status: 404 });
  }

  const image = await readCharacterFace(character);
  if (!image) {
    return NextResponse.json({ error: "Visage introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image), {
    headers: {
      "Content-Type": character.face.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
