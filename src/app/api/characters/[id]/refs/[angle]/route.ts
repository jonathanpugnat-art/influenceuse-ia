import { NextResponse } from "next/server";

import { getBlobStore } from "@/lib/blob";
import { isFaceAngle } from "@/lib/identity/angles";
import { listRefs } from "@/lib/repositories/db/face-refs";
import { requireUserId } from "@/lib/session";
import { getOwnedCharacter, readCharacterFace } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; angle: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const userId = await requireUserId();
  const { id, angle } = await context.params;
  if (!isFaceAngle(angle)) {
    return NextResponse.json({ error: "Angle invalide." }, { status: 400 });
  }
  const character = await getOwnedCharacter(id, userId);
  if (!character) {
    return NextResponse.json({ error: "Influenceuse introuvable." }, { status: 404 });
  }

  const refs = await listRefs(id, userId);
  const ref = refs.find((item) => item.angle === angle);
  const blob = getBlobStore();
  const bytes = ref
    ? await blob.get(ref.key)
    : angle === "front"
      ? await readCharacterFace(character)
      : null;
  if (!bytes) {
    return NextResponse.json({ error: "Référence introuvable." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": ref?.contentType ?? character.face.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
