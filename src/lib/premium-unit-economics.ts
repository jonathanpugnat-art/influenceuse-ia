/**
 * Unit economics for Premium / API cost estimation and self-host break-even.
 * Amounts in USD unless noted. EUR uses approximate FX for margin display.
 */

import { CREDIT_COSTS, PLANS } from "@/lib/constants";

export const EUR_TO_USD = 1.08;

/** Reference API cost per successful generation (USD, 2026-06). */
export const API_UNIT_COST_USD = {
  photoSfw: 0.035,
  photoPremiumReplicate: 0.056,
  photoPremiumSelfHost: 0.025,
  photoPremiumTogether: 0.04,
  reel: 0.35,
  baseImage: 0.12,
  identityPack: 0.12,
  scenePlate: 0.03,
  caption: 0.001,
  trendAnalysis: 0.002,
  sightenginePerImage: 0.002,
} as const;

/** Default RunPod RTX 4090 spot-ish hourly rate for break-even math. */
export const DEFAULT_GPU_HOURLY_USD = 0.45;

/** Realistic sustained throughput on a single GPU (ComfyUI / FLUX). */
export const DEFAULT_IMAGES_PER_GPU_HOUR = 18;

export type GenerationVolume = {
  photoSfw: number;
  photoPremium: number;
  reel: number;
  baseImage: number;
  identityPack: number;
  scenePlate: number;
  failedImageJobs: number;
  /** Premium photos that needed a retry (softened prompt, etc.). */
  premiumRetriesEstimate: number;
};

export type ApiCostEstimate = {
  totalUsd: number;
  byCategory: Record<string, number>;
  premiumPhotoCount: number;
  avgCostPerPremiumPhotoUsd: number;
};

export type SelfHostBreakEven = {
  replicateCostPerPhotoUsd: number;
  selfHostCostPerPhotoUsd: number;
  savingsPerPhotoUsd: number;
  minPremiumPhotosPerMonth: number;
  recommendation: "replicate" | "selfhost" | "either";
  reasonFr: string;
};

export type PlanCreditEconomics = {
  plan: keyof typeof PLANS;
  priceEur: number;
  creditsIncluded: number;
  revenuePerCreditEur: number;
  revenuePerCreditUsd: number;
};

export function getPlanCreditEconomics(): PlanCreditEconomics[] {
  return (Object.keys(PLANS) as Array<keyof typeof PLANS>)
    .filter((p) => PLANS[p].price > 0)
    .map((plan) => {
      const cfg = PLANS[plan];
      const revenuePerCreditEur = cfg.price / cfg.credits;
      return {
        plan,
        priceEur: cfg.price,
        creditsIncluded: cfg.credits,
        revenuePerCreditEur,
        revenuePerCreditUsd: revenuePerCreditEur * EUR_TO_USD,
      };
    });
}

/** Revenue per credit if user buys the medium pack (best add-on margin). */
export function creditPackRevenuePerCreditEur(): number {
  return 39 / 500;
}

export function estimateApiCostUsd(
  volume: GenerationVolume,
  opts?: {
    premiumProvider?: "replicate" | "selfhost" | "together";
    includeSightengine?: boolean;
    failedJobCostFactor?: number;
  }
): ApiCostEstimate {
  const premiumProvider = opts?.premiumProvider ?? "replicate";
  const premiumUnit =
    premiumProvider === "selfhost"
      ? API_UNIT_COST_USD.photoPremiumSelfHost
      : premiumProvider === "together"
        ? API_UNIT_COST_USD.photoPremiumTogether
        : API_UNIT_COST_USD.photoPremiumReplicate;

  const failedFactor = opts?.failedJobCostFactor ?? 0.35;

  const byCategory: Record<string, number> = {
    photoSfw: volume.photoSfw * API_UNIT_COST_USD.photoSfw,
    photoPremium: volume.photoPremium * premiumUnit,
    premiumRetries:
      volume.premiumRetriesEstimate * premiumUnit * 0.85,
    reel: volume.reel * API_UNIT_COST_USD.reel,
    baseImage: volume.baseImage * API_UNIT_COST_USD.baseImage,
    identityPack: volume.identityPack * API_UNIT_COST_USD.identityPack,
    scenePlate: volume.scenePlate * API_UNIT_COST_USD.scenePlate,
    failedJobs:
      volume.failedImageJobs * API_UNIT_COST_USD.photoSfw * failedFactor,
  };

  if (opts?.includeSightengine) {
    byCategory.sightengine =
      volume.photoPremium * API_UNIT_COST_USD.sightenginePerImage;
  }

  const totalUsd = Object.values(byCategory).reduce((a, b) => a + b, 0);
  const premiumPhotoCount =
    volume.photoPremium + volume.premiumRetriesEstimate;

  return {
    totalUsd,
    byCategory,
    premiumPhotoCount,
    avgCostPerPremiumPhotoUsd:
      premiumPhotoCount > 0
        ? (byCategory.photoPremium + (byCategory.premiumRetries ?? 0)) /
          premiumPhotoCount
        : premiumUnit,
  };
}

