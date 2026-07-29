/**
 * Démo visuelle : pipeline trends → personnalisation → studio
 * pour une VRAIE influenceuse IA de la DB.
 *
 * Usage:
 *   npx tsx scripts/generate-trends-visual-demo.ts
 *   GENERATE_DEMO_PHOTO=false   — skip Replicate (personnalisation only)
 *   DEMO_SKIP_BILLING=true      — omit credit deduction on photo gen
 *
 * Ouvrir: http://localhost:3000/trends-pipeline-demo.html
 */

import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { parseTrendFormatBrief } from "../src/lib/trends/trend-format-brief";
import {
  mirrorFreshTrendThumbnails,
  mirrorTrendThumbnails,
} from "../src/server/services/trend-thumbnail-storage.service";
import {
  analyzeTopTrendsFormat,
  ensureTrendFormatAnalyzed,
} from "../src/server/services/trends/analysis/format-analysis";
import { getFeedForInfluencer } from "../src/server/services/trends/feed/feed-queries";
import { resolveTrendCreatorTarget } from "../src/server/services/trends/feed/feed-dedupe";
import { personalizeSingleTrendForInfluencer } from "../src/server/services/trends/personalization/personalize";
import {
  recommendationToCreatorParams,
  type ApplyToCreatorResult,
} from "../src/server/services/trends/apply/recommendation-params";
import {
  generateDemoTrendPhoto,
  type DemoPhotoResult,
} from "./demo-generate-trend-photo";
import type { TrendItem } from "../src/generated/prisma/client";
import { PLANS } from "../src/lib/constants";

const DEFAULT_INFLUENCER_ID = "cmpbizit8000004icudikwyen"; // Luna Fit Test
const GENERATE_DEMO_PHOTO = process.env.GENERATE_DEMO_PHOTO?.trim() !== "false";
const DEMO_SKIP_BILLING = process.env.DEMO_SKIP_BILLING?.trim() === "true";
const PERSONALIZE_LIMIT = (() => {
  const n = Number(process.env.PERSONALIZE_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 6) : 3;
})();

type DemoInfluencer = {
  id: string;
  name: string;
  slug: string;
  niche: string;
  bio: string;
  personality: string;
  avatarUrl: string;
  baseImageUrl: string;
};

