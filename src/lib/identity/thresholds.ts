import type { IdentityThresholds } from "@/lib/identity/similarity";

export const DEFAULT_IDENTITY_THRESHOLDS: IdentityThresholds = {
  pass: 0.7,
  warn: 0.55,
};

export const DEFAULT_IDENTITY_AUTO_RETRY_MAX = 1;

export function parseIdentityThresholds(input: {
  pass?: number;
  warn?: number;
}): IdentityThresholds {
  const pass = input.pass ?? DEFAULT_IDENTITY_THRESHOLDS.pass;
  const warn = input.warn ?? DEFAULT_IDENTITY_THRESHOLDS.warn;
  if (!(pass > 0 && pass <= 1 && warn >= 0 && warn < pass)) {
    throw new Error("seuils identité invalides (0 ≤ warn < pass ≤ 1)");
  }
  return { pass, warn };
}
