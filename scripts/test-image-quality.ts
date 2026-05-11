/**
 * Sprint 11 — Autonomous image-quality test bench.
 *
 * Generates 4 diverse personas, then for each one:
 *   1. A base portrait (Flux 1.1 Pro T2I)
 *   2. Three content photos using the base as character reference
 *      (Flux Kontext Pro), with explicit outfits, scenes and poses to stress
 *      the three known weaknesses we just fixed:
 *        - "too perfect / studio look"
 *        - "outfit ignored"
 *        - "face drift between base and content"
 *
 * Outputs:
 *   - downloads every image to ./test-output/<run-id>/
 *   - writes report.html with side-by-side comparisons + the exact prompt used
 *   - writes summary.json with the test matrix and timings
 *
 * Run:  pnpm tsx scripts/test-image-quality.ts
 *
 * Cost: ~1.6 USD per run (4 personas × 4 base + 12 content @ Replicate prices).
 *
 * Requires: Postgres reachable (DATABASE_URL) — we create a dedicated test
 * user with plenty of credits so we don't disrupt the real account.
 */

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  generateBaseImage,
  generateContentImage,
  type InfluencerStyle,
  type ImageGenerationInput,
} from "../src/server/services/ai-image.service";
import { db } from "../src/server/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT_DIR = path.join(ROOT, "test-output", RUN_ID);

interface Persona {
  id: string;
  label: string;
  age: number;
  style: InfluencerStyle;
  /** Three content scenarios stressing different aspects. */
  scenarios: Array<{
    label: string;
    /** Why we run it: which past failure does this scenario stress? */
    stresses: "outfit" | "non-studio look" | "identity";
    input: Omit<ImageGenerationInput, "influencerId" | "baseImageUrl" | "numberOfImages">;
  }>;
}

