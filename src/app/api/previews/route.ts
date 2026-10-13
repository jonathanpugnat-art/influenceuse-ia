import { NextResponse } from "next/server";

import { requireSession } from "@/lib/session";

import { generatePortrait } from "@/lib/portrait";
import { buildFacePrompt, parseTraits } from "@/lib/traits";
import { writePreview } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  await requireSession();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const traits = parseTraits(
    body && typeof body === "object" ? (body as { traits?: unknown }).traits : null,
  );
  if (!traits) {
    return NextResponse.json(
      { error: "Choisis chaque trait avant de générer le visage." },
      { status: 400 },
    );
  }

  try {
    const image = await generatePortrait(buildFacePrompt(traits));
    const id = await writePreview(traits, image);
    return NextResponse.json({ id });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "missing_key") {
      return NextResponse.json(
        { error: "La génération d'image n'est pas configurée." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Le visage n'a pas pu être généré. Réessaie." },
      { status: 502 },
    );
  }
}
