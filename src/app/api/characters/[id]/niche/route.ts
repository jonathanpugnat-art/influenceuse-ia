import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/session";
import { getOwnedCharacter, readNiche, saveNiche } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const userId = await requireUserId();
  const { id } = await context.params;
  const character = await getOwnedCharacter(id, userId);
  const niche = character ? await readNiche(id) : null;
  if (!niche) {
    return NextResponse.json({ error: "Niche introuvable." }, { status: 404 });
  }
  return NextResponse.json(niche);
}

export async function POST(request: Request, context: RouteContext) {
  const userId = await requireUserId();
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }
  const niche = await saveNiche(id, userId, body);
  if (!niche) {
    return NextResponse.json(
      { error: "Chaque champ de la niche fait entre 2 et 80 caractères." },
      { status: 400 },
    );
  }
  return NextResponse.json(niche);
}
