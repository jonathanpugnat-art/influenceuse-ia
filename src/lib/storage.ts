import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getBlobStore } from "@/lib/blob";
import { getEnv } from "@/lib/env";
import { parseNiche, type Niche } from "@/lib/niche";
import {
  countPostsByOwner,
  createBuilderCharacter,
  createCloneCharacter,
  createCloneCharacterFromKeys,
  findOwnedCharacter,
  listCharactersByOwner,
  readNicheByCharacter,
  updateNiche,
} from "@/lib/repositories/db/characters";
import { isReel, type Reel } from "@/lib/reels";
import { parseTraits, type Traits } from "@/lib/traits";

function useDbCharacters(): boolean {
  return getEnv().METADATA_DRIVER === "db";
}

const DATA_ROOT = path.join(process.cwd(), "data");

export type CharacterDoor = "builder" | "clone";

export type ImageFile = {
  file: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
};

export type CharacterRecord = {
  id: string;
  ownerId: string | null;
  name: string;
  door: CharacterDoor;
  createdAt: string;
  traits: Traits | null;
  face: ImageFile;
  sources: ImageFile[];
  biometricConsentAt?: string | null;
  loraEnabled?: boolean;
};

export type CharacterSummary = {
  id: string;
  name: string;
  door: CharacterDoor;
  createdAt: string;
  nicheSubject: string | null;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

function isOwnerId(value: string): boolean {
  return /^[A-Za-z0-9_]{1,80}$/.test(value);
}

function charactersRoot(): string {
  return path.join(DATA_ROOT, "characters");
}

function previewsRoot(): string {
  return path.join(DATA_ROOT, "previews");
}

function characterDirectory(id: string): string {
  if (!isUuid(id)) throw new Error("identifiant invalide");
  return path.join(charactersRoot(), id);
}

export function detectImageType(
  buffer: Buffer,
): ImageFile["contentType"] | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function extensionFor(contentType: ImageFile["contentType"]): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default: {
      const exhaustive: never = contentType;
      return exhaustive;
    }
  }
}

function parseCharacter(raw: unknown): CharacterRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || !isUuid(record.id)) return null;
  if (typeof record.name !== "string" || record.name.length < 2) return null;
  if (record.door !== "builder" && record.door !== "clone") return null;
  if (typeof record.createdAt !== "string") return null;
  if (!record.face || typeof record.face !== "object") return null;

  const face = record.face as Record<string, unknown>;
  if (typeof face.file !== "string" || typeof face.contentType !== "string") {
    return null;
  }
  if (
    face.contentType !== "image/jpeg" &&
    face.contentType !== "image/png" &&
    face.contentType !== "image/webp"
  ) {
    return null;
  }

  const traits = record.traits === null ? null : parseTraits(record.traits);
  if (record.door === "builder" && !traits) return null;
  if (record.door === "clone" && record.traits !== null) return null;

  const sources = Array.isArray(record.sources) ? record.sources : null;
  if (!sources) return null;

  const parsedSources: ImageFile[] = [];
  for (const source of sources) {
    if (!source || typeof source !== "object") return null;
    const item = source as Record<string, unknown>;
    if (typeof item.file !== "string" || typeof item.contentType !== "string") {
      return null;
    }
    if (
      item.contentType !== "image/jpeg" &&
      item.contentType !== "image/png" &&
      item.contentType !== "image/webp"
    ) {
      return null;
    }
    parsedSources.push({
      file: path.basename(item.file),
      contentType: item.contentType,
    });
  }

  return {
    id: record.id,
    ownerId:
      typeof record.ownerId === "string" && isOwnerId(record.ownerId) ? record.ownerId : null,
    name: record.name,
    door: record.door,
    createdAt: record.createdAt,
    traits,
    face: {
      file: path.basename(face.file),
      contentType: face.contentType,
    },
    sources: parsedSources,
  };
}

