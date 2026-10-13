import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/client";
import { faceRefs } from "@/lib/db/schema";
import type { FaceAngle } from "@/lib/identity/angles";
import type { ImageContentType } from "@/lib/storage-ids";

export type FaceRefRow = typeof faceRefs.$inferSelect;

export async function listRefs(characterId: string, ownerId: string): Promise<FaceRefRow[]> {
  const db = getDb();
  return db
    .select()
    .from(faceRefs)
    .where(and(eq(faceRefs.characterId, characterId), eq(faceRefs.ownerId, ownerId)));
}

export async function upsertRef(input: {
  characterId: string;
  ownerId: string;
  angle: FaceAngle;
  key: string;
  contentType: ImageContentType;
  origin: "face" | "source" | "generated";
  embedding?: number[] | null;
  score?: number | null;
}): Promise<FaceRefRow> {
  const db = getDb();
  const existing = await db
    .select()
    .from(faceRefs)
    .where(
      and(eq(faceRefs.characterId, input.characterId), eq(faceRefs.angle, input.angle)),
    )
    .limit(1);

  if (existing[0]) {
    const [row] = await db
      .update(faceRefs)
      .set({
        key: input.key,
        contentType: input.contentType,
        origin: input.origin,
        embedding: input.embedding ?? null,
        score: input.score ?? null,
      })
      .where(eq(faceRefs.id, existing[0].id))
      .returning();
    if (!row) throw new Error("upsert face ref échoué");
    return row;
  }

  const [row] = await db
    .insert(faceRefs)
    .values({
      id: randomUUID(),
      characterId: input.characterId,
      ownerId: input.ownerId,
      angle: input.angle,
      key: input.key,
      contentType: input.contentType,
      origin: input.origin,
      embedding: input.embedding ?? null,
      score: input.score ?? null,
    })
    .returning();
  if (!row) throw new Error("insert face ref échoué");
  return row;
}
