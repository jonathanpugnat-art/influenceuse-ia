import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { CREDIT_COSTS } from "@/lib/credits";
import { getEnv } from "@/lib/env";
import { inngest } from "@/lib/jobs/inngest";
import { track } from "@/lib/observability/analytics";
import {
  createJob,
  debitCredits,
  refundCredits,
} from "@/lib/repositories/db/jobs";
import {
  createLoraRecord,
  getActiveLora,
  setCharacterLoraEnabled,
} from "@/lib/repositories/db/loras";
import { requireUserId } from "@/lib/session";
import { getOwnedCharacter } from "@/lib/storage";
import { MIN_LORA_PHOTOS } from "@/lib/traits";

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
    return NextResponse.json({ lora: null, enabled: false });
  }
  const lora = await getActiveLora(id, userId);
  return NextResponse.json({
    lora: lora
      ? {
          id: lora.id,
          status: lora.status,
          photoCount: lora.photoCount,
          validationScore: lora.validationScore,
          jobId: lora.jobId,
          errorCode: lora.errorCode,
        }
      : null,
    enabled: Boolean(character.loraEnabled),
    cost: CREDIT_COSTS.lora_training,
    minPhotos: MIN_LORA_PHOTOS,
  });
}

export async function POST(_request: Request, context: RouteContext) {
  const userId = await requireUserId();
  const { id } = await context.params;
  const env = getEnv();
  if (!env.LORA_ENABLED || env.METADATA_DRIVER !== "db") {
    return NextResponse.json({ error: "LoRA désactivé." }, { status: 400 });
  }
  const character = await getOwnedCharacter(id, userId);
  if (!character) {
    return NextResponse.json({ error: "Influenceuse introuvable." }, { status: 404 });
  }
  if (character.door !== "clone") {
    return NextResponse.json({ error: "LoRA réservé à la porte clone." }, { status: 403 });
  }
  if (character.sources.length < MIN_LORA_PHOTOS) {
    return NextResponse.json(
      { error: `Il faut au moins ${MIN_LORA_PHOTOS} photos.` },
      { status: 400 },
    );
  }
  if (!character.biometricConsentAt) {
    return NextResponse.json({ error: "Consentement biométrique requis." }, { status: 400 });
  }
  const existing = await getActiveLora(id, userId);
  if (existing && ["queued", "training", "validating", "ready"].includes(existing.status)) {
    return NextResponse.json(
      { error: "Un LoRA est déjà en cours ou prêt.", code: "lora_active" },
      { status: 409 },
    );
  }

  const jobId = randomUUID();
  await createJob({
    id: jobId,
    ownerId: userId,
    kind: "lora_training",
    model: "replicate/fast-flux-trainer",
    characterId: id,
  });
  const debit = await debitCredits({
    userId,
    jobId,
    amount: CREDIT_COSTS.lora_training,
  });
  if (!debit.ok) {
    return NextResponse.json(
      {
        error: "Crédits insuffisants.",
        code: "credits_insufficient",
        balance: debit.balance,
        cost: CREDIT_COSTS.lora_training,
      },
      { status: 402 },
    );
  }

  try {
    const lora = await createLoraRecord({
      characterId: id,
      ownerId: userId,
      photoCount: character.sources.length,
      jobId,
    });
    await inngest.send({
      name: "ofmia/lora.requested",
      data: { jobId, characterId: id, userId, loraId: lora.id },
    });
    await track(userId, {
      name: "lora_training_started",
      props: { photoCount: character.sources.length },
    });
    return NextResponse.json({ jobId, loraId: lora.id }, { status: 202 });
  } catch (error) {
    await refundCredits({ userId, jobId });
    console.error("lora enqueue failed", error);
    return NextResponse.json({ error: "Impossible de lancer le training." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const userId = await requireUserId();
  const { id } = await context.params;
  const character = await getOwnedCharacter(id, userId);
  if (!character) {
    return NextResponse.json({ error: "Influenceuse introuvable." }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }
  const enabled =
    body && typeof body === "object" && "enabled" in body
      ? Boolean((body as { enabled: unknown }).enabled)
      : null;
  if (enabled === null) {
    return NextResponse.json({ error: "enabled requis." }, { status: 400 });
  }
  const lora = await getActiveLora(id, userId);
  if (enabled && (!lora || lora.status !== "ready")) {
    return NextResponse.json({ error: "Aucun LoRA prêt." }, { status: 400 });
  }
  await setCharacterLoraEnabled(id, userId, enabled);
  return NextResponse.json({ enabled });
}