export function parseName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) return null;
  return name;
}

export async function writePreview(traits: Traits, image: Buffer): Promise<string> {
  const id = randomUUID();
  const directory = path.join(previewsRoot(), id);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "face.jpg"), image);
  await writeFile(
    path.join(directory, "preview.json"),
    JSON.stringify({ id, traits, createdAt: new Date().toISOString() }),
  );
  return id;
}

export async function readPreview(
  id: string,
): Promise<{ traits: Traits; image: Buffer } | null> {
  if (!isUuid(id)) return null;
  const directory = path.join(previewsRoot(), id);
  try {
    const raw = JSON.parse(
      await readFile(path.join(directory, "preview.json"), "utf8"),
    ) as { traits?: unknown };
    const traits = parseTraits(raw.traits);
    if (!traits) return null;
    const image = await readFile(path.join(directory, "face.jpg"));
    return { traits, image };
  } catch {
    return null;
  }
}

export async function readPreviewImage(id: string): Promise<Buffer | null> {
  if (!isUuid(id)) return null;
  try {
    return await readFile(path.join(previewsRoot(), id, "face.jpg"));
  } catch {
    return null;
  }
}

export async function saveBuilderCharacter(
  name: string,
  previewId: string,
  ownerId: string,
): Promise<CharacterRecord | null> {
  const preview = await readPreview(previewId);
  if (!preview) return null;

  if (useDbCharacters()) {
    const character = await createBuilderCharacter({
      ownerId,
      name,
      traits: preview.traits,
      face: preview.image,
      faceContentType: "image/jpeg",
    });
    await rm(path.join(previewsRoot(), previewId), { recursive: true, force: true });
    return character;
  }

  const id = randomUUID();
  const directory = characterDirectory(id);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "face.jpg"), preview.image);

  const character: CharacterRecord = {
    id,
    ownerId,
    name,
    door: "builder",
    createdAt: new Date().toISOString(),
    traits: preview.traits,
    face: { file: "face.jpg", contentType: "image/jpeg" },
    sources: [],
  };
  await writeFile(
    path.join(directory, "character.json"),
    JSON.stringify(character, null, 2),
  );
  await rm(path.join(previewsRoot(), previewId), { recursive: true, force: true });
  return character;
}

export async function saveCloneCharacter(
  name: string,
  photos: { buffer: Buffer; contentType: ImageFile["contentType"] }[],
  referenceIndex: number,
  ownerId: string,
  options?: { biometricConsentAt?: Date },
): Promise<CharacterRecord> {
  const consent = options?.biometricConsentAt;
  if (!consent) throw new Error("consentement biométrique requis");

  if (useDbCharacters()) {
    return createCloneCharacter({
      ownerId,
      name,
      photos,
      referenceIndex,
      biometricConsentAt: consent,
    });
  }

  const id = randomUUID();
  const directory = characterDirectory(id);
  const sourcesDirectory = path.join(directory, "sources");
  await mkdir(sourcesDirectory, { recursive: true });

  const sources: ImageFile[] = [];
  for (const [index, photo] of photos.entries()) {
    const file = `${index}.${extensionFor(photo.contentType)}`;
    await writeFile(path.join(sourcesDirectory, file), photo.buffer);
    sources.push({ file, contentType: photo.contentType });
  }

  const reference = photos[referenceIndex];
  if (!reference) throw new Error("photo de référence absente");
  const faceName = `face.${extensionFor(reference.contentType)}`;
  await writeFile(path.join(directory, faceName), reference.buffer);

  const character: CharacterRecord = {
    id,
    ownerId,
    name,
    door: "clone",
    createdAt: new Date().toISOString(),
    traits: null,
    face: { file: faceName, contentType: reference.contentType },
    sources,
    biometricConsentAt: consent.toISOString(),
  };
  await writeFile(
    path.join(directory, "character.json"),
    JSON.stringify(character, null, 2),
  );
  return character;
}