type DemoTrend = {
  id: string;
  platform: string;
  title: string;
  growthScore: number | null;
  thumbnailUrl: string | null;
  mediaKind: string | null;
  hashtags: string[];
  brief: ReturnType<typeof parseTrendFormatBrief>;
  personalizedHook: string;
  studioTarget: "photo" | "reel";
  apply: ApplyToCreatorResult | null;
  recommendationId: string | null;
  deepLink: string;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function studioFromApply(
  apply: ApplyToCreatorResult | null,
  influencerName: string
): string {
  if (!apply) return `<p class="muted">Personnalisation non disponible</p>`;

  if (apply.target === "reel") {
    return [
      ["Hook personnalisé", `« ${apply.hook} »`],
      ["Pour", influencerName],
      ["Scène", apply.sceneDescription],
      ["Tenue", apply.outfit],
      ["Type reel", apply.videoType],
      ["Durée", `${apply.duration}s`],
      ["Script", apply.script?.slice(0, 200) ?? "—"],
      ["Musique", apply.music || "—"],
    ]
      .map(
        ([k, v]) =>
          `<div class="sf"><span>${esc(k)}</span><p>${esc(String(v))}</p></div>`
      )
      .join("");
  }

  return [
    ["Hook personnalisé", `« ${apply.hook} »`],
    ["Pour", influencerName],
    ["Scène", apply.sceneDescription],
    ["Tenue", apply.outfit],
    ["Pose", `${apply.pose} · ${apply.expression}`],
    ["Prompt", apply.customPrompt?.slice(0, 220) ?? "—"],
  ]
    .map(
      ([k, v]) =>
        `<div class="sf"><span>${esc(k)}</span><p>${esc(String(v))}</p></div>`
    )
    .join("");
}

function buildGeneratedHero(
  influencer: DemoInfluencer,
  trend: DemoTrend,
  photo: DemoPhotoResult
): string {
  const portrait = influencer.baseImageUrl || influencer.avatarUrl;
  const trendThumb = trend.thumbnailUrl;

  return `
    <section class="hero-result">
      <h2 class="hero-result-title">Résultat final — photo générée</h2>
      <p class="hero-result-sub">Trend scrapé → brief → personnalisation → <strong>1 image Flux</strong> avec le visage de ${esc(influencer.name)}</p>
      <div class="triple">
        <div class="phone-col">
          <span class="col-label">Trend source</span>
          <div class="phone">
            <div class="phone-notch"></div>
            <div class="phone-screen">
              ${
                trendThumb
                  ? `<img src="${esc(trendThumb)}" alt="trend" />`
                  : `<div class="ph-placeholder"><span>#${esc(trend.hashtags[0] ?? "trend")}</span></div>`
              }
            </div>
          </div>
          <p class="cap">${esc(trend.title.slice(0, 70))}</p>
        </div>
        <div class="compare-arrow">→</div>
        <div class="phone-col">
          <span class="col-label">Portrait IA</span>
          <div class="phone phone-aura">
            <div class="phone-notch"></div>
            <div class="phone-screen">
              <img src="${esc(portrait)}" alt="${esc(influencer.name)}" />
            </div>
          </div>
          <p class="cap">@${esc(influencer.slug.split("-")[0])}</p>
        </div>
        <div class="compare-arrow">→</div>
        <div class="phone-col">
          <span class="col-label">Contenu généré</span>
          <div class="phone phone-generated">
            <div class="phone-notch"></div>
            <div class="phone-screen">
              <img src="${esc(photo.imageUrl)}" alt="generated" />
              <div class="phone-overlay aura-overlay">
                <span class="ph-hook">${esc(photo.hook.slice(0, 60))}</span>
              </div>
            </div>
          </div>
          <p class="cap">${photo.fromExisting ? "Photo existante Luna (DB)" : "Studio photo · 1 crédit"}</p>
        </div>
      </div>
      <details class="prompt-details">
        <summary>Prompt utilisé</summary>
        <pre>${esc(photo.promptUsed.slice(0, 1200))}</pre>
      </details>
    </section>`;
}

function buildHtml(
  influencer: DemoInfluencer,
  stats: Record<string, number | string>,
  trends: DemoTrend[],
  appBase: string,
  generatedPhoto: DemoPhotoResult | null,
  photoTrend: DemoTrend | null
): string {
  const cards = trends
    .map((t, i) => {
      const brief = t.brief;
      const analyzed = brief?.analyzedFrom ?? "pending";
      const visionBadge =
        analyzed === "vision"
          ? '<span class="badge vision">Vision</span>'
          : analyzed === "text_only"
            ? '<span class="badge text">Texte</span>'
            : "";

      const storyboard =
        brief?.reelStoryboard
          ?.map(
            (b) =>
              `<li><strong>${b.startSec}–${b.endSec}s</strong> ${esc(b.visual)}</li>`
          )
          .join("") ?? "";

      const studioLabel =
        t.studioTarget === "reel" ? "Studio Reel" : "Studio Photo";
      const portrait = influencer.baseImageUrl || influencer.avatarUrl;

      return `
      <section class="showcase">
        <div class="showcase-head">
          <span class="num">0${i + 1}</span>
          <div>
            <h2>${esc(t.title.slice(0, 100))}</h2>
            <p class="tags">${t.hashtags.slice(0, 5).map((h) => `#${esc(h)}`).join(" ")}</p>
          </div>
          <div class="badges-row">
            <span class="badge platform">${esc(t.platform)}</span>
            ${visionBadge}
            <span class="badge target">${studioLabel}</span>
            ${t.growthScore != null ? `<span class="badge score">${t.growthScore.toFixed(0)}</span>` : ""}
          </div>
        </div>

        <div class="compare">
          <div class="phone-col">
            <span class="col-label">Trend scrapé</span>
            <div class="phone">
              <div class="phone-notch"></div>
              <div class="phone-screen">
                ${
                  t.thumbnailUrl
                    ? `<img src="${esc(t.thumbnailUrl)}" alt="trend" />`
                    : `<div class="ph-placeholder"><span>#${esc(t.hashtags[0] ?? "trend")}</span><small>signal TikTok</small></div>`
                }
                <div class="phone-overlay"><span class="ph-hook">${esc(brief?.hook?.slice(0, 55) ?? t.title.slice(0, 55))}</span></div>
              </div>
            </div>
          </div>

          <div class="compare-arrow">→</div>

          <div class="phone-col">
            <span class="col-label">Pour ${esc(influencer.name)}</span>
            <div class="phone phone-aura">
              <div class="phone-notch"></div>
              <div class="phone-screen">
                <img src="${esc(portrait)}" alt="${esc(influencer.name)}" />
                <div class="phone-overlay aura-overlay">
                  <span class="ph-name">@${esc(influencer.slug.split("-")[0])}</span>
                  <span class="ph-hook">${esc(t.personalizedHook)}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="pipeline">
            <div class="pipe-step">
              <h3>1 · Feed niche ${esc(influencer.niche)}</h3>
              <p>${esc(t.mediaKind ?? "signal")} · score ${t.growthScore?.toFixed(1) ?? "—"}</p>
            </div>
            <div class="pipe-arrow">↓</div>
            <div class="pipe-step">
              <h3>2 · formatBrief</h3>
              ${
                brief
                  ? `<p><strong>${esc(brief.contentType)}</strong> · ${esc(brief.confidence)} · ${esc(analyzed)}</p>
                     ${storyboard ? `<ul>${storyboard}</ul>` : ""}`
                  : `<p class="muted">—</p>`
              }
            </div>
            <div class="pipe-arrow">↓</div>
            <div class="pipe-step">
              <h3>3 · Personnalisation LLM</h3>
              <p>Hook adapté à <strong>${esc(influencer.name)}</strong> (${esc(influencer.personality.slice(0, 60))}…)</p>
            </div>
            <div class="pipe-arrow">↓</div>
            <div class="pipe-step studio">
              <h3>4 · ${studioLabel} prérempli</h3>
              ${studioFromApply(t.apply, influencer.name)}
              <a class="deeplink" href="${esc(t.deepLink)}">${esc(t.deepLink.replace(appBase, ""))}</a>
            </div>
          </div>
        </div>
      </section>`;
    })
    .join("\n");

  const portrait = influencer.baseImageUrl || influencer.avatarUrl;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(influencer.name)} — Pipeline Trends Aura</title>
  <style>
    :root {
      --bg: #09090b; --panel: #13131a; --panel2: #1a1a24; --border: #2e2e3a;
      --text: #fafafa; --muted: #a1a1aa; --accent: #a855f7;
      --vision: #22c55e; --text-only: #eab308;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 36px 20px 72px; }
    h1 { font-size: 1.85rem; font-weight: 800; margin: 0 0 6px; letter-spacing: -0.02em; }
    .sub { color: var(--muted); margin: 0 0 28px; max-width: 720px; }
    .hero {
      display: flex; gap: 20px; align-items: center;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 20px; padding: 20px 24px; margin-bottom: 28px;
    }
    .hero img {
      width: 88px; height: 88px; border-radius: 50%; object-fit: cover;
      border: 3px solid var(--accent);
    }
    .hero h2 { margin: 0; font-size: 1.35rem; }
    .hero .niche {
      display: inline-block; margin-top: 4px; font-size: 0.72rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: .06em; color: var(--accent);
    }
    .hero p { margin: 8px 0 0; font-size: 0.88rem; color: var(--muted); max-width: 560px; }
    .stats {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 10px; margin-bottom: 28px;
    }
    .stat { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
    .stat strong { display: block; font-size: 1.5rem; color: var(--accent); }
    .stat span { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
    .flow {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      margin-bottom: 32px; font-size: 0.8rem; color: var(--muted);
    }
    .flow span { background: var(--panel); border: 1px solid var(--border); padding: 7px 12px; border-radius: 999px; }
    .flow .arrow { background: none; border: none; color: var(--accent); }
    .showcase {
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 20px; padding: 22px; margin-bottom: 24px;
    }
    .showcase-head { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; }
    .num { font-size: 1.75rem; font-weight: 800; color: var(--accent); opacity: .35; }
    .showcase-head h2 { margin: 0; font-size: 1rem; }
    .tags { margin: 4px 0 0; font-size: 0.78rem; color: var(--muted); }
    .badges-row { margin-left: auto; display: flex; gap: 5px; flex-wrap: wrap; }
    .badge { font-size: 0.65rem; font-weight: 700; padding: 4px 8px; border-radius: 6px; background: var(--panel2); border: 1px solid var(--border); }
    .badge.platform { color: #e879f9; }
    .badge.vision { color: var(--vision); }
    .badge.text { color: var(--text-only); }
    .badge.target { color: #93c5fd; }
    .badge.score { color: #fff; }
    .compare {
      display: grid;
      grid-template-columns: 200px auto 200px 1fr;
      gap: 16px; align-items: start;
    }
    @media (max-width: 900px) {
      .compare { grid-template-columns: 1fr 1fr; }
      .compare-arrow { display: none; }
      .pipeline { grid-column: 1 / -1; }
    }
    .col-label { display: block; font-size: 0.68rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 8px; text-align: center; }
    .compare-arrow { align-self: center; font-size: 1.5rem; color: var(--accent); padding-top: 28px; }
    .phone { width: 200px; margin: 0 auto; background: #000; border-radius: 26px; padding: 9px; border: 2px solid #333; }
    .phone-aura { border-color: var(--accent); }
    .phone-notch { width: 72px; height: 5px; background: #222; border-radius: 99px; margin: 0 auto 7px; }
    .phone-screen { position: relative; aspect-ratio: 9/16; border-radius: 18px; overflow: hidden; background: #1e1b4b; }
    .phone-screen img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ph-placeholder { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #c4b5fd; font-size: 0.8rem; }
    .phone-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 36px 10px 12px; background: linear-gradient(transparent, rgba(0,0,0,.88)); }
    .aura-overlay .ph-name { display: block; font-size: 0.65rem; color: #e9d5ff; margin-bottom: 4px; }
    .ph-hook { font-size: 0.68rem; font-weight: 600; line-height: 1.35; }
    .pipeline { display: flex; flex-direction: column; }
    .pipe-step { background: var(--panel2); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
    .pipe-step h3 { margin: 0 0 6px; font-size: 0.7rem; text-transform: uppercase; letter-spacing: .06em; color: var(--accent); }
    .pipe-step p { margin: 0; font-size: 0.82rem; }
    .pipe-step ul { margin: 6px 0 0; padding-left: 16px; font-size: 0.78rem; }
    .pipe-step.studio .sf { margin-top: 8px; }
    .pipe-step.studio .sf span { display: block; font-size: 0.62rem; text-transform: uppercase; color: var(--muted); }
    .pipe-step.studio .sf p { margin: 2px 0 0; font-size: 0.8rem; }
    .pipe-arrow { text-align: center; color: var(--accent); padding: 3px 0; }
    .deeplink { display: block; margin-top: 12px; font-size: 0.72rem; color: #93c5fd; word-break: break-all; }
    .muted { color: var(--muted); }
    .hero-result {
      background: linear-gradient(180deg, #1a1030 0%, var(--panel) 100%);
      border: 1px solid #4c1d95; border-radius: 22px;
      padding: 28px 24px 24px; margin-bottom: 32px;
    }
    .hero-result-title { margin: 0 0 6px; font-size: 1.35rem; color: #e9d5ff; }
    .hero-result-sub { margin: 0 0 22px; color: var(--muted); font-size: 0.9rem; }
    .triple {
      display: grid; grid-template-columns: 200px auto 200px auto 200px;
      gap: 14px; align-items: start; justify-content: center;
    }
    @media (max-width: 900px) {
      .triple { grid-template-columns: 1fr 1fr; }
      .triple .compare-arrow { display: none; }
    }
    .phone-generated { border-color: #22c55e; box-shadow: 0 0 24px rgba(34,197,94,.15); }
    .cap { text-align: center; font-size: 0.72rem; color: var(--muted); margin: 8px 0 0; }
    .prompt-details { margin-top: 20px; }
    .prompt-details summary { cursor: pointer; color: var(--muted); font-size: 0.8rem; }
    .prompt-details pre {
      margin-top: 10px; padding: 12px; background: #0d0d14; border-radius: 10px;
      font-size: 0.68rem; overflow-x: auto; white-space: pre-wrap; color: #d4d4d8;
    }
    footer { margin-top: 40px; font-size: 0.72rem; color: var(--muted); text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Trend → ${esc(influencer.name)}</h1>
    <p class="sub">Pipeline complet avec une vraie influenceuse IA : feed filtré par niche, <code>formatBrief</code>, personnalisation LLM, studio photo/reel prérempli.</p>

    <div class="hero">
      <img src="${esc(portrait)}" alt="${esc(influencer.name)}" />
      <div>
        <h2>${esc(influencer.name)}</h2>
        <span class="niche">${esc(influencer.niche)}</span>
        <p>${esc(influencer.bio.slice(0, 180))}</p>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><strong>${stats.personalized}</strong><span>Personnalisés</span></div>
      <div class="stat"><strong>${stats.feedSize}</strong><span>Feed ${esc(influencer.niche)}</span></div>
      <div class="stat"><strong>${stats.reelTargets}</strong><span>Cibles reel</span></div>
      <div class="stat"><strong>${stats.cards}</strong><span>Exemples</span></div>
      ${generatedPhoto ? `<div class="stat"><strong>1</strong><span>Photo générée</span></div>` : ""}
    </div>

    <div class="flow">
      <span>Apify</span><span class="arrow">→</span>
      <span>Feed ${esc(influencer.niche)}</span><span class="arrow">→</span>
      <span>formatBrief</span><span class="arrow">→</span>
      <span>Personnalisation</span><span class="arrow">→</span>
      <span>Studio</span>${generatedPhoto ? `<span class="arrow">→</span><span>Image Flux</span>` : ""}
    </div>

    ${generatedPhoto && photoTrend ? buildGeneratedHero(influencer, photoTrend, generatedPhoto) : ""}

    ${cards}

    <footer>Généré ${esc(new Date().toLocaleString("fr-FR"))} · id ${esc(influencer.id)}</footer>
  </div>
</body>
</html>`;
}

