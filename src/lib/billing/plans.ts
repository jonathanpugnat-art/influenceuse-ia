export type PlanId = "decouverte" | "starter" | "creator" | "agence";
export type PackId = "small" | "medium" | "large";

export type Plan = {
  id: PlanId;
  name: string;
  priceEur: number;
  creditsPerMonth: number;
  maxInfluencers: number;
  envPriceKeys: readonly string[];
};

export type CreditPack = {
  id: PackId;
  name: string;
  credits: number;
  priceEur: number;
  envPriceKeys: readonly string[];
};

/** Plans Ofmia — Découverte / Starter / Creator / Agence. */
export const PLANS: Record<PlanId, Plan> = {
  decouverte: {
    id: "decouverte",
    name: "Découverte",
    priceEur: 0,
    creditsPerMonth: 30,
    maxInfluencers: 1,
    envPriceKeys: [],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceEur: 29,
    creditsPerMonth: 500,
    maxInfluencers: 2,
    envPriceKeys: ["STRIPE_PRICE_STARTER", "STRIPE_STARTER_PRICE_ID"],
  },
  creator: {
    id: "creator",
    name: "Creator",
    priceEur: 79,
    creditsPerMonth: 1500,
    maxInfluencers: 5,
    envPriceKeys: ["STRIPE_PRICE_CREATOR", "STRIPE_PRO_PRICE_ID"],
  },
  agence: {
    id: "agence",
    name: "Agence",
    priceEur: 199,
    creditsPerMonth: 5000,
    maxInfluencers: 50,
    envPriceKeys: ["STRIPE_PRICE_AGENCE", "STRIPE_ENTERPRISE_PRICE_ID"],
  },
} as const;

export const PAID_PLANS: readonly Plan[] = [PLANS.starter, PLANS.creator, PLANS.agence];

export const CREDIT_PACKS: readonly CreditPack[] = [
  {
    id: "small",
    name: "Essai",
    credits: 100,
    priceEur: 9,
    envPriceKeys: ["STRIPE_PRICE_PACK_SMALL", "STRIPE_PACK_SMALL_PRICE_ID"],
  },
  {
    id: "medium",
    name: "Boost",
    credits: 500,
    priceEur: 39,
    envPriceKeys: ["STRIPE_PRICE_PACK_MEDIUM", "STRIPE_PACK_MEDIUM_PRICE_ID"],
  },
  {
    id: "large",
    name: "Stock",
    credits: 1500,
    priceEur: 99,
    envPriceKeys: ["STRIPE_PRICE_PACK_LARGE", "STRIPE_PACK_LARGE_PRICE_ID"],
  },
] as const;

export function planById(id: string): Plan | null {
  if (id in PLANS) return PLANS[id as PlanId];
  return null;
}

export function packById(id: string): CreditPack | null {
  return CREDIT_PACKS.find((pack) => pack.id === id) ?? null;
}

export function resolvePriceId(plan: Plan, env: NodeJS.ProcessEnv = process.env): string | null {
  for (const key of plan.envPriceKeys) {
    const value = env[key];
    if (value && value.length > 0) return value;
  }
  return null;
}

export function resolvePackPriceId(
  pack: CreditPack,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  for (const key of pack.envPriceKeys) {
    const value = env[key];
    if (value && value.length > 0) return value;
  }
  return null;
}

export function planFromPriceId(
  priceId: string,
  env: NodeJS.ProcessEnv = process.env,
): Plan | null {
  for (const plan of PAID_PLANS) {
    if (resolvePriceId(plan, env) === priceId) return plan;
  }
  return null;
}

export function packFromPriceId(
  priceId: string,
  env: NodeJS.ProcessEnv = process.env,
): CreditPack | null {
  for (const pack of CREDIT_PACKS) {
    if (resolvePackPriceId(pack, env) === priceId) return pack;
  }
  return null;
}

export function isPlanId(value: string): value is PlanId {
  return value in PLANS;
}

export function isPackId(value: string): value is PackId {
  return CREDIT_PACKS.some((pack) => pack.id === value);
}
