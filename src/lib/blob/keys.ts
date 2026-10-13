import { isUuid } from "@/lib/storage-ids";

export type ImageContentType = "image/jpeg" | "image/png" | "image/webp";

const OWNER = /^user_[A-Za-z0-9]+$/;

export function isClerkUserId(value: string): boolean {
  return OWNER.test(value);
}

function assertOwner(userId: string): void {
  if (!isClerkUserId(userId)) throw new Error("owner invalide");
}

function assertCharacter(characterId: string): void {
  if (!isUuid(characterId)) throw new Error("characterId invalide");
}

function extensionFor(contentType: ImageContentType): string {
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

export function faceKey(
  userId: string,
  characterId: string,
  contentType: ImageContentType,
): string {
  assertOwner(userId);
  assertCharacter(characterId);
  return `characters/${userId}/${characterId}/face.${extensionFor(contentType)}`;
}

export function sourceKey(
  userId: string,
  characterId: string,
  index: number,
  contentType: ImageContentType,
): string {
  assertOwner(userId);
  assertCharacter(characterId);
  if (!Number.isInteger(index) || index < 0 || index > 99) throw new Error("index invalide");
  return `characters/${userId}/${characterId}/sources/${index}.${extensionFor(contentType)}`;
}

export function postKey(userId: string, characterId: string, postId: string): string {
  assertOwner(userId);
  assertCharacter(characterId);
  if (!isUuid(postId)) throw new Error("postId invalide");
  return `posts/${userId}/${characterId}/${postId}.jpg`;
}

export function videoKey(userId: string, characterId: string, postId: string): string {
  assertOwner(userId);
  assertCharacter(characterId);
  if (!isUuid(postId)) throw new Error("postId invalide");
  return `posts/${userId}/${characterId}/${postId}.mp4`;
}

export function detectVideoType(buffer: Buffer): "video/mp4" | null {
  if (buffer.length < 12) return null;
  const brand = buffer.subarray(4, 8).toString("ascii");
  return brand === "ftyp" ? "video/mp4" : null;
}

export function previewKey(userId: string, previewId: string): string {
  assertOwner(userId);
  if (!isUuid(previewId)) throw new Error("previewId invalide");
  return `previews/${userId}/${previewId}.jpg`;
}

export function uploadKey(
  userId: string,
  uploadId: string,
  index: number,
  contentType: ImageContentType,
): string {
  assertOwner(userId);
  if (!isUuid(uploadId)) throw new Error("uploadId invalide");
  if (!Number.isInteger(index) || index < 0 || index > 99) throw new Error("index invalide");
  return `uploads/${userId}/${uploadId}/${index}.${extensionFor(contentType)}`;
}

export function refKey(
  userId: string,
  characterId: string,
  angle: "front" | "three_quarter_left" | "three_quarter_right",
  contentType: ImageContentType,
): string {
  assertOwner(userId);
  assertCharacter(characterId);
  return `characters/${userId}/${characterId}/refs/${angle}.${extensionFor(contentType)}`;
}

export function loraZipKey(userId: string, characterId: string, trainingId: string): string {
  assertOwner(userId);
  assertCharacter(characterId);
  if (!isUuid(trainingId)) throw new Error("trainingId invalide");
  return `tmp/${userId}/${characterId}/lora/${trainingId}.zip`;
}
