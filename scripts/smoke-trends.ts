/**
 * Smoke test trends pipeline — run after Apify is reconnected.
 *
 * Automated: env, fetch, DB health, per-niche feeds, formatBrief coverage.
 * Manual: prints UI checklist for photo + reel studio flows.
 *
 * Usage:
 *   npm run trends:smoke
 *   npm run trends:smoke -- --skip-fetch    # validate DB/feed only
 *   TRENDS_FORMAT_ANALYZE_LIMIT=10 npm run trends:smoke
 */

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma, type Niche } from "../src/generated/prisma/client";
import {
  analyzeTopTrendsFormat,
  getFeedForInfluencer,
  getGlobalTrendFeed,
  resolveTrendCreatorTarget,
  runTrendsFetch,
} from "../src/server/services/trends.service";
import { resolveTrendsProvider } from "../src/server/services/trend-provider";
import { parseTrendFormatBrief } from "../src/lib/trends/trend-format-brief";

const SMOKE_NICHES: Niche[] = ["FITNESS", "FASHION", "TRAVEL", "LIFESTYLE"];
const FRESH_HOURS = 72;

type Check = {
  id: string;
  ok: boolean;
  detail: string;
  critical: boolean;
};

function pass(id: string, detail: string, critical = true): Check {
  return { id, ok: true, detail, critical };
}

function fail(id: string, detail: string, critical = true): Check {
  return { id, ok: false, detail, critical };
}

function parseArgs(): { skipFetch: boolean } {
  return { skipFetch: process.argv.includes("--skip-fetch") };
}

function printChecks(checks: Check[]) {
  console.log("\n=== Résultats automatisés ===\n");
  for (const c of checks) {
    const icon = c.ok ? "✅" : c.critical ? "❌" : "⚠️";
    console.log(`${icon} [${c.id}] ${c.detail}`);
  }
  const criticalFails = checks.filter((c) => c.critical && !c.ok);
  const warnings = checks.filter((c) => !c.critical && !c.ok);
  console.log(
    `\n${checks.filter((c) => c.ok).length}/${checks.length} OK` +
      (warnings.length ? ` · ${warnings.length} avertissement(s)` : "") +
      (criticalFails.length ? ` · ${criticalFails.length} échec(s) bloquant(s)` : "")
  );
}

function printManualChecklist(baseUrl: string) {
  console.log(`
=== Checklist manuelle UI (5–10 min) ===

Prérequis : compte Pro (ou Agency), au moins 2 influenceuses (ex. FITNESS + FASHION).

1. Trends — feed live
   → ${baseUrl}/trends
   □ Sélectionner influenceuse FITNESS → cartes visibles (pas vide)
   □ Changer pour FASHION → feed différent (niche filtrée)
   □ Une carte a une miniature / preview vidéo (pas gradient seul)

2. Analyse format (si pas de formatBrief sur une carte)
   □ Cliquer « Analyser le format » sur 1 carte vidéo
   □ Toast succès + section scène / hook remplie

3. Personnalisation
   □ « Personnaliser » sur 1 carte → hook adapté au nom de l'influenceuse
   □ Crédits déduits (si plan payant)

4. Studio PHOTO
   □ « Créer du contenu » sur trend PHOTO
   □ URL contient trendItemId ou recommendationId
   □ Studio prérempli : scène, tenue, hook
   □ Générer 1 image → visage cohérent, scène proche du brief

5. Studio REEL (carte vidéo / format REEL)
   □ « Créer du contenu » sur trend reel
   □ /content/reel?influencer=…&trendItemId=…
   □ Script + scène + musique préremplis
   □ (Optionnel) motion source si MP4 dispo → générer reel

6. Agent trends
   □ Ouvrir panneau agent → demander « top trends fitness »
   □ Clic choix « Ouvrir photo/reel · … » → bon studio

7. Deep link direct
   □ Copier un trendItemId depuis la DB ou la carte
   □ ${baseUrl}/content/photo?influencer=ID&trendItemId=ID
   □ Studio hydraté au chargement

Coche tout ✅ → pipeline trends prod-ready.
`);
}