const PERSONAS: Persona[] = [
  {
    id: "luna",
    label: "Luna — femme blonde fitness",
    age: 24,
    style: {
      gender: "female",
      ethnicity: "caucasian",
      hairColor: "blonde",
      hairStyle: "long wavy",
      bodyType: "athletic",
      fashionStyle: "sporty",
    },
    scenarios: [
      {
        label: "Salle de sport — débardeur rose vif",
        stresses: "outfit",
        input: {
          scene: "gym",
          pose: "fullBody",
          expression: "natural",
          style: "fashion_campaign", // <- legacy template that used to override outfit
          lighting: "natural",
          outfit: "hot pink tank top, black leggings, white sneakers",
          isNsfw: false,
        },
      },
      {
        label: "Café matin — sweat oversize beige",
        stresses: "non-studio look",
        input: {
          scene: "cafe",
          pose: "sitting",
          expression: "natural",
          style: "natural",
          lighting: "natural",
          outfit: "oversized beige hoodie with small coffee stain on the sleeve",
          isNsfw: false,
        },
      },
      {
        label: "Selfie chambre — robe d'été",
        stresses: "identity",
        input: {
          scene: "bedroom",
          pose: "selfie",
          expression: "smile",
          style: "natural",
          lighting: "studio",
          outfit: "yellow floral summer dress",
          isNsfw: false,
        },
      },
    ],
  },
  {
    id: "marco",
    label: "Marco — homme italien streetwear",
    age: 29,
    style: {
      gender: "male",
      ethnicity: "italian",
      hairColor: "dark brown",
      hairStyle: "short curly",
      bodyType: "athletic",
      fashionStyle: "streetwear",
    },
    scenarios: [
      {
        label: "Rue — bomber vert militaire",
        stresses: "outfit",
        input: {
          scene: "urban",
          pose: "fullBody",
          expression: "serious",
          style: "street_style", // <- another legacy template that hijacked outfit
          lighting: "blue_hour",
          outfit: "olive green bomber jacket, white t-shirt, baggy carpenter jeans, dark Air Force 1 sneakers",
          isNsfw: false,
        },
      },
      {
        label: "Rooftop apéro — chemise hawaïenne",
        stresses: "non-studio look",
        input: {
          scene: "rooftop",
          pose: "candid",
          expression: "laughing",
          style: "vintage",
          lighting: "golden_hour",
          outfit: "open Hawaiian shirt with palm tree print, plain black t-shirt underneath, tan cargo shorts",
          isNsfw: false,
        },
      },
      {
        label: "Sport — débardeur orange",
        stresses: "identity",
        input: {
          scene: "gym",
          pose: "fullBody",
          expression: "serious",
          style: "natural",
          lighting: "natural",
          outfit: "bright orange sleeveless gym tank top, grey shorts",
          isNsfw: false,
        },
      },
    ],
  },
  {
    id: "amani",
    label: "Amani — femme noire mode",
    age: 26,
    style: {
      gender: "female",
      ethnicity: "black african",
      hairColor: "black",
      hairStyle: "natural curls afro",
      bodyType: "curvy",
      fashionStyle: "fashion",
    },
    scenarios: [
      {
        label: "Restaurant — robe rouge moulante",
        stresses: "outfit",
        input: {
          scene: "restaurant",
          pose: "sitting",
          expression: "seductive",
          style: "glamour",
          lighting: "dramatic",
          outfit: "fitted red satin midi dress with thin straps, gold hoop earrings",
          isNsfw: false,
        },
      },
      {
        label: "Plage — paréo motif léopard",
        stresses: "non-studio look",
        input: {
          scene: "beach",
          pose: "action",
          expression: "playful",
          style: "natural",
          lighting: "natural",
          outfit: "black bikini top with leopard-print sarong tied at the waist, gold ankle bracelet",
          isNsfw: false,
        },
      },
      {
        label: "Boutique — total look denim",
        stresses: "identity",
        input: {
          scene: "urban",
          pose: "fullBody",
          expression: "natural",
          style: "fashion_campaign",
          lighting: "natural",
          outfit: "head-to-toe denim outfit, oversized denim jacket and matching wide-leg jeans, white tank top underneath",
          location: "Soho New York",
          isNsfw: false,
        },
      },
    ],
  },
  {
    id: "kenji",
    label: "Kenji — homme japonais minimaliste",
    age: 32,
    style: {
      gender: "male",
      ethnicity: "japanese",
      hairColor: "black",
      hairStyle: "short straight",
      bodyType: "slim",
      fashionStyle: "minimalist",
    },
    scenarios: [
      {
        label: "Café — pull col roulé noir",
        stresses: "outfit",
        input: {
          scene: "cafe",
          pose: "sitting",
          expression: "natural",
          style: "minimalist",
          lighting: "natural",
          outfit: "plain black turtleneck sweater, beige wool overcoat draped on the chair",
          isNsfw: false,
        },
      },
      {
        label: "Tokyo — t-shirt blanc et pantalon ample",
        stresses: "non-studio look",
        input: {
          scene: "urban",
          pose: "fullBody",
          expression: "natural",
          style: "street_style",
          lighting: "neon",
          outfit: "plain oversized white t-shirt, wide-leg dark navy trousers, white socks visible above black loafers",
          location: "Shibuya Tokyo",
          isNsfw: false,
        },
      },
      {
        label: "Chambre — peignoir blanc",
        stresses: "identity",
        input: {
          scene: "bedroom",
          pose: "candid",
          expression: "natural",
          style: "minimalist",
          lighting: "natural",
          outfit: "plain white waffle bathrobe, hair slightly damp",
          isNsfw: false,
        },
      },
    ],
  },
];

interface PersonaResult {
  persona: Persona;
  baseImageUrl: string | null;
  baseError: string | null;
  baseDurationMs: number;
  scenarios: Array<{
    label: string;
    stresses: string;
    contentImageUrl: string | null;
    promptUsed: string;
    durationMs: number;
    error: string | null;
  }>;
}

