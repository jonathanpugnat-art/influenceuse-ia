import { describe, expect, it } from "vitest";

import { parseEmbeddingOutput } from "@/lib/identity/provider";

function vector(seed = 1): number[] {
  return Array.from({ length: 512 }, (_, index) => ((index + seed) % 17) / 17);
}

describe("parseEmbeddingOutput", () => {
  it("accepte un vecteur 512 plat", () => {
    const result = parseEmbeddingOutput(vector());
    expect(result.faces).toBe(1);
    expect(result.embedding).toHaveLength(512);
  });

  it("accepte { embedding }", () => {
    const result = parseEmbeddingOutput({ embedding: vector(2), faces: 1 });
    expect(result.embedding).toHaveLength(512);
    expect(result.faces).toBe(1);
  });

  it("rejette une mauvaise dimension", () => {
    expect(parseEmbeddingOutput([1, 2, 3]).embedding).toBeNull();
  });
});