export async function saveCloneCharacterFromUploads(
  name: string,
  uploadKeys: string[],
  referenceIndex: number,
  ownerId: string,
  biometricConsentAt: Date,
): Promise<CharacterRecord> {
  if (!useDbCharacters()) {
    throw new Error("uploads directs réservés à METADATA_DRIVER=db");
  }
  return createCloneCharacterFromKeys({
    ownerId,
    name,
    uploadKeys,
    referenceIndex,
    biometricConsentAt,
  });
}

async function writeCharacter(character: CharacterRecord): Promise<void> {
  await writeFile(
    path.join(characterDirectory(character.id), "character.json"),
    JSON.stringify(character, null, 2),
  );
}

export async function getOwnedCharacter(
  id: string,
  ownerId: string,
): Promise<CharacterRecord | null> {
  if (useDbCharacters()) {
    return findOwnedCharacter(id, ownerId);
  }
  const character = await getCharacter(id);
  if (!character) return null;
  if (character.ownerId && character.ownerId !== ownerId) return null;
  if (character.ownerId === ownerId) return character;
  const claimed = { ...character, ownerId };
  await writeCharacter(claimed);
  return claimed;
}

export async function listCharacters(ownerId: string): Promise<CharacterSummary[]> {
  if (useDbCharacters()) {
    return listCharactersByOwner(ownerId);
  }
  try {
    const entries = await readdir(charactersRoot(), { withFileTypes: true });
    const characters: CharacterSummary[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !isUuid(entry.name)) continue;
      const character = await getOwnedCharacter(entry.name, ownerId);
      if (!character) continue;
      const niche = await readNiche(character.id);
      characters.push({
        id: character.id,
        name: character.name,
        door: character.door,
        createdAt: character.createdAt,
        nicheSubject: niche?.subject ?? null,
      });
    }
    return characters.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function getCharacter(id: string): Promise<CharacterRecord | null> {
  if (!isUuid(id)) return null;
  try {
    const raw: unknown = JSON.parse(
      await readFile(path.join(characterDirectory(id), "character.json"), "utf8"),
    );
    const character = parseCharacter(raw);
    if (!character || character.id !== id) return null;
    return character;
  } catch {
    return null;
  }
}

export async function readNiche(id: string, ownerId?: string): Promise<Niche | null> {
  if (!isUuid(id)) return null;
  if (useDbCharacters()) {
    return readNicheByCharacter(id, ownerId);
  }
  try {
    const raw: unknown = JSON.parse(
      await readFile(path.join(characterDirectory(id), "niche.json"), "utf8"),
    );
    return parseNiche(raw);
  } catch {
    return null;
  }
}

export async function saveNiche(
  id: string,
  ownerId: string,
  input: unknown,
): Promise<Niche | null> {
  const character = await getOwnedCharacter(id, ownerId);
  const niche = parseNiche(input);
  if (!character || !niche) return null;
  if (useDbCharacters()) {
    return updateNiche(id, ownerId, niche);
  }
  await writeFile(
    path.join(characterDirectory(id), "niche.json"),
    JSON.stringify(niche, null, 2),
  );
  return niche;
}

export async function readCharacterFace(character: CharacterRecord): Promise<Buffer | null> {
  if (useDbCharacters() || character.face.file.includes("/")) {
    return getBlobStore().get(character.face.file);
  }
  if (!character.id) return null;
  return readCharacterFile(character.id, character.face.file);
}

export async function readCharacterFile(
  id: string,
  fileName: string,
): Promise<Buffer | null> {
  if (!isUuid(id)) return null;
  if (fileName.includes("/") && !fileName.includes("..")) {
    return getBlobStore().get(fileName);
  }
  const safeName = path.basename(fileName);
  if (safeName !== fileName || safeName.includes("..")) return null;
  try {
    return await readFile(path.join(characterDirectory(id), safeName));
  } catch {
    return null;
  }
}

export async function readSourceFile(
  id: string,
  fileName: string,
): Promise<Buffer | null> {
  if (!isUuid(id)) return null;
  if (fileName.includes("/") && !fileName.includes("..")) {
    return getBlobStore().get(fileName);
  }
  const safeName = path.basename(fileName);
  if (safeName !== fileName || safeName.includes("..")) return null;
  try {
    return await readFile(path.join(characterDirectory(id), "sources", safeName));
  } catch {
    return null;
  }
}

export async function savePost(
  characterId: string,
  image: Buffer,
  existingId?: string,
): Promise<string | null> {
  const character = await getCharacter(characterId);
  if (!character) return null;
  const postId = existingId && isUuid(existingId) ? existingId : randomUUID();
  const directory = path.join(characterDirectory(characterId), "posts");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${postId}.jpg`), image);
  return postId;
}

export async function saveVideoPost(
  characterId: string,
  video: Buffer,
  existingId?: string,
): Promise<string | null> {
  const character = await getCharacter(characterId);
  if (!character) return null;
  const postId = existingId && isUuid(existingId) ? existingId : randomUUID();
  const directory = path.join(characterDirectory(characterId), "posts");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${postId}.mp4`), video);
  return postId;
}