async function loadInfluencer(prisma: PrismaClient) {
  const id = process.env.DEMO_INFLUENCER_ID?.trim() || DEFAULT_INFLUENCER_ID;
  let row = await prisma.influencer.findFirst({
    where: { id, status: "ACTIVE" },
    include: { user: { select: { plan: true, locale: true } } },
  });

  if (!row?.baseImageUrl && !row?.avatarUrl) {
    row = await prisma.influencer.findFirst({
      where: {
        status: "ACTIVE",
        isNsfw: false,
        OR: [{ baseImageUrl: { not: null } }, { avatarUrl: { not: null } }],
      },
      orderBy: { updatedAt: "desc" },
      include: { user: { select: { plan: true, locale: true } } },
    });
  }

  if (!row) throw new Error("Aucune influenceuse active avec portrait en DB");
  return row;
}

async function resolvePhotoDemoTarget(
  prisma: PrismaClient,
  influencer: Awaited<ReturnType<typeof loadInfluencer>>,
  trends: DemoTrend[],
  lang: "fr" | "en"
): Promise<{
  trend: TrendItem;
  hook: string;
  apply: ApplyToCreatorResult | null;
  card: DemoTrend;
} | null> {
  const curated = await prisma.trendItem.findFirst({
    where: {
      thumbnailUrl: { contains: "unsplash.com" },
      formatBrief: { not: Prisma.DbNull },
      OR: [
        { nicheTags: { has: influencer.niche } },
        { nicheTags: { has: "GENERAL" } },
      ],
    },
    orderBy: [{ growthScore: "desc" }, { fetchedAt: "desc" }],
  });

  const trendItem =
    curated ??
    (await prisma.trendItem.findUnique({
      where: {
        id:
          trends.find((t) => t.thumbnailUrl?.includes("unsplash") && t.brief)
            ?.id ??
          trends.find((t) => t.apply && t.brief)?.id ??
          trends.find((t) => t.brief)?.id ??
          "",
      },
    }));

  if (!trendItem?.formatBrief) return null;

  const brief = parseTrendFormatBrief(trendItem.formatBrief);
  let hook = brief?.hook ?? trendItem.title.slice(0, 80);
  let apply: ApplyToCreatorResult | null = null;
  let recommendationId: string | null = null;

  const existingCard = trends.find((t) => t.id === trendItem.id);
  if (existingCard?.apply) {
    return {
      trend: trendItem,
      hook: existingCard.personalizedHook,
      apply: existingCard.apply,
      card: existingCard,
    };
  }

  try {
    const { recommendationId: recId } =
      await personalizeSingleTrendForInfluencer(
        influencer,
        trendItem,
        lang,
        { skipFormatAnalysis: true }
      );
    recommendationId = recId;
    const rec = await prisma.trendRecommendation.findUnique({
      where: { id: recId },
    });
    if (rec) {
      hook = rec.generatedHook;
      apply = recommendationToCreatorParams(
        rec,
        influencer.id,
        trendItem.hashtags,
        trendItem,
        { isNsfw: false, gender: influencer.gender }
      );
    }
  } catch (e) {
    console.warn("[demo] photo-target personalize:", e);
  }

  const studioTarget = resolveTrendCreatorTarget(trendItem);
  const qs = recommendationId
    ? `influencer=${influencer.id}&recommendationId=${recommendationId}`
    : `influencer=${influencer.id}&trendItemId=${trendItem.id}`;
  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  const card: DemoTrend = {
    id: trendItem.id,
    platform: trendItem.platform,
    title: trendItem.title,
    growthScore: trendItem.growthScore,
    thumbnailUrl: trendItem.thumbnailUrl,
    mediaKind: trendItem.mediaKind,
    hashtags: trendItem.hashtags,
    brief,
    personalizedHook: hook,
    studioTarget,
    apply,
    recommendationId,
    deepLink: `${appBase}/content/${studioTarget === "reel" ? "reel" : "photo"}?${qs}`,
  };

  return { trend: trendItem, hook, apply, card };
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  try {
    try {
      await mirrorFreshTrendThumbnails(12);
      await analyzeTopTrendsFormat(4);
    } catch (e) {
      console.warn("[demo] mirror/analyze:", e);
    }

    const row = await loadInfluencer(prisma);
    const influencer: DemoInfluencer = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      niche: row.niche,
      bio: row.bio,
      personality: row.personality,
      avatarUrl: row.avatarUrl ?? row.baseImageUrl ?? "",
      baseImageUrl: row.baseImageUrl ?? row.avatarUrl ?? "",
    };
    console.log(`Influenceuse : ${influencer.name} (${influencer.niche})`);

    const planKey = (
      row.user.plan in PLANS ? row.user.plan : "FREE"
    ) as keyof typeof PLANS;

    const { items: feedItems } = await getFeedForInfluencer(row, {
      limit: 12,
      userPlan: planKey,
      userLocale: row.user.locale ?? "fr",
    });

  const candidates = feedItems
    .filter((t) => t.formatBrief != null)
    .sort((a, b) => (b.growthScore ?? 0) - (a.growthScore ?? 0));

  const picked: TrendItem[] = [];
  const seen = new Set<string>();
  for (const item of candidates) {
    if (picked.length >= PERSONALIZE_LIMIT + 1) break;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    picked.push(item);
  }
  if (picked.length < PERSONALIZE_LIMIT) {
    for (const item of feedItems) {
      if (picked.length >= PERSONALIZE_LIMIT + 1) break;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      picked.push(item);
    }
  }

  const trends: DemoTrend[] = [];
  let personalized = 0;

  for (const item of picked.slice(0, PERSONALIZE_LIMIT + 1)) {
    let full = await prisma.trendItem.findUnique({ where: { id: item.id } });
    if (!full) continue;

    if (!full.formatBrief) {
      try {
        await ensureTrendFormatAnalyzed(full.id);
        full = await prisma.trendItem.findUnique({ where: { id: item.id } });
      } catch {
        // continue
      }
    }
    if (!full) continue;

    const mirrored = await mirrorTrendThumbnails({
      id: full.id,
      thumbnailUrl: full.thumbnailUrl,
      thumbnailUrlAlt: full.thumbnailUrlAlt,
      mediaUrls: full.mediaUrls,
    });
    if (mirrored.thumbnailUrl && mirrored.thumbnailUrl !== full.thumbnailUrl) {
      await prisma.trendItem.update({
        where: { id: full.id },
        data: {
          thumbnailUrl: mirrored.thumbnailUrl,
          thumbnailUrlAlt: mirrored.thumbnailUrlAlt,
        },
      });
      full = { ...full, thumbnailUrl: mirrored.thumbnailUrl };
    }

    const brief = parseTrendFormatBrief(full.formatBrief);
    const studioTarget = resolveTrendCreatorTarget(full);
    const lang = row.user.locale === "en" ? "en" : "fr";

    let apply: ApplyToCreatorResult | null = null;
    let recommendationId: string | null = null;
    let personalizedHook = brief?.hook ?? full.title.slice(0, 80);

    try {
      const { recommendationId: recId } =
        await personalizeSingleTrendForInfluencer(
          row,
          full,
          lang,
          { skipFormatAnalysis: true }
        );
      recommendationId = recId;
      personalized += 1;

      const rec = await prisma.trendRecommendation.findUnique({
        where: { id: recId },
      });
      if (rec) {
        personalizedHook = rec.generatedHook;
        apply = recommendationToCreatorParams(
          rec,
          influencer.id,
          full.hashtags,
          full,
          { isNsfw: false, gender: "female" }
        );
        if (apply.target === "reel") {
          apply.hook = rec.generatedHook;
        } else {
          apply.hook = rec.generatedHook;
        }
      }
    } catch (e) {
      console.warn(`[demo] personalize ${full.id}:`, e);
    }

    const qs = recommendationId
      ? `influencer=${influencer.id}&recommendationId=${recommendationId}`
      : `influencer=${influencer.id}&trendItemId=${full.id}`;
    const path =
      studioTarget === "reel"
        ? `/content/reel?${qs}`
        : `/content/photo?${qs}`;

    trends.push({
      id: full.id,
      platform: full.platform,
      title: full.title,
      growthScore: full.growthScore,
      thumbnailUrl: full.thumbnailUrl,
      mediaKind: full.mediaKind,
      hashtags: full.hashtags,
      brief,
      personalizedHook,
      studioTarget,
      apply,
      recommendationId,
      deepLink: `${appBase}${path}`,
    });
  }

  const reelTargets = feedItems.filter(
    (i) => resolveTrendCreatorTarget(i) === "reel"
  ).length;

  let generatedPhoto: DemoPhotoResult | null = null;
  let photoTrend: DemoTrend | null = null;

  if (GENERATE_DEMO_PHOTO) {
    const photoTarget = await resolvePhotoDemoTarget(
      prisma,
      row,
      trends,
      row.user.locale === "en" ? "en" : "fr"
    );

    if (photoTarget) {
      console.log(
        `\nGénération photo pour « ${photoTarget.trend.title.slice(0, 50)}… » (${DEMO_SKIP_BILLING ? "sans facturation" : "1 crédit"})…`
      );
      try {
        generatedPhoto = await generateDemoTrendPhoto({
          influencer: row,
          trend: photoTarget.trend,
          personalizedHook: photoTarget.hook,
          apply: photoTarget.apply,
          skipBilling: DEMO_SKIP_BILLING,
        });
        photoTrend = photoTarget.card;
        console.log(`Photo générée : ${generatedPhoto.imageUrl}`);
      } catch (e) {
        console.warn("[demo] photo generation failed:", e);
        const existing = await prisma.content.findFirst({
          where: {
            influencerId: row.id,
            type: "PHOTO",
            status: "READY",
            thumbnailUrl: { not: null },
          },
          orderBy: { createdAt: "desc" },
          select: { thumbnailUrl: true, promptUsed: true, caption: true },
        });
        if (existing?.thumbnailUrl) {
          generatedPhoto = {
            imageUrl: existing.thumbnailUrl,
            promptUsed: existing.promptUsed ?? "(photo existante en DB)",
            trendTitle: photoTarget.trend.title,
            hook: photoTarget.hook,
            fromExisting: true,
          };
          photoTrend = photoTarget.card;
          console.log(`Fallback photo DB : ${existing.thumbnailUrl}`);
        }
      }
    }
  }

  const html = buildHtml(
    influencer,
    {
      personalized,
      feedSize: feedItems.length,
      reelTargets,
      cards: trends.length,
    },
    trends,
    appBase,
    generatedPhoto,
    photoTrend
  );

  const outPath = join(process.cwd(), "public", "trends-pipeline-demo.html");
  mkdirSync(join(process.cwd(), "public"), { recursive: true });
  writeFileSync(outPath, html, "utf8");

  console.log(`\n✅ Démo : ${outPath}`);
  console.log(`   → ${appBase}/trends-pipeline-demo.html\n`);
  console.log(
    JSON.stringify(
      {
        influencer: influencer.name,
        feedSize: feedItems.length,
        personalized,
        cards: trends.length,
        generatedPhoto: generatedPhoto?.imageUrl ?? null,
      },
      null,
      2
    )
  );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
