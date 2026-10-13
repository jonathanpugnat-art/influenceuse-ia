import { NextResponse } from "next/server";

import { planById } from "@/lib/billing/plans";
import { getEnv } from "@/lib/env";
import { getUserBilling } from "@/lib/repositories/db/credits";
import { requireUserId } from "@/lib/session";
import {
  listCharacters,
  parseName,
  saveBuilderCharacter,
  saveCloneCharacter,
  saveCloneCharacterFromUploads,
} from "@/lib/storage";
import { detectImageType } from "@/lib/storage-ids";
import { MAX_CLONE_PHOTOS, MAX_PHOTO_BYTES, MIN_CLONE_PHOTOS } from "@/lib/traits";

export const runtime = "nodejs";

async function assertPlanAllowsCharacter(userId: string): Promise<NextResponse | null> {
  const [billing, characters] = await Promise.all([
    getUserBilling(userId),
    listCharacters(userId),
  ]);
  const plan = planById(billing?.plan ?? "decouverte") ?? planById("decouverte")!;
  if (characters.length >= plan.maxInfluencers) {
    return NextResponse.json(
      {
        error: `Limite du plan ${plan.name} atteinte (${plan.maxInfluencers}).`,
        code: "plan_limit",
        maxInfluencers: plan.maxInfluencers,
      },
      { status: 403 },
    );
  }
  return null;
}

function requireBiometricConsent(value: unknown): Date | null {
  if (value === true || value === "true" || value === "1") {
    return new Date();
  }
  return null;
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  const blocked = await assertPlanAllowsCharacter(userId);
  if (blocked) return blocked;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return saveCloneMultipart(request, userId);
  }
  return saveJson(request, userId);
}

async function saveJson(request: Request, userId: string) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const name = parseName(record.name);

  if (Array.isArray(record.uploadKeys)) {
    if (!name) {
      return NextResponse.json(
        { error: "Donne un nom entre 2 et 40 caractères." },
        { status: 400 },
      );
    }
    const consent = requireBiometricConsent(record.biometricConsent);
    if (!consent) {
      return NextResponse.json(
        { error: "Le consentement biométrique est obligatoire pour cloner." },
        { status: 400 },
      );
    }
    const uploadKeys = record.uploadKeys.filter((item): item is string => typeof item === "string");
    const referenceIndex = Number(record.referenceIndex);
    if (uploadKeys.length < MIN_CLONE_PHOTOS || uploadKeys.length > MAX_CLONE_PHOTOS) {
      return NextResponse.json(
        { error: `Il faut entre ${MIN_CLONE_PHOTOS} et ${MAX_CLONE_PHOTOS} photos.` },
        { status: 400 },
      );
    }
    if (
      !Number.isInteger(referenceIndex) ||
      referenceIndex < 0 ||
      referenceIndex >= uploadKeys.length
    ) {
      return NextResponse.json(
        { error: "Choisis la photo qui devient le visage." },
        { status: 400 },
      );
    }
    if (getEnv().METADATA_DRIVER !== "db") {
      return NextResponse.json(
        { error: "Uploads directs réservés au mode cloud." },
        { status: 400 },
      );
    }
    try {
      const character = await saveCloneCharacterFromUploads(
        name,
        uploadKeys,
        referenceIndex,
        userId,
        consent,
      );
      return NextResponse.json({ id: character.id });
    } catch {
      return NextResponse.json({ error: "Photos illisibles ou expirées." }, { status: 400 });
    }
  }

  if (!name) {
    return NextResponse.json(
      { error: "Donne un nom entre 2 et 40 caractères." },
      { status: 400 },
    );
  }
  const previewId = typeof record.previewId === "string" ? record.previewId : "";
  const character = await saveBuilderCharacter(name, previewId, userId);
  if (!character) {
    return NextResponse.json(
      { error: "Génère un visage avant de l'enregistrer." },
      { status: 400 },
    );
  }
  return NextResponse.json({ id: character.id });
}

async function saveCloneMultipart(request: Request, userId: string) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Photos illisibles." }, { status: 400 });
  }

  const name = parseName(form.get("name"));
  if (!name) {
    return NextResponse.json(
      { error: "Donne un nom entre 2 et 40 caractères." },
      { status: 400 },
    );
  }

  const consent = requireBiometricConsent(form.get("biometricConsent"));
  if (!consent) {
    return NextResponse.json(
      { error: "Le consentement biométrique est obligatoire pour cloner." },
      { status: 400 },
    );
  }

  const referenceIndex = Number(form.get("referenceIndex"));
  const files = form
    .getAll("photos")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (files.length < MIN_CLONE_PHOTOS || files.length > MAX_CLONE_PHOTOS) {
    return NextResponse.json(
      { error: `Il faut entre ${MIN_CLONE_PHOTOS} et ${MAX_CLONE_PHOTOS} photos.` },
      { status: 400 },
    );
  }
  if (!Number.isInteger(referenceIndex) || referenceIndex < 0 || referenceIndex >= files.length) {
    return NextResponse.json(
      { error: "Choisis la photo qui devient le visage." },
      { status: 400 },
    );
  }

  const photos = [];
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { error: "Chaque photo doit faire moins de 4 Mo." },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const imageType = detectImageType(buffer);
    if (!imageType) {
      return NextResponse.json(
        { error: "Formats acceptés : JPEG, PNG, WebP." },
        { status: 400 },
      );
    }
    photos.push({ buffer, contentType: imageType });
  }

  const character = await saveCloneCharacter(name, photos, referenceIndex, userId, {
    biometricConsentAt: consent,
  });
  return NextResponse.json({ id: character.id });
}
