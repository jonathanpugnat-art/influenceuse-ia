import { and, avg, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/client";
import { characterLoras, characters, posts } from "@/lib/db/schema";
import { makeTriggerWord } from "@/lib/identity/lora";

export type CharacterLoraRow = typeof characterLoras.$inferSelect;

export async function getActiveLora(
  characterId: string,
  ownerId: string,
): Promise<CharacterLoraRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(characterLoras)
    .where(
      and(
        eq(characterLoras.characterId, characterId),
        eq(characterLoras.ownerId, ownerId),
        inArray(characterLoras.status, ["queued", "training", "validating", "ready"]),
      ),
    )
    .orderBy(desc(characterLoras.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function createLoraRecord(input: {
  characterId: string;
  ownerId: string;
  photoCount: number;
  jobId: string;
}): Promise<CharacterLoraRow> {
  const db = getDb();
  const [row] = await db
    .insert(characterLoras)
    .values({
      id: randomUUID(),
      characterId: input.characterId,
      ownerId: input.ownerId,
      status: "queued",
      triggerWord: makeTriggerWord(input.characterId),
      photoCount: input.photoCount,
      jobId: input.jobId,
    })
    .returning();
  if (!row) throw new Error("création LoRA échouée");
  return row;
}

export async function updateLora(
  id: string,
  patch: Partial<{
    status: CharacterLoraRow["status"];
    trainingId: string | null;
    replicateVersion: string | null;
    validationScore: number | null;
    errorCode: string | null;
    completedAt: Date | null;
  }>,
): Promise<void> {
  const db = getDb();
  await db.update(characterLoras).set(patch).where(eq(characterLoras.id, id));
}

export async function setCharacterLoraEnabled(
  characterId: string,
  ownerId: string,
  enabled: boolean,
): Promise<void> {
  const db = getDb();
  await db
    .update(characters)
    .set({ loraEnabled: enabled, updatedAt: new Date() })
    .where(and(eq(characters.id, characterId), eq(characters.ownerId, ownerId)));
}

/** Moyenne des scores identité réussis (baseline Kontext) pour valider un LoRA. */
export async function getCharacterIdentityBaseline(
  characterId: string,
): Promise<number | null> {
  const db = getDb();
  const rows = await db
    .select({ mean: avg(posts.identityScore) })
    .from(posts)
    .where(
      and(
        eq(posts.characterId, characterId),
        eq(posts.status, "succeeded"),
        eq(posts.mediaKind, "image"),
        isNotNull(posts.identityScore),
      ),
    );
  const mean = rows[0]?.mean;
  if (mean === null || mean === undefined) return null;
  const value = Number(mean);
  return Number.isFinite(value) ? value : null;
}
