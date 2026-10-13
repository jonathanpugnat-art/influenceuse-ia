import { describe, expect, it } from "vitest";

import {
  centroid,
  classifyScore,
  cosine,
  decideIdentityOutcome,
  l2normalize,
} from "@/lib/identity/similarity";

describe("identity similarity", () => {
  it("normalise et calcule un cosinus", () => {
    const a = l2normalize([3, 4]);
    const b = l2normalize([6, 8]);
    expect(cosine(a, b)).toBeCloseTo(1, 5);
    expect(cosine(l2normalize([1, 0]), l2normalize([0, 1]))).toBeCloseTo(0, 5);
  });

  it("calcule un centroïde L2", () => {
    const center = centroid([
      [1, 0],
      [0, 1],
    ]);
    expect(center[0]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(center[1]).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it("classifie les bandes avec seuils", () => {
    const thresholds = { pass: 0.7, warn: 0.55 };
    expect(classifyScore(0.8, thresholds)).toBe("fidele");
    expect(classifyScore(0.6, thresholds)).toBe("proche");
    expect(classifyScore(0.4, thresholds)).toBe("derive");
    expect(classifyScore(null, thresholds)).toBe("non_mesure");
  });

  it("décide retry seulement sur dérive et avant max", () => {
    expect(
      decideIdentityOutcome({ band: "derive", attempt: 0, maxRetries: 1 }),
    ).toBe("retry");
    expect(
      decideIdentityOutcome({ band: "derive", attempt: 1, maxRetries: 1 }),
    ).toBe("accept_best");
    expect(
      decideIdentityOutcome({ band: "fidele", attempt: 0, maxRetries: 1 }),
    ).toBe("accept");
  });
});