async function downloadToFile(url: string, filename: string): Promise<string> {
  const dest = path.join(OUT_DIR, filename);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  return filename;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wraps a single Replicate call with retry-on-429. The error message
 * contains the retry-after seconds when we get throttled (this is what
 * `replicate-javascript` exposes — there's no typed `retry_after` field).
 */
async function withReplicateRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let attempts = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes("429") || msg.toLowerCase().includes("throttled");
      if (!is429 || attempts >= 5) throw err;
      attempts += 1;
      // Try to read the suggested wait window from the message; default 12s.
      const m = msg.match(/resets? in ~?(\d+)s/);
      const waitSec = m ? parseInt(m[1], 10) + 2 : 12 * attempts;
      console.warn(`        [throttle] ${label} hit 429, retry ${attempts}/5 in ${waitSec}s`);
      await sleep(waitSec * 1000);
    }
  }
}

async function ensureFakeUser(): Promise<string> {
  // Create (or update) a dedicated test-bench user so we don't disturb the
  // real account's credit balance. Generous limit so a full run can't run dry.
  const TEST_CLERK_ID = "test-bench-sprint-11";
  const upserted = await db.user.upsert({
    where: { clerkId: TEST_CLERK_ID },
    create: {
      clerkId: TEST_CLERK_ID,
      email: "test-bench-sprint-11@influenceuse-ia.com",
      name: "Test Bench (Sprint 11)",
      plan: "ENTERPRISE",
      creditsLimit: 100_000,
      creditsUsed: 0,
    },
    update: {
      creditsLimit: 100_000,
      // Reset usage at the start of each run so the test never hits the cap.
      creditsUsed: 0,
    },
    select: { id: true },
  });
  return upserted.id;
}

async function main() {
  console.log(`[test] Run ID: ${RUN_ID}`);
  console.log(`[test] Output dir: ${OUT_DIR}`);
  await fs.mkdir(OUT_DIR, { recursive: true });

  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error(
      "REPLICATE_API_TOKEN is not set. Source your .env or export it before running."
    );
  }

  const userId = await ensureFakeUser();
  console.log(`[test] Using user_id=${userId} for credit accounting`);

  // Allow restricting the run via env vars so we can do a fast sanity check
  // before the full bench: PERSONAS_LIMIT=1 SCENARIOS_LIMIT=1 pnpm tsx ...
  const personaLimit = parseInt(process.env.PERSONAS_LIMIT ?? "100", 10);
  const scenarioLimit = parseInt(process.env.SCENARIOS_LIMIT ?? "100", 10);
  const personasToRun = PERSONAS.slice(0, personaLimit);
  for (const p of personasToRun) p.scenarios = p.scenarios.slice(0, scenarioLimit);
  console.log(
    `[test] Running ${personasToRun.length} persona(s) × ${personasToRun[0]?.scenarios.length ?? 0} scenario(s)`
  );

  const results: PersonaResult[] = [];

  let firstPersona = true;
  for (const persona of personasToRun) {
    if (!firstPersona) {
      // Wait between personas to give the rate-limit window time to reset.
      await sleep(parseInt(process.env.PERSONA_SPACING_MS ?? "15000", 10));
    }
    firstPersona = false;
    console.log(`\n══════ ${persona.label} ══════`);
    const result: PersonaResult = {
      persona,
      baseImageUrl: null,
      baseError: null,
      baseDurationMs: 0,
      scenarios: [],
    };

    // 1) Base portrait
    const tBase = Date.now();
    try {
      console.log(`  [1/2] Generating base portrait...`);
      const base = await withReplicateRetry(
        () => generateBaseImage(userId, persona.age, persona.style),
        `${persona.id} base`
      );
      result.baseImageUrl = base.imageUrls[0];
      result.baseDurationMs = Date.now() - tBase;
      console.log(`        OK in ${(result.baseDurationMs / 1000).toFixed(1)}s → ${base.imageUrls[0].slice(0, 80)}…`);
    } catch (err) {
      result.baseError = err instanceof Error ? err.message : String(err);
      result.baseDurationMs = Date.now() - tBase;
      console.error(`        FAILED: ${result.baseError}`);
      results.push(result);
      continue;
    }

    // 2) Content scenarios — each uses the base as character reference
    // Throttle: Replicate's free-tier rate limit is 6 req/min when the account
    // balance is below $5 → space requests by ~11s.
    const REQ_SPACING_MS = parseInt(process.env.REQ_SPACING_MS ?? "11000", 10);
    for (const sc of persona.scenarios) {
      await sleep(REQ_SPACING_MS);
      const tSc = Date.now();
      try {
        console.log(`  [2/2] Scenario "${sc.label}" (stresses: ${sc.stresses})`);
        const out = await withReplicateRetry(
          () =>
            generateContentImage(userId, persona.age, persona.style, {
              influencerId: persona.id,
              baseImageUrl: result.baseImageUrl ?? undefined,
              useReferenceFace: true,
              numberOfImages: 1,
              ...sc.input,
            }),
          `${persona.id}/${sc.label}`
        );
        result.scenarios.push({
          label: sc.label,
          stresses: sc.stresses,
          contentImageUrl: out.imageUrls[0],
          promptUsed: out.promptUsed,
          durationMs: Date.now() - tSc,
          error: null,
        });
        console.log(`        OK in ${((Date.now() - tSc) / 1000).toFixed(1)}s`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.scenarios.push({
          label: sc.label,
          stresses: sc.stresses,
          contentImageUrl: null,
          promptUsed: "(generation failed)",
          durationMs: Date.now() - tSc,
          error: msg,
        });
        console.error(`        FAILED: ${msg}`);
      }
    }

    results.push(result);
  }

  // 3) Download every image locally so the report is offline-viewable
  console.log(`\n[test] Downloading images locally...`);
  for (const r of results) {
    if (r.baseImageUrl) {
      try {
        await downloadToFile(r.baseImageUrl, `${r.persona.id}-base.jpg`);
      } catch (e) {
        console.warn(`  download base ${r.persona.id} failed:`, e);
      }
    }
    for (let i = 0; i < r.scenarios.length; i++) {
      const sc = r.scenarios[i];
      if (sc.contentImageUrl) {
        try {
          await downloadToFile(sc.contentImageUrl, `${r.persona.id}-content-${i + 1}.jpg`);
        } catch (e) {
          console.warn(`  download content ${r.persona.id}-${i} failed:`, e);
        }
      }
    }
  }

  // 4) Write report.html and summary.json
  await writeSummary(results);
  await writeReport(results);

  console.log(`\n[test] DONE. Open: ${path.join(OUT_DIR, "report.html")}`);
  process.exit(0);
}

