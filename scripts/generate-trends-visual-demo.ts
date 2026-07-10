/**
 * Génère une page HTML autonome — rendu visuel concret du pipeline trends.
 *
 * Usage: npx tsx scripts/generate-trends-visual-demo.ts
 * Ouvrir: http://localhost:3000/trends-pipeline-demo.html
 */

import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  parseTrendFormatBrief,
  formatBriefToReelSeed,
  formatBriefToPhotoSeed,
} from "../src/lib/trends/trend-format-brief";
import {
  mirrorFreshTrendThumbnails,
  mirrorTrendThumbnails,
} from "../src/server/services/trend-thumbnail-storage.service";
import {
  analyzeTopTrendsFormat,
  ensureTrendFormatAnalyzed,
} from "../src/server/services/trends/analysis/format-analysis";
import { isAnthropicVisionSafeUrl } from "../src/lib/trends/trend-vision-images";

const DEMO_INFLUENCER = "Luna Fit";

type DemoTrend = {
  id: string;
  platform: string;
  title: string;
  growthScore: number | null;
  thumbnailUrl: string | null;
  mediaKind: string | null;
  hashtags: string[];
  soundName: string | null;
  brief: ReturnType<typeof parseTrendFormatBrief>;
  photoSeed: ReturnType<typeof formatBriefToPhotoSeed> | null;
  reelSeed: ReturnType<typeof formatBriefToReelSeed> | null;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function studioFields(
  brief: NonNullable<DemoTrend["brief"]>,
  reelSeed: DemoTrend["reelSeed"]
): string {
  const rows = [
    ["Hook", `« ${brief.hook} »`],
    ["Scène", brief.sceneDescription],
    ["Tenue", brief.outfit],
    ["Pose / expression", `${brief.pose} · ${brief.expression}`],
    ["Caméra", brief.cameraStyle],
    ["Mood", `${brief.mood} · ${brief.lighting}`],
  ];
  if (reelSeed) {
    rows.push(["Type reel", reelSeed.videoType]);
    rows.push(["Durée", `${reelSeed.duration}s`]);
    rows.push(["Script", reelSeed.script?.slice(0, 180) ?? "—"]);
  }
  return rows
    .map(
      ([k, v]) =>
        `<div class="sf"><span>${esc(k)}</span><p>${esc(String(v))}</p></div>`
    )
    .join("");
}

function buildHtml(stats: Record<string, number | string>, trends: DemoTrend[]): string {
  const cards = trends
    .map((t, i) => {
      const brief = t.brief;
      const thumb = t.thumbnailUrl;
      const analyzed = brief?.analyzedFrom ?? "pending";
      const visionBadge =
        analyzed === "vision"
          ? '<span class="badge vision">Vision Claude</span>'
          : analyzed === "text_only"
            ? '<span class="badge text">Texte + métadonnées</span>'
            : '<span class="badge pending">Non analysé</span>';

      const storyboard =
        brief?.reelStoryboard
          ?.map(
            (b) =>
              `<li><strong>${b.startSec}–${b.endSec}s</strong> ${esc(b.visual)}</li>`
          )
          .join("") ?? "";

      const targetStudio =
        brief?.contentType === "REEL" || t.mediaKind === "video"
          ? "Studio Reel"
          : "Studio Photo";

      return `
      <section class="showcase">
        <div class="showcase-head">
          <span class="num">0${i + 1}</span>
          <div>
            <h2>${esc(t.title.slice(0, 100))}</h2>
            <p class="tags">${t.hashtags.slice(0, 6).map((h) => `#${esc(h)}`).join(" ")}</p>
          </div>
          <div class="badges-row">
            <span class="badge platform">${esc(t.platform)}</span>
            ${visionBadge}
            ${t.growthScore != null ? `<span class="badge score">${t.growthScore.toFixed(0)}</span>` : ""}
          </div>
        </div>

        <div class="showcase-body">
          <div class="phone">
            <div class="phone-notch"></div>
            <div class="phone-screen">
              ${
                thumb
                  ? `<img src="${esc(thumb)}" alt="cover" />`
                  : `<div class="ph-placeholder"><span>TrendCard</span><small>gradient niche</small></div>`
              }
              <div class="phone-overlay">
                <span class="ph-hook">${esc(brief?.hook?.slice(0, 50) ?? t.title.slice(0, 50))}</span>
              </div>
            </div>
          </div>

          <div class="pipeline">
            <div class="pipe-step">
              <h3>1 · Scrape Apify</h3>
              <p>${esc(t.mediaKind ?? "signal")} · ${esc(t.platform)} · score ${t.growthScore?.toFixed(1) ?? "—"}</p>
            </div>
            <div class="pipe-arrow">↓</div>
            <div class="pipe-step">
              <h3>2 · formatBrief</h3>
              ${
                brief
                  ? `<p><strong>${esc(brief.contentType)}</strong> · confiance ${esc(brief.confidence)} · ${esc(analyzed)}</p>
                     <p class="note">${esc(brief.inspirationNotes)}</p>
                     ${storyboard ? `<ul>${storyboard}</ul>` : ""}`
                  : `<p class="muted">En attente d'analyse</p>`
              }
            </div>
            <div class="pipe-arrow">↓</div>
            <div class="pipe-step studio">
              <h3>3 · ${targetStudio} (prérempli)</h3>
              ${brief ? studioFields(brief, t.reelSeed) : `<p class="muted">—</p>`}
            </div>
          </div>
        </div>
      </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pipeline Trends — Démo visuelle Aura</title>
  <style>
    :root {
      --bg: #09090b;
      --panel: #13131a;
      --panel2: #1a1a24;
      --border: #2e2e3a;
      --text: #fafafa;
      --muted: #a1a1aa;
      --accent: #a855f7;
      --vision: #22c55e;
      --text-only: #eab308;
      --pending: #71717a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 40px 20px 80px; }
    h1 { font-size: 2rem; font-weight: 800; margin: 0 0 10px; letter-spacing: -0.02em; }
    .sub { color: var(--muted); margin: 0 0 32px; max-width: 680px; font-size: 1rem; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin-bottom: 36px;
    }
    .stat {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px 16px;
    }
    .stat strong { display: block; font-size: 1.75rem; font-weight: 700; color: var(--accent); }
    .stat span { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
    .flow {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      margin-bottom: 40px; font-size: 0.8rem; color: var(--muted);
    }
    .flow span {
      background: var(--panel); border: 1px solid var(--border);
      padding: 8px 14px; border-radius: 999px;
    }
    .flow .arrow { background: none; border: none; color: var(--accent); }
    .showcase {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 28px;
    }
    .showcase-head {
      display: flex; gap: 16px; align-items: flex-start;
      margin-bottom: 24px; flex-wrap: wrap;
    }
    .num {
      font-size: 2rem; font-weight: 800; color: var(--accent);
      opacity: .35; line-height: 1; min-width: 36px;
    }
    .showcase-head h2 { margin: 0; font-size: 1.05rem; font-weight: 600; }
    .tags { margin: 6px 0 0; font-size: 0.8rem; color: var(--muted); }
    .badges-row { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap; }
    .badge {
      font-size: 0.68rem; font-weight: 700; padding: 5px 10px;
      border-radius: 8px; background: var(--panel2); border: 1px solid var(--border);
    }
    .badge.platform { color: #e879f9; }
    .badge.vision { color: var(--vision); border-color: #166534; }
    .badge.text { color: var(--text-only); border-color: #854d0e; }
    .badge.pending { color: var(--pending); }
    .badge.score { color: #fff; }
    .showcase-body {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 28px;
      align-items: start;
    }
    @media (max-width: 720px) {
      .showcase-body { grid-template-columns: 1fr; }
    }
    .phone {
      width: 220px;
      background: #000;
      border-radius: 28px;
      padding: 10px;
      border: 2px solid #333;
    }
    .phone-notch {
      width: 80px; height: 6px; background: #222;
      border-radius: 99px; margin: 0 auto 8px;
    }
    .phone-screen {
      position: relative;
      aspect-ratio: 9/16;
      border-radius: 20px;
      overflow: hidden;
      background: linear-gradient(160deg, #1e1b4b, #312e81);
    }
    .phone-screen img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ph-placeholder {
      height: 100%; display: flex; flex-direction: column;
      align-items: center; justify-content: center; color: #c4b5fd;
      font-size: 0.85rem; text-align: center; gap: 4px;
    }
    .ph-placeholder small { color: #818cf8; font-size: 0.7rem; }
    .phone-overlay {
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: 40px 12px 14px;
      background: linear-gradient(transparent, rgba(0,0,0,.85));
    }
    .ph-hook { font-size: 0.72rem; font-weight: 600; line-height: 1.3; }
    .pipeline { display: flex; flex-direction: column; gap: 0; }
    .pipe-step {
      background: var(--panel2);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px 18px;
    }
    .pipe-step h3 { margin: 0 0 8px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: .06em; color: var(--accent); }
    .pipe-step p { margin: 0; font-size: 0.85rem; }
    .pipe-step .note { margin-top: 8px; color: var(--muted); font-size: 0.8rem; font-style: italic; }
    .pipe-step ul { margin: 8px 0 0; padding-left: 18px; font-size: 0.8rem; }
    .pipe-step.studio .sf { margin-top: 10px; }
    .pipe-step.studio .sf span {
      display: block; font-size: 0.65rem; text-transform: uppercase;
      letter-spacing: .05em; color: var(--muted); margin-bottom: 2px;
    }
    .pipe-step.studio .sf p { margin: 0; font-size: 0.82rem; line-height: 1.4; }
    .pipe-arrow { text-align: center; color: var(--accent); font-size: 1.2rem; padding: 4px 0; }
    .muted { color: var(--muted); }
    footer { margin-top: 48px; font-size: 0.75rem; color: var(--muted); text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Pipeline Trends — rendu concret</h1>
    <p class="sub">
      Données live de ta base : Apify (khadinakbar + vidéos TikTok/IG) → mirror covers R2 →
      <code>formatBrief</code> Claude → champs préremplis dans le studio photo/reel.
    </p>

    <div class="stats">
      <div class="stat"><strong>${stats.mirrored}</strong><span>Covers R2</span></div>
      <div class="stat"><strong>${stats.analyzed}</strong><span>Analysés</span></div>
      <div class="stat"><strong>${stats.withThumb}</strong><span>Avec miniature</span></div>
      <div class="stat"><strong>${stats.vision}</strong><span>Vision</span></div>
      <div class="stat"><strong>${stats.textOnly}</strong><span>Texte</span></div>
      <div class="stat"><strong>${stats.cards}</strong><span>Exemples</span></div>
    </div>

    <div class="flow">
      <span>Apify scrape</span><span class="arrow">→</span>
      <span>Mirror CDN → R2</span><span class="arrow">→</span>
      <span>Claude formatBrief</span><span class="arrow">→</span>
      <span>Studio photo / reel</span>
    </div>

    ${cards}

    <footer>
      Généré ${esc(new Date().toLocaleString("fr-FR"))} · Influenceuse démo : ${esc(DEMO_INFLUENCER)} · ${esc(String(stats.note))}
    </footer>
  </div>
</body>
</html>`;
}

async function pickDemoTrends(
  prisma: PrismaClient
): Promise<ReturnType<PrismaClient["trendItem"]["findMany"]>> {
  const freshSince = new Date(Date.now() - 72 * 3600 * 1000);

  const [curated, igMirrored, tiktokBrief, fallback] = await Promise.all([
    prisma.trendItem.findMany({
      where: {
        thumbnailUrl: { contains: "unsplash.com" },
        formatBrief: { not: Prisma.DbNull },
      },
      orderBy: { growthScore: "desc" },
      take: 2,
      select: {
        id: true,
        platform: true,
        title: true,
        growthScore: true,
        thumbnailUrl: true,
        mediaKind: true,
        hashtags: true,
        soundName: true,
        formatBrief: true,
      },
    }),
    prisma.trendItem.findMany({
      where: {
        fetchedAt: { gte: freshSince },
        thumbnailUrl: { contains: "r2.dev" },
        formatBrief: { not: Prisma.DbNull },
      },
      orderBy: { growthScore: "desc" },
      take: 2,
      select: {
        id: true,
        platform: true,
        title: true,
        growthScore: true,
        thumbnailUrl: true,
        mediaKind: true,
        hashtags: true,
        soundName: true,
        formatBrief: true,
      },
    }),
    prisma.trendItem.findMany({
      where: {
        fetchedAt: { gte: freshSince },
        mediaKind: "video",
        platform: "TIKTOK",
        formatBrief: { not: Prisma.DbNull },
      },
      orderBy: { growthScore: "desc" },
      take: 2,
      select: {
        id: true,
        platform: true,
        title: true,
        growthScore: true,
        thumbnailUrl: true,
        mediaKind: true,
        hashtags: true,
        soundName: true,
        formatBrief: true,
      },
    }),
    prisma.trendItem.findMany({
      where: {
        fetchedAt: { gte: freshSince },
        formatBrief: { not: Prisma.DbNull },
      },
      orderBy: { growthScore: "desc" },
      take: 8,
      select: {
        id: true,
        platform: true,
        title: true,
        growthScore: true,
        thumbnailUrl: true,
        mediaKind: true,
        hashtags: true,
        soundName: true,
        formatBrief: true,
      },
    }),
  ]);

  const seen = new Set<string>();
  const merged = [...curated, ...igMirrored, ...tiktokBrief, ...fallback].filter(
    (r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    }
  );

  return merged.slice(0, 6);
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  let mirrored = 0;
  let analyzed = 0;
  try {
    mirrored = await mirrorFreshTrendThumbnails(24);
    analyzed = await analyzeTopTrendsFormat(6);
  } catch (e) {
    console.warn("[demo] mirror/analyze:", e);
  }

  const rows = await pickDemoTrends(prisma);

  for (const row of rows.slice(0, 4)) {
    try {
      const full = await prisma.trendItem.findUnique({
        where: { id: row.id },
        select: {
          id: true,
          thumbnailUrl: true,
          thumbnailUrlAlt: true,
          mediaUrls: true,
        },
      });
      if (full) {
        const m = await mirrorTrendThumbnails(full);
        if (m.changed || (m.thumbnailUrl && m.thumbnailUrl !== full.thumbnailUrl)) {
          await prisma.trendItem.update({
            where: { id: row.id },
            data: {
              thumbnailUrl: m.thumbnailUrl,
              thumbnailUrlAlt: m.thumbnailUrlAlt,
            },
          });
          row.thumbnailUrl = m.thumbnailUrl;
        }
      }
      if (!row.formatBrief) {
        await ensureTrendFormatAnalyzed(row.id);
        const updated = await prisma.trendItem.findUnique({
          where: { id: row.id },
          select: { formatBrief: true },
        });
        if (updated?.formatBrief) row.formatBrief = updated.formatBrief;
      }
    } catch {
      // non-fatal per card
    }
  }

  const trends: DemoTrend[] = rows.map((r) => {
    const brief = parseTrendFormatBrief(r.formatBrief);
    return {
      id: r.id,
      platform: r.platform,
      title: r.title,
      growthScore: r.growthScore,
      thumbnailUrl: r.thumbnailUrl,
      mediaKind: r.mediaKind,
      hashtags: r.hashtags,
      soundName: r.soundName,
      brief,
      photoSeed: brief
        ? formatBriefToPhotoSeed(brief, DEMO_INFLUENCER, r.hashtags, false)
        : null,
      reelSeed: brief
        ? formatBriefToReelSeed(brief, DEMO_INFLUENCER, r.hashtags, {
            soundName: r.soundName ?? undefined,
          })
        : null,
    };
  });

  const freshSince = new Date(Date.now() - 72 * 3600 * 1000);
  const [withThumb, visionCount, textCount] = await Promise.all([
    prisma.trendItem.count({
      where: {
        fetchedAt: { gte: freshSince },
        thumbnailUrl: { not: null },
      },
    }),
    prisma.trendItem.count({
      where: {
        fetchedAt: { gte: freshSince },
        formatBrief: { path: ["analyzedFrom"], equals: "vision" },
      },
    }),
    prisma.trendItem.count({
      where: {
        fetchedAt: { gte: freshSince },
        formatBrief: { path: ["analyzedFrom"], equals: "text_only" },
      },
    }),
  ]);

  const withImages = trends.filter((t) => t.thumbnailUrl).length;

  const html = buildHtml(
    {
      mirrored,
      analyzed,
      withThumb,
      vision: visionCount,
      textOnly: textCount,
      cards: trends.length,
      note: `${withImages}/${trends.length} cartes avec image visible`,
    },
    trends
  );

  const outPath = join(process.cwd(), "public", "trends-pipeline-demo.html");
  mkdirSync(join(process.cwd(), "public"), { recursive: true });
  writeFileSync(outPath, html, "utf8");

  console.log(`\n✅ Démo visuelle : ${outPath}`);
  console.log(`   → http://localhost:3000/trends-pipeline-demo.html\n`);
  console.log(
    JSON.stringify(
      {
        mirrored,
        analyzed,
        cards: trends.length,
        withImages,
        visionCount,
        withThumb,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
