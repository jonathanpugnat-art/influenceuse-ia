import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { inngest } from "@/lib/jobs/inngest";
import { listRefs } from "@/lib/repositories/db/face-refs";
import { requireUserId } from "@/lib/session";
import { getOwnedCharacter } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const userId = await requireUserId();
  const { id } = await context.params;
  const character = await getOwnedCharacter(id, userId);
  if (!character) {
    return NextResponse.json({ error: "Influenceuse introuvable." }, { status: 404 });
  }
  if (getEnv().METADATA_DRIVER !== "db") {
    return NextResponse.json({ refs: [] });
  }
  const refs = await listRefs(id, userId);
  return NextResponse.json({
    refs: refs.map((ref) => ({
      angle: ref.angle,
      key: ref.key,
      origin: ref.origin,
      score: ref.score,
      url: `/api/characters/${id}/refs/${ref.angle}`,
    })),
  });
}

export async function POST(_request: Request, context: RouteContext) {
  const userId = await requireUserId();
  const { id } = await context.params;
  const character = await getOwnedCharacter(id, userId);
  if (!character) {
    return NextResponse.json({ error: "Influenceuse introuvable." }, { status: 404 });
  }
  if (!getEnv().IDENTITY_REFS_ENABLED || getEnv().METADATA_DRIVER !== "db") {
    return NextResponse.json({ error: "Références désactivées." }, { status: 400 });
  }
  await inngest.send({
    name: "ofmia/identity.refs.requested",
    data: { characterId: id, userId },
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
