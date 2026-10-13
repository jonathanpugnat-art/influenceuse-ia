import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { requireUserId } from "@/lib/session";
import { getOwnedCharacter, readNiche } from "@/lib/storage";
import { writeReply } from "@/lib/voice";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const userId = await requireUserId();
  if (!checkRateLimit(userId, "chatter")) {
    return NextResponse.json(
      { error: "Cent vingt réponses par heure. Reviens un peu plus tard." },
      { status: 429 },
    );
  }
  const { id } = await context.params;
  const character = await getOwnedCharacter(id, userId);
  if (!character) {
    return NextResponse.json({ error: "Influenceuse introuvable." }, { status: 404 });
  }
  const niche = await readNiche(id);
  if (!niche) {
    return NextResponse.json({ error: "Définis d’abord la niche." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const message =
    body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
      ? (body as { message: string }).message
      : "";

  try {
    const reply = await writeReply({ name: character.name, niche, fanMessage: message });
    return NextResponse.json({ reply });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "invalid_message") {
      return NextResponse.json({ error: "Écris le message de l’abonné." }, { status: 400 });
    }
    if (code === "missing_key") {
      return NextResponse.json({ error: "Le chatter n’est pas configuré." }, { status: 503 });
    }
    console.error("chatter failed", code);
    return NextResponse.json({ error: "La réponse n’a pas pu être écrite." }, { status: 502 });
  }
}