export async function countPosts(ownerId: string): Promise<number> {
  if (useDbCharacters()) {
    return countPostsByOwner(ownerId);
  }
  const characters = await listCharacters(ownerId);
  let total = 0;
  for (const character of characters) {
    try {
      const entries = await readdir(path.join(characterDirectory(character.id), "posts"));
      total += entries.filter((name) => name.endsWith(".jpg") || name.endsWith(".mp4")).length;
    } catch {
      continue;
    }
  }
  return total;
}

export async function readPost(characterId: string, postId: string): Promise<Buffer | null> {
  if (!isUuid(characterId) || !isUuid(postId)) return null;
  try {
    return await readFile(path.join(characterDirectory(characterId), "posts", `${postId}.jpg`));
  } catch {
    try {
      return await readFile(path.join(characterDirectory(characterId), "posts", `${postId}.mp4`));
    } catch {
      return null;
    }
  }
}

function trendsRoot(): string {
  return path.join(DATA_ROOT, "trends");
}

function isHashtagName(value: string): boolean {
  return /^[\p{L}\p{N}_]{2,40}$/u.test(value);
}

export async function saveTrend(hashtag: string, reels: Reel[]): Promise<void> {
  if (!isHashtagName(hashtag)) throw new Error("hashtag invalide");
  await mkdir(trendsRoot(), { recursive: true });
  await writeFile(
    path.join(trendsRoot(), `${hashtag}.json`),
    JSON.stringify({ hashtag, fetchedAt: new Date().toISOString(), reels }, null, 2),
  );
}

export type TrendFile = { hashtag: string; fetchedAt: string; reels: Reel[] };

export async function readTrend(hashtag: string): Promise<TrendFile | null> {
  if (!isHashtagName(hashtag)) return null;
  try {
    const raw = JSON.parse(
      await readFile(path.join(trendsRoot(), `${hashtag}.json`), "utf8"),
    ) as Partial<TrendFile>;
    if (typeof raw.hashtag !== "string" || !Array.isArray(raw.reels)) return null;
    return {
      hashtag: raw.hashtag,
      fetchedAt: typeof raw.fetchedAt === "string" ? raw.fetchedAt : "",
      reels: raw.reels.filter(isReel),
    };
  } catch {
    return null;
  }
}

export async function listTrends(): Promise<TrendFile[]> {
  try {
    const entries = await readdir(trendsRoot());
    const trends: TrendFile[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const trend = await readTrend(entry.slice(0, -5));
      if (trend) trends.push(trend);
    }
    return trends.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
  } catch {
    return [];
  }
}
