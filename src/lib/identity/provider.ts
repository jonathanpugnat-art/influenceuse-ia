import { getEnv } from "@/lib/env";
import { l2normalize } from "@/lib/identity/similarity";
import { createPrediction, getPrediction, ReplicateError } from "@/lib/replicate/client";

export type FaceEmbedResult = {
  embedding: number[] | null;
  faces: number;
  kps?: [number, number][];
};

export type FaceEmbeddingProvider = {
  embed(imageUrl: string): Promise<FaceEmbedResult>;
};

const EXPECTED_DIM = 512;

export function parseEmbeddingOutput(output: unknown): FaceEmbedResult {
  if (!output) return { embedding: null, faces: 0 };

  if (Array.isArray(output) && output.every((value) => typeof value === "number")) {
    return finalize(output as number[], 1);
  }

  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (first && typeof first === "object") {
      return parseEmbeddingOutput(first);
    }
  }

  if (typeof output === "object" && output !== null) {
    const record = output as Record<string, unknown>;
    const embedding =
      (Array.isArray(record.embedding) && record.embedding) ||
      (Array.isArray(record.embedding_512) && record.embedding_512) ||
      (Array.isArray(record.vector) && record.vector) ||
      null;
    const faces =
      typeof record.faces === "number"
        ? record.faces
        : Array.isArray(record.faces)
          ? record.faces.length
          : embedding
            ? 1
            : 0;
    const kps = Array.isArray(record.kps) ? (record.kps as [number, number][]) : undefined;
    if (Array.isArray(embedding) && embedding.every((value) => typeof value === "number")) {
      return finalize(embedding as number[], faces, kps);
    }
  }

  return { embedding: null, faces: 0 };
}

function finalize(
  values: number[],
  faces: number,
  kps?: [number, number][],
): FaceEmbedResult {
  if (values.length !== EXPECTED_DIM || !values.every((value) => Number.isFinite(value))) {
    return { embedding: null, faces };
  }
  try {
    return { embedding: l2normalize(values), faces, kps };
  } catch {
    return { embedding: null, faces };
  }
}

export function createReplicateFaceEmbeddingProvider(
  model = getEnv().FACE_EMBED_MODEL,
): FaceEmbeddingProvider {
  if (!model) {
    throw new Error("FACE_EMBED_MODEL manquant");
  }
  return {
    async embed(imageUrl: string) {
      try {
        let prediction = await createPrediction({
          model,
          body: { image: imageUrl, input: imageUrl },
          waitSeconds: 60,
        });
        for (let i = 0; i < 20 && prediction.status !== "succeeded"; i += 1) {
          if (
            prediction.status === "failed" ||
            prediction.status === "canceled" ||
            !prediction.id
          ) {
            return { embedding: null, faces: 0 };
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
          prediction = await getPrediction(prediction.id);
        }
        if (prediction.status !== "succeeded") {
          return { embedding: null, faces: 0 };
        }
        return parseEmbeddingOutput(prediction.output);
      } catch (error) {
        if (error instanceof ReplicateError) {
          console.error("face embed failed", error.code);
          return { embedding: null, faces: 0 };
        }
        throw error;
      }
    },
  };
}

let cached: FaceEmbeddingProvider | null = null;

export function getFaceEmbeddingProvider(): FaceEmbeddingProvider {
  if (!cached) cached = createReplicateFaceEmbeddingProvider();
  return cached;
}

export function setFaceEmbeddingProviderForTests(provider: FaceEmbeddingProvider | null): void {
  cached = provider;
}