async function writeSummary(results: PersonaResult[]) {
  const summary = {
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    totalPersonas: results.length,
    totalScenarios: results.reduce((s, r) => s + r.scenarios.length, 0),
    failures: {
      base: results.filter((r) => r.baseError).map((r) => r.persona.id),
      scenarios: results.flatMap((r) =>
        r.scenarios.filter((s) => s.error).map((s) => `${r.persona.id}/${s.label}`)
      ),
    },
    timings: results.map((r) => ({
      persona: r.persona.id,
      baseSec: (r.baseDurationMs / 1000).toFixed(1),
      scenarios: r.scenarios.map((s) => ({
        label: s.label,
        sec: (s.durationMs / 1000).toFixed(1),
      })),
    })),
  };
  await fs.writeFile(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify(summary, null, 2)
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function writeReport(results: PersonaResult[]) {
  const sections = results
    .map((r) => {
      const baseImgTag = r.baseImageUrl
        ? `<img src="${r.persona.id}-base.jpg" alt="base ${r.persona.id}" loading="lazy" />`
        : `<div class="err">Base failed: ${escapeHtml(r.baseError ?? "unknown")}</div>`;

      const sc = r.scenarios
        .map((s, i) => {
          const img = s.contentImageUrl
            ? `<img src="${r.persona.id}-content-${i + 1}.jpg" alt="${escapeHtml(s.label)}" loading="lazy" />`
            : `<div class="err">Failed: ${escapeHtml(s.error ?? "unknown")}</div>`;
          return `
        <div class="scenario">
          <div class="scenario-header">
            <span class="badge ${s.stresses.replace(/\s/g, "-")}">stress: ${s.stresses}</span>
            <h3>${escapeHtml(s.label)}</h3>
            <span class="duration">${(s.durationMs / 1000).toFixed(1)}s</span>
          </div>
          ${img}
          <details>
            <summary>Prompt used (${s.promptUsed.length} chars)</summary>
            <pre>${escapeHtml(s.promptUsed)}</pre>
          </details>
        </div>`;
        })
        .join("\n");

      return `
    <section class="persona">
      <header>
        <h2>${escapeHtml(r.persona.label)}</h2>
        <p class="meta">
          ${escapeHtml(r.persona.style.gender ?? "")} ·
          ${r.persona.age}y ·
          ${escapeHtml(r.persona.style.ethnicity ?? "")} ·
          ${escapeHtml(r.persona.style.hairColor ?? "")} ${escapeHtml(r.persona.style.hairStyle ?? "")} hair ·
          ${escapeHtml(r.persona.style.bodyType ?? "")} build
        </p>
      </header>
      <div class="row">
        <div class="base">
          <h3>Base portrait <span class="duration">${(r.baseDurationMs / 1000).toFixed(1)}s</span></h3>
          ${baseImgTag}
        </div>
        <div class="scenarios">${sc}</div>
      </div>
    </section>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Image quality test — ${RUN_ID}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
      background: #0a0a0e;
      color: #e2e8f0;
    }
    h1 {
      font-size: 28px;
      margin: 0 0 4px 0;
      background: linear-gradient(135deg, #c084fc, #818cf8);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .subtitle { color: #94a3b8; margin: 0 0 32px 0; font-size: 14px; }

    .persona {
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid rgba(148, 163, 184, 0.1);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 32px;
    }
    .persona header h2 { margin: 0 0 4px 0; font-size: 22px; color: #f1f5f9; }
    .persona .meta { color: #94a3b8; font-size: 13px; margin: 0 0 20px 0; }
    .row { display: grid; grid-template-columns: 280px 1fr; gap: 20px; }
    .base h3 { margin: 0 0 8px 0; font-size: 13px; font-weight: 500; color: #cbd5e1; display: flex; justify-content: space-between; }
    .base img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 12px; border: 2px solid rgba(192, 132, 252, 0.3); }
    .scenarios { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .scenario { background: rgba(15, 23, 42, 0.6); border-radius: 12px; padding: 12px; }
    .scenario-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .scenario h3 { margin: 0; font-size: 13px; font-weight: 500; flex: 1; min-width: 0; color: #e2e8f0; }
    .scenario img { width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 8px; }
    .duration { font-size: 11px; color: #64748b; font-variant-numeric: tabular-nums; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .badge.outfit { background: rgba(244, 114, 182, 0.15); color: #f9a8d4; }
    .badge.non-studio-look { background: rgba(56, 189, 248, 0.15); color: #7dd3fc; }
    .badge.identity { background: rgba(34, 197, 94, 0.15); color: #86efac; }
    .err { padding: 12px; background: rgba(239, 68, 68, 0.1); color: #fca5a5; border-radius: 8px; font-size: 12px; }
    details { margin-top: 8px; font-size: 11px; }
    details summary { cursor: pointer; color: #64748b; }
    details pre { background: rgba(15, 23, 42, 0.8); padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 10px; line-height: 1.5; max-height: 200px; }

    @media (max-width: 1100px) {
      .row { grid-template-columns: 1fr; }
      .scenarios { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 700px) {
      .scenarios { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <h1>Image-quality test bench</h1>
  <p class="subtitle">Run ${RUN_ID} · Sprint 11 prompt &amp; model refactor (Flux Kontext Pro for content, iPhone-amateur prompt structure)</p>
  ${sections}
</body>
</html>`;
  await fs.writeFile(path.join(OUT_DIR, "report.html"), html);
}

main().catch((err) => {
  console.error("[test] FATAL:", err);
  process.exit(1);
});
