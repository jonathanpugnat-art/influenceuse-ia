import type { IdentityStatus } from "@/lib/db/schema";

export type ScoreBand = Exclude<IdentityStatus, "pending">;

export type IdentityThresholds = {
  pass: number;
  warn: number;
};

export function l2normalize(values: number[]): number[] {
  let sumSquares = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) throw new Error("embedding non fini");
    sumSquares += value * value;
  }
  const norm = Math.sqrt(sumSquares);
  if (norm === 0) throw new Error("embedding nul");
  return values.map((value) => value / norm);
}

export function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) {
    throw new Error("dimensions embedding incompatibles");
  }
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return Math.max(-1, Math.min(1, dot));
}

export function centroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) throw new Error("aucun embedding");
  const dim = embeddings[0]?.length ?? 0;
  if (dim === 0) throw new Error("embedding vide");
  const sums = new Array<number>(dim).fill(0);
  for (const embedding of embeddings) {
    if (embedding.length !== dim) throw new Error("dimensions embedding incompatibles");
    const normalized = l2normalize(embedding);
    for (let i = 0; i < dim; i += 1) {
      sums[i] = (sums[i] ?? 0) + (normalized[i] ?? 0);
    }
  }
  return l2normalize(sums.map((value) => value / embeddings.length));
}

export function classifyScore(
  score: number | null,
  thresholds: IdentityThresholds,
): ScoreBand {
  if (score === null || !Number.isFinite(score)) return "non_mesure";
  if (score >= thresholds.pass) return "fidele";
  if (score >= thresholds.warn) return "proche";
  return "derive";
}

export type IdentityDecision = "accept" | "retry" | "accept_best";

export function decideIdentityOutcome(input: {
  band: ScoreBand;
  attempt: number;
  maxRetries: number;
}): IdentityDecision {
  switch (input.band) {
    case "fidele":
    case "proche":
    case "non_mesure":
      return "accept";
    case "derive":
      if (input.attempt < input.maxRetries) return "retry";
      return "accept_best";
    default: {
      const exhaustive: never = input.band;
      return exhaustive;
    }
  }
}
