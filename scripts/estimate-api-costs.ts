/**
 * Estime la facture API (Replicate / GPU) à partir des jobs en base.
 *
 * Usage:
 *   tsx scripts/estimate-api-costs.ts
 *   tsx scripts/estimate-api-costs.ts --days 30
 *   tsx scripts/estimate-api-costs.ts --days 7 --plan PRO
 *
 * Requires DATABASE_URL in .env
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  API_UNIT_COST_USD,
  computeSelfHostBreakEven,
  creditPackRevenuePerCreditEur,
  estimateApiCostUsd,
  estimateMarginOnCredits,
  EUR_TO_USD,
  getPlanCreditEconomics,
  type GenerationVolume,
} from "../src/lib/premium-unit-economics";
import type { Plan } from "../src/generated/prisma/client";

function parseArgs(): { days: number; plan: Plan } {
  const args = process.argv.slice(2);
  let days = 30;
  let plan: Plan = "PRO";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      days = Math.max(1, Number(args[i + 1]) || 30);
      i++;
    } else if (args[i] === "--plan" && args[i + 1]) {
      plan = args[i + 1]!.toUpperCase() as Plan;
      i++;
    }
  }

  return { days, plan };
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtEur(n: number): string {
  return `${n.toFixed(2)} €`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

async function main() {
  const { days, plan } = parseArgs();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  try {
    const [imageJobs, videoJobs, baseJobs, identityJobs, proUsers] =
      await Promise.all([
        db.generationJob.findMany({
          where: {
            type: "IMAGE",
            createdAt: { gte: since },
          },
          select: {
            status: true,
            creditsUsed: true,
            contentId: true,
          },
        }),
        db.generationJob.findMany({
          where: {
            type: "VIDEO",
            status: "COMPLETED",
            createdAt: { gte: since },
          },
          select: { creditsUsed: true },
        }),
        db.generationJob.findMany({
          where: {
            type: "BASE_IMAGE",
            status: "COMPLETED",
            createdAt: { gte: since },
          },
          select: { creditsUsed: true },
        }),
        db.generationJob.count({
          where: {
            type: "IMAGE",
            status: "COMPLETED",
            createdAt: { gte: since },
            creditsUsed: { gte: 3 },
          },
        }),
        db.user.count({ where: { plan: { in: ["PRO", "ENTERPRISE"] } } }),
      ]);

    const contentIds = imageJobs
      .map((j) => j.contentId)
      .filter((id): id is string => Boolean(id));

    const contents =
      contentIds.length > 0
        ? await db.content.findMany({
            where: { id: { in: contentIds } },
            select: {
              id: true,
              contentMode: true,
              status: true,
              generationParams: true,
            },
          })
        : [];

    const contentById = new Map(contents.map((c) => [c.id, c]));

    let photoSfw = 0;
    let photoPremium = 0;
    let failedImageJobs = 0;
    let premiumRetriesEstimate = 0;
    let creditsConsumed = 0;

    for (const job of imageJobs) {
      if (job.status === "FAILED") {
        failedImageJobs++;
        creditsConsumed += job.creditsUsed * 0.5;
        continue;
      }
      if (job.status !== "COMPLETED") continue;

      creditsConsumed += job.creditsUsed;

      const content = job.contentId
        ? contentById.get(job.contentId)
        : undefined;
      const params = content?.generationParams as Record<string, unknown> | null;
      const mode =
        content?.contentMode ??
        (params?.contentMode === "NSFW" ? "NSFW" : "SFW");

      if (mode === "NSFW") {
        photoPremium++;
        if (params?.promptWasSoftened === true) {
          premiumRetriesEstimate++;
        }
      } else {
        photoSfw++;
      }
    }

    for (const j of videoJobs) creditsConsumed += j.creditsUsed;
    for (const j of baseJobs) creditsConsumed += j.creditsUsed;

    const volume: GenerationVolume = {
      photoSfw,
      photoPremium,
      reel: videoJobs.length,
      baseImage: baseJobs.length,
      identityPack: identityJobs,
      scenePlate: 0,
      failedImageJobs,
      premiumRetriesEstimate,
    };

    const replicateEst = estimateApiCostUsd(volume, {
      premiumProvider: "replicate",
    });
    const selfHostEst = estimateApiCostUsd(volume, {
      premiumProvider: "selfhost",
    });
    const breakEven = computeSelfHostBreakEven({ monthlyGpuFixedUsd: 0 });
    const monthlyPremiumProjection = Math.round(
      (photoPremium / days) * 30
    );
    const margin = estimateMarginOnCredits({
      creditsConsumed,
      apiCostUsd: replicateEst.totalUsd,
      plan,
    });

    const planEconomics = getPlanCreditEconomics();

    console.log("\n═══════════════════════════════════════════════════");
    console.log("  Aura — estimation coûts API & seuil self-host");
    console.log("═══════════════════════════════════════════════════\n");
    console.log(`Période analysée     : ${days} derniers jours (depuis ${since.toISOString().slice(0, 10)})`);
    console.log(`Users Pro + Agency   : ${proUsers}`);
    console.log("");

    console.log("── Volume générations (jobs complétés) ──");
    console.log(`  Photos Social (SFW)     : ${photoSfw}`);
    console.log(`  Photos Premium (NSFW)   : ${photoPremium}`);
    console.log(`  Retries Premium (est.)  : ${premiumRetriesEstimate}`);
    console.log(`  Reels                   : ${videoJobs.length}`);
    console.log(`  Portraits wizard        : ${baseJobs.length}`);
    console.log(`  Jobs image échoués      : ${failedImageJobs}`);
    console.log(`  Crédits consommés (est.): ${creditsConsumed.toFixed(1)}`);
    console.log("");

    console.log("── Coût API estimé (USD) — hypothèses unitaires ──");
    console.log(`  Photo SFW               : ${fmtUsd(API_UNIT_COST_USD.photoSfw)} / image`);
    console.log(`  Photo Premium Replicate : ${fmtUsd(API_UNIT_COST_USD.photoPremiumReplicate)} / image`);
    console.log(`  Photo Premium self-host : ${fmtUsd(API_UNIT_COST_USD.photoPremiumSelfHost)} / image`);
    console.log(`  Reel                    : ${fmtUsd(API_UNIT_COST_USD.reel)} / clip`);
    console.log("");
    console.log(`  Total Replicate (est.)  : ${fmtUsd(replicateEst.totalUsd)}`);
    console.log(`  Total self-host (est.)  : ${fmtUsd(selfHostEst.totalUsd)}`);
    console.log(
      `  Économie potentielle    : ${fmtUsd(replicateEst.totalUsd - selfHostEst.totalUsd)} / période`
    );
    console.log("");

    console.log("── Marge brute (plan " + plan + ", crédits consommés) ──");
    console.log(`  Revenu crédits (est.)   : ${fmtEur(margin.revenueEur)} (~${fmtUsd(margin.revenueUsd)})`);
    console.log(`  Coût API (est.)         : ${fmtUsd(margin.apiCostUsd)}`);
    console.log(`  Marge brute (est.)      : ${fmtEur(margin.grossMarginEur)} (${pct(margin.grossMarginPct)})`);
    console.log(
      `  Pack crédits (meilleure marge) : ${(creditPackRevenuePerCreditEur() * 100).toFixed(1)} c€ / crédit`
    );
    console.log("");

    console.log("── Revenu par crédit abonnement ──");
    for (const p of planEconomics) {
      console.log(
        `  ${p.plan.padEnd(12)} ${String(p.priceEur).padStart(3)} € / ${p.creditsIncluded} cr → ${(p.revenuePerCreditEur * 100).toFixed(2)} c€ (${(p.revenuePerCreditUsd * 100).toFixed(2)} c$)`
      );
    }
    console.log("");

    console.log("── Seuil self-host (RunPod / ComfyUI) ──");
    console.log(`  Coût Replicate / photo  : ${fmtUsd(breakEven.replicateCostPerPhotoUsd)}`);
    console.log(`  Coût GPU / photo (est.) : ${fmtUsd(breakEven.selfHostCostPerPhotoUsd)}`);
    console.log(`  Économie / photo        : ${fmtUsd(breakEven.savingsPerPhotoUsd)}`);
    console.log(`  Premium ce mois (proj.) : ~${monthlyPremiumProjection} photos`);
    console.log(`  Seuil break-even        : ~${breakEven.minPremiumPhotosPerMonth} photos Premium/mois`);
    console.log(`  Recommandation          : ${breakEven.recommendation.toUpperCase()}`);
    console.log(`  → ${breakEven.reasonFr}`);
    console.log("");

    if (monthlyPremiumProjection >= breakEven.minPremiumPhotosPerMonth) {
      console.log("  ✅ Volume suffisant — envisage PREMIUM_SELFHOST_URL + RunPod.");
    } else {
      console.log(
        `  💡 Reste sur Replicate — ~${monthlyPremiumProjection} photos Premium/mois (seuil ~${breakEven.minPremiumPhotosPerMonth}).`
      );
    }

    console.log("\n── Actions rentables maintenant ──");
    console.log("  1. PREMIUM_IMAGE_MODERATION=off (évite double génération)");
    console.log("  2. Pousser les packs crédits (marge ~7,8 c€/cr vs ~5,3 c€ abo Pro)");
    console.log("  3. Reels = 8 crédits — ne pas baisser (protège la marge)");
    if (photoPremium > 0) {
      console.log(
        `  4. Facture Replicate réelle : compare dashboard Replicate vs ${fmtUsd(replicateEst.totalUsd)} estimé`
      );
    }
    console.log("");

    const annualizedApi = (replicateEst.totalUsd / days) * 30;
    console.log(`Projection coût API Replicate : ~${fmtUsd(annualizedApi)}/mois (extrapolation linéaire)`);
    console.log("");
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