async function main() {
  const { skipFetch } = parseArgs();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const checks: Check[] = [];

  console.log("=== Smoke test Trends (post-Apify) ===\n");

  const provider = resolveTrendsProvider();
  if (!process.env.APIFY_TOKEN?.trim()) {
    checks.push(
      fail("env-apify-token", "APIFY_TOKEN manquant dans .env", true)
    );
  } else {
    checks.push(pass("env-apify-token", "APIFY_TOKEN présent"));
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    checks.push(
      fail("env-anthropic", "ANTHROPIC_API_KEY manquant (vision formatBrief)", false)
    );
  } else {
    checks.push(pass("env-anthropic", "ANTHROPIC_API_KEY présent"));
  }

  if (!process.env.DATABASE_URL?.trim()) {
    checks.push(fail("env-db", "DATABASE_URL manquant", true));
    printChecks(checks);
    process.exit(1);
  }

  checks.push(
    provider?.id === "apify"
      ? pass("provider", `Provider actif : apify`)
      : provider
        ? fail("provider", `Provider = ${provider.id} (attendu apify si token set)`, false)
        : fail("provider", "Aucun provider trends configuré", true)
  );

  let fetchResult: Awaited<ReturnType<typeof runTrendsFetch>> | null = null;
  if (!skipFetch) {
    console.log("Fetch Apify (force)…");
    try {
      fetchResult = await runTrendsFetch({ force: true });
      const created = fetchResult.itemsCreated ?? 0;
      const refreshed = fetchResult.itemsRefreshed ?? 0;
      const skipped = fetchResult.skipped;

      if (skipped?.includes("hard limit") || skipped?.includes("403")) {
        checks.push(
          fail(
            "apify-fetch",
            `Apify bloqué : ${skipped} — relever le hard limit Console`,
            true
          )
        );
      } else if (created + refreshed > 0) {
        checks.push(
          pass(
            "apify-fetch",
            `Fetch OK — created=${created} refreshed=${refreshed} analyzed=${fetchResult.formatsAnalyzed ?? 0}`
          )
        );
      } else if (skipped) {
        checks.push(
          fail(
            "apify-fetch",
            `Fetch sans nouveaux items (skipped=${skipped})`,
            false
          )
        );
      } else {
        checks.push(fail("apify-fetch", "Fetch vide (empty-feed)", true));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      checks.push(
        fail(
          "apify-fetch",
          `Fetch échoué : ${msg.slice(0, 200)}`,
          msg.includes("hard limit") || msg.includes("403")
        )
      );
    }
  } else {
    checks.push(
      pass("apify-fetch", "Fetch ignoré (--skip-fetch)", false)
    );
  }

  const analyzeLimit = (() => {
    const raw = Number(process.env.TRENDS_FORMAT_ANALYZE_LIMIT);
    if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return 10;
  })();

  if ((fetchResult?.formatsAnalyzed ?? 0) < analyzeLimit) {
    const extra = await analyzeTopTrendsFormat(
      analyzeLimit - (fetchResult?.formatsAnalyzed ?? 0)
    );
    if (extra > 0) {
      checks.push(pass("vision-batch", `${extra} formatBrief analysés ce run`));
    }
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const freshSince = new Date(Date.now() - FRESH_HOURS * 3600 * 1000);

    const [freshCount, withBrief, videoWithThumb, apifySnapshots] =
      await Promise.all([
        prisma.trendItem.count({
          where: { fetchedAt: { gte: freshSince }, isNsfw: false },
        }),
        prisma.trendItem.count({
          where: {
            fetchedAt: { gte: freshSince },
            formatBrief: { not: Prisma.DbNull },
          },
        }),
        prisma.trendItem.count({
          where: {
            fetchedAt: { gte: freshSince },
            mediaKind: "video",
            thumbnailUrl: { not: null },
          },
        }),
        prisma.trendSnapshot.count({
          where: {
            provider: "apify",
            fetchedAt: { gte: new Date(Date.now() - 48 * 3600 * 1000) },
          },
        }),
      ]);

    checks.push(
      freshCount >= 10
        ? pass("db-fresh-items", `${freshCount} items frais (${FRESH_HOURS}h)`)
        : fail("db-fresh-items", `Seulement ${freshCount} items frais (min 10)`, true)
    );

    const briefPct =
      freshCount > 0 ? Math.round((withBrief / freshCount) * 100) : 0;
    checks.push(
      briefPct >= 15
        ? pass("db-format-brief", `${withBrief}/${freshCount} avec formatBrief (${briefPct}%)`)
        : fail(
            "db-format-brief",
            `formatBrief faible : ${withBrief}/${freshCount} (${briefPct}%, cible ≥15%)`,
            false
          )
    );

    checks.push(
      videoWithThumb >= 3
        ? pass("db-video-thumbs", `${videoWithThumb} vidéos avec thumbnail`)
        : fail(
            "db-video-thumbs",
            `${videoWithThumb} vidéos avec thumbnail (min 3)`,
            false
          )
    );

    if (!skipFetch) {
      checks.push(
        apifySnapshots >= 1
          ? pass("db-apify-snapshots", `${apifySnapshots} snapshot(s) Apify < 48h`)
          : fail(
              "db-apify-snapshots",
              "Aucun snapshot Apify récent — fetch probablement en échec",
              false
            )
      );
    }

    const global = await getGlobalTrendFeed({
      limit: 15,
      userPlan: "PRO",
      isNsfw: false,
    });
    checks.push(
      global.items.length >= 5
        ? pass("feed-global", `Feed global : ${global.items.length} cartes`)
        : fail("feed-global", `Feed global faible : ${global.items.length} cartes`, true)
    );

    let nichesOk = 0;
    let nichesWithInfluencer = 0;
    const nicheSamples: string[] = [];

    for (const niche of SMOKE_NICHES) {
      const influencer = await prisma.influencer.findFirst({
        where: { niche, isNsfw: false, status: "ACTIVE" },
        include: { user: { select: { plan: true, locale: true } } },
        orderBy: { updatedAt: "desc" },
      });

      if (!influencer) {
        nicheSamples.push(`${niche}: (aucune influenceuse active)`);
        continue;
      }

      nichesWithInfluencer += 1;

      const { items } = await getFeedForInfluencer(influencer, {
        limit: 10,
        userPlan: influencer.user.plan,
        userLocale: influencer.user.locale,
      });

      const withVision = items.filter((i) => {
        const b = parseTrendFormatBrief(i.formatBrief);
        return b?.analyzedFrom === "vision";
      }).length;

      const reelTargets = items.filter(
        (i) => resolveTrendCreatorTarget(i) === "reel"
      ).length;

      nicheSamples.push(
        `${niche} (${influencer.name}): ${items.length} cartes, ${withVision} vision, ${reelTargets} reel`
      );

      if (items.length >= 3) nichesOk += 1;
    }

    const nicheTarget = Math.min(2, Math.max(1, nichesWithInfluencer));
    checks.push(
      nichesOk >= nicheTarget
        ? pass(
            "feed-niches",
            `${nichesOk}/${nichesWithInfluencer} influenceuse(s) active(s) avec ≥3 cartes`
          )
        : fail(
            "feed-niches",
            `${nichesOk}/${nichesWithInfluencer} OK (cible ${nicheTarget}) — ${nicheSamples.join(" | ")}`,
            true
          )
    );

    console.log("\n--- Détail par niche ---");
    for (const line of nicheSamples) console.log(`  · ${line}`);

    if (global.items[0]) {
      const sample = global.items[0];
      const brief = parseTrendFormatBrief(sample.formatBrief);
      console.log("\n--- Échantillon top trend ---");
      console.log(
        JSON.stringify(
          {
            id: sample.id,
            title: sample.title.slice(0, 60),
            platform: sample.platform,
            mediaKind: sample.mediaKind,
            growthScore: sample.growthScore,
            hasThumbnail: Boolean(sample.thumbnailUrl),
            formatBrief: brief
              ? {
                  analyzedFrom: brief.analyzedFrom,
                  confidence: brief.confidence,
                  contentType: brief.contentType,
                }
              : null,
            studioTarget: resolveTrendCreatorTarget(sample),
            photoDeepLink: `${baseUrl}/content/photo?influencer=INFLUENCER_ID&trendItemId=${sample.id}`,
            reelDeepLink: `${baseUrl}/content/reel?influencer=INFLUENCER_ID&trendItemId=${sample.id}`,
          },
          null,
          2
        )
      );
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }

  printChecks(checks);
  printManualChecklist(baseUrl);

  const failed = checks.some((c) => c.critical && !c.ok);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
