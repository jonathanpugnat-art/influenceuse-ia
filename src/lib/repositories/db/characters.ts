import { and, count, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getBlobStore } from "@/lib/blob";
import { faceKey, sourceKey } from "@/lib/blob/keys";
import { getDb } from "@/lib/db/client";
import { characters, posts, type StoredImage } from "@/lib/db/schema";
import type { Niche } from "@/lib/niche";
import { ensureUser } from "@/lib/repositories/db/credits";
import type { CharacterDoor, CharacterRecord, CharacterSummary, ImageFile } from "@/lib/storage";
import { detectImageType, type ImageContentType } from "@/lib/storage-ids";
import { enqueueIdentityRefs } from "@/lib/identity/enqueue-refs";
import { MAX_PHOTO_BYTES, type Traits } from "@/lib/traits";

function toRecord(row: typeof characters.$inferSelect): CharacterRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    door: row.door,
    createdAt: row.createdAt.toISOString(),
    traits: row.traits,
    face: { file: row.faceKey, contentType: row.faceContentType },
    sources: row.sources.map((source) => ({
      file: source.key,
      contentType: source.contentType,
    })),
    biometricConsentAt: row.biometricConsentAt?.toISOString() ?? null,
    loraEnabled: row.loraEnabled,
  };
}

export async function findOwnedCharacter(
  id: string,
  ownerId: string,
): Promise<CharacterRecord | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), eq(characters.ownerId, ownerId)))
    .limit(1);
  const row = rows[0];
  return row ? toRecord(row) : null;
}

export async function listCharactersByOwner(ownerId: string): Promise<CharacterSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: characters.id,
      name: characters.name,
      door: characters.door,
      createdAt: characters.createdAt,
      niche: characters.niche,
    })
    .from(characters)
    .where(eq(characters.ownerId, ownerId))
    .orderBy(desc(characters.createdAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    door: row.door,
    createdAt: row.createdAt.toISOString(),
    nicheSubject: row.niche?.subject ?? null,
  }));
}

export async function createBuilderCharacter(input: {
  ownerId: string;
  name: string;
  traits: Traits;
  face: Buffer;
  faceContentType?: ImageContentType;
}): Promise<CharacterRecord> {
  const id = randomUUID();
  const contentType = input.faceContentType ?? "image/jpeg";
  const key = faceKey(input.ownerId, id, contentType);
  const blob = getBlobStore();
  await ensureUser(input.ownerId);
  await blob.put({ key, body: input.face, contentType });
  const db = getDb();
  const [row] = await db
    .insert(characters)
    .values({
      id,
      ownerId: input.ownerId,
      name: input.name,
      door: "builder",
      traits: input.traits,
      faceKey: key,
      faceContentType: contentType,
      sources: [],
    })
    .returning();
  if (!row) throw new Error("création personnage échouée");
  const record = toRecord(row);
  await enqueueIdentityRefs({ characterId: record.id, userId: input.ownerId }).catch((error) => {
    console.error("enqueue identity refs", error);
  });
  return record;
}

export async function createCloneCharacter(input: {
  ownerId: string;
  name: string;
  photos: { buffer: Buffer; contentType: ImageContentType }[];
  referenceIndex: number;
  biometricConsentAt: Date;
}): Promise<CharacterRecord> {
  const reference = input.photos[input.referenceIndex];
  if (!reference) throw new Error("photo de référence absente");

  const id = randomUUID();
  const blob = getBlobStore();
  await ensureUser(input.ownerId);

  const storedSources: StoredImage[] = [];
  for (const [index, photo] of input.photos.entries()) {
    const key = sourceKey(input.ownerId, id, index, photo.contentType);
    await blob.put({ key, body: photo.buffer, contentType: photo.contentType });
    storedSources.push({ key, contentType: photo.contentType });
  }

  const face = faceKey(input.ownerId, id, reference.contentType);
  await blob.put({
    key: face,
    body: reference.buffer,
    contentType: reference.contentType,
  });

  const db = getDb();
  const [row] = await db
    .insert(characters)
    .values({
      id,
      ownerId: input.ownerId,
      name: input.name,
      door: "clone",
      traits: null,
      faceKey: face,
      faceContentType: reference.contentType,
      sources: storedSources,
      biometricConsentAt: input.biometricConsentAt,
    })
    .returning();
  if (!row) throw new Error("création clone échouée");
  const record = toRecord(row);
  await enqueueIdentityRefs({ characterId: record.id, userId: input.ownerId }).catch((error) => {
    console.error("enqueue identity refs", error);
  });
  return record;
}

export async function createCloneCharacterFromKeys(input: {
  ownerId: string;
  name: string;
  uploadKeys: string[];
  referenceIndex: number;
  biometricConsentAt: Date;
}): Promise<CharacterRecord> {
  const blob = getBlobStore();
  const photos: { buffer: Buffer; contentType: ImageContentType }[] = [];

  for (const key of input.uploadKeys) {
    if (!key.startsWith(`uploads/${input.ownerId}/`)) {
      throw new Error("clé upload invalide");
    }
    const body = await blob.get(key);
    if (!body) throw new Error("upload manquant");
    if (body.length > MAX_PHOTO_BYTES) throw new Error("photo trop volumineuse");
    const contentType = detectImageType(body);
    if (!contentType) throw new Error("format image invalide");
    photos.push({ buffer: body, contentType });
  }

  const character = await createCloneCharacter({
    ownerId: input.ownerId,
    name: input.name,
    photos,
    referenceIndex: input.referenceIndex,
    biometricConsentAt: input.biometricConsentAt,
  });

  await Promise.all(input.uploadKeys.map((key) => blob.delete(key).catch(() => undefined)));
  return character;
}

export async function updateNiche(
  id: string,
  ownerId: string,
  niche: Niche,
): Promise<Niche | null> {
  const db = getDb();
  const rows = await db
    .update(characters)
    .set({ niche, updatedAt: new Date() })
    .where(and(eq(characters.id, id), eq(characters.ownerId, ownerId)))
    .returning({ niche: characters.niche });
  return rows[0]?.niche ?? null;
}

export async function readNicheByCharacter(
  id: string,
  ownerId?: string,
): Promise<Niche | null> {
  const db = getDb();
  const rows = await db
    .select({ niche: characters.niche, ownerId: characters.ownerId })
    .from(characters)
    .where(eq(characters.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (ownerId && row.ownerId !== ownerId) return null;
  return row.niche ?? null;
}

export async function setCharacterIdentity(input: {
  characterId: string;
  embedding: number[];
  model: string;
}): Promise<void> {
  const db = getDb();
  await db
    .update(characters)
    .set({
      identityEmbedding: input.embedding,
      identityModel: input.model,
      identityUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(characters.id, input.characterId));
}

export async function countPostsByOwner(ownerId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ value: count() })
    .from(posts)
    .where(and(eq(posts.ownerId, ownerId), eq(posts.status, "succeeded")));
  return Number(rows[0]?.value ?? 0);
}

export async function readCharacterFaceBytes(
  character: CharacterRecord,
): Promise<Buffer | null> {
  if (!character.ownerId) return null;
  const blob = getBlobStore();
  return blob.get(character.face.file);
}

export type { CharacterDoor, ImageFile };
