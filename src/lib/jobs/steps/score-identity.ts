import { eq } from "drizzle-orm";

import { getBlobStore } from "@/lib/blob";
import { getDb } from "@/lib/db/client";
import { characters } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { getFaceEmbeddingProvider } from "@/lib/identity/provider";
import {
  classifyScore,
  cosine,
  type ScoreBand,
} from "@/lib/identity/similarity";
import { setCharacterIdentity } from "@/lib/repositories/db/characters";

export type IdentityScoreResult = {
  score: number | null;
  status: ScoreBand;
  model: string | null;
};

export async function ensureCharacterCentroid(input: {
  characterId: string;
  faceImageUrl: string;
}): Promise<number[] | null> {
  const db = getDb();
  const rows = await db
    .select({
      embedding: characters.identityEmbedding,
      model: characters.identityModel,
    })
    .from(characters)
    .where(eq(characters.id, input.characterId))
    .limit(1);
  const existing = rows[0]?.embedding;
  if (Array.isArray(existing) && existing.length > 0) {
    return existing;
  }

  const env = getEnv();
  if (!env.IDENTITY_SCORING_ENABLED || !env.FACE_EMBED_MODEL) return null;

  const provider = getFaceEmbeddingProvider();
  const result = await provider.embed(input.faceImageUrl);
  if (!result.embedding) return null;

  await setCharacterIdentity({
    characterId: input.characterId,
    embedding: result.embedding,
    model: env.FACE_EMBED_MODEL,
  });
  return result.embedding;
}

export async function scoreOutputAgainstCentroid(input: {
  imageKey: string;
  centroid: number[] | null;
}): Promise<IdentityScoreResult> {
  const env = getEnv();
  if (!env.IDENTITY_SCORING_ENABLED || !env.FACE_EMBED_MODEL || !input.centroid) {
    return { score: null, status: "non_mesure", model: null };
  }

  try {
    const url = await getBlobStore().presignGet(input.imageKey, { expiresInSeconds: 600 });
    const provider = getFaceEmbeddingProvider();
    const result = await provider.embed(url);
    if (!result.embedding) {
      return { score: null, status: "non_mesure", model: env.FACE_EMBED_MODEL };
    }
    const score = cosine(input.centroid, result.embedding);
    const status = classifyScore(score, {
      pass: env.IDENTITY_SCORE_PASS,
      warn: env.IDENTITY_SCORE_WARN,
    });
    return { score, status, model: env.FACE_EMBED_MODEL };
  } catch (error) {
    console.error("identity score failed", error instanceof Error ? error.message : error);
    return { score: null, status: "non_mesure", model: env.FACE_EMBED_MODEL };
  }
}