export function computeSelfHostBreakEven(opts?: {
  replicateCostPerPhotoUsd?: number;
  gpuHourlyUsd?: number;
  imagesPerGpuHour?: number;
  monthlyGpuFixedUsd?: number;
  /** Minimum monthly premium volume before even considering self-host. */
  minVolumeThreshold?: number;
}): SelfHostBreakEven {
  const replicateCostPerPhotoUsd =
    opts?.replicateCostPerPhotoUsd ?? API_UNIT_COST_USD.photoPremiumReplicate;
  const gpuHourlyUsd = opts?.gpuHourlyUsd ?? DEFAULT_GPU_HOURLY_USD;
  const imagesPerGpuHour = opts?.imagesPerGpuHour ?? DEFAULT_IMAGES_PER_GPU_HOUR;
  const monthlyGpuFixedUsd = opts?.monthlyGpuFixedUsd ?? 0;
  const minVolumeThreshold = opts?.minVolumeThreshold ?? 250;

  const selfHostCostPerPhotoUsd = gpuHourlyUsd / imagesPerGpuHour;
  const savingsPerPhotoUsd = replicateCostPerPhotoUsd - selfHostCostPerPhotoUsd;

  if (savingsPerPhotoUsd <= 0) {
    return {
      replicateCostPerPhotoUsd,
      selfHostCostPerPhotoUsd,
      savingsPerPhotoUsd: 0,
      minPremiumPhotosPerMonth: Infinity,
      recommendation: "replicate",
      reasonFr:
        "Replicate est déjà moins cher que le GPU au débit actuel — reste sur Replicate.",
    };
  }

  const minPremiumPhotosPerMonth =
    monthlyGpuFixedUsd > 0
      ? Math.ceil(monthlyGpuFixedUsd / savingsPerPhotoUsd)
      : minVolumeThreshold;

  let recommendation: SelfHostBreakEven["recommendation"] = "replicate";
  let reasonFr = `Tant que tu restes sous ~${minVolumeThreshold} photos Premium/mois, Replicate évite l'infra fixe (zéro coût fixe GPU).`;

  if (monthlyGpuFixedUsd > 0 && minPremiumPhotosPerMonth <= minVolumeThreshold) {
    recommendation = "either";
    reasonFr = `Avec un GPU fixe (~$${monthlyGpuFixedUsd}/mois), le seuil est ~${minPremiumPhotosPerMonth} photos Premium/mois.`;
  }

  return {
    replicateCostPerPhotoUsd,
    selfHostCostPerPhotoUsd,
    savingsPerPhotoUsd,
    minPremiumPhotosPerMonth,
    recommendation,
    reasonFr,
  };
}

/** Estimated gross margin on consumed credits (Pro plan baseline). */
export function estimateMarginOnCredits(opts: {
  creditsConsumed: number;
  apiCostUsd: number;
  plan?: keyof typeof PLANS;
}): {
  revenueEur: number;
  revenueUsd: number;
  apiCostUsd: number;
  grossMarginEur: number;
  grossMarginPct: number;
} {
  const plan = opts.plan ?? "PRO";
  const planCfg = PLANS[plan];
  const revenuePerCreditEur = planCfg.price / planCfg.credits;
  const revenueEur = opts.creditsConsumed * revenuePerCreditEur;
  const revenueUsd = revenueEur * EUR_TO_USD;
  const grossMarginEur = revenueEur - opts.apiCostUsd / EUR_TO_USD;
  const grossMarginPct =
    revenueEur > 0 ? (grossMarginEur / revenueEur) * 100 : 0;

  return {
    revenueEur,
    revenueUsd,
    apiCostUsd: opts.apiCostUsd,
    grossMarginEur,
    grossMarginPct,
  };
}

export function creditsFromJobs(jobs: Array<{ creditsUsed: number }>): number {
  return jobs.reduce((sum, j) => sum + j.creditsUsed, 0);
}

export function photoCreditCost(): number {
  return CREDIT_COSTS.PHOTO;
}

export function reelCreditCost(): number {
  return CREDIT_COSTS.REEL;
}
