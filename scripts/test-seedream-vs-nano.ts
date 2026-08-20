/**
 * Nano Banana vs Seedream 4 — head-to-head on the same base face + prompts.
 *
 * Pipeline:
 *   1. Generate one base portrait (Flux 1.1 Pro)
 *   2. For each scenario, fire Nano + Seedream in parallel with the SAME
 *      prompt and the SAME base image as `image_input`
 *   3. Download locally + write a 2-column HTML report
 *
 * Usage:
 *   PERSONAS_LIMIT=1 SCENARIOS_LIMIT=2 npx tsx scripts/test-seedream-vs-nano.ts
 *
 * Cost (rough): 1 base + 2 engines × scenarios. Default 1×2 ≈ 5 Replicate calls.
 */

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Replicate from "replicate";

import {
  buildBasePortraitPrompt,
  buildFullPrompt,
  buildNegativePrompt,
  PORTRAIT_IMAGE_PARAMS,
  type Gender,
} from "../src/lib/prompts/image-prompts";
import {
  MODEL_SFW_NANO,
  MODEL_SFW_SEEDREAM,
  NANO_BANANA_DEFAULTS,
  SEEDREAM_DEFAULTS,
} from "../src/server/services/image/model-constants";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT_DIR = path.join(ROOT, "test-output", `seedream-vs-nano-${RUN_ID}`);

type EngineId = "nano-banana" | "seedream-4";

interface EngineDescriptor {
  id: EngineId;
  model: `${string}/${string}`;
  buildInput: (prompt: string, baseImageUrl: string) => Record<string, unknown>;
}

const ENGINES: EngineDescriptor[] = [
  {
    id: "nano-banana",
    model: MODEL_SFW_NANO,
    buildInput: (prompt, base) => ({
      ...NANO_BANANA_DEFAULTS,
      prompt,
      image_input: [base],
    }),
  },
  {
    id: "seedream-4",
    model: MODEL_SFW_SEEDREAM,
    buildInput: (prompt, base) => ({
      ...SEEDREAM_DEFAULTS,
      prompt,
      image_input: [base],
    }),
  },
];

interface PersonaStyle {
  gender: Gender;
  ethnicity: string;
  hairColor: string;
  hairStyle: string;
  bodyType: string;
  fashionStyle: string;
}

interface Scenario {
  label: string;
  stresses: "outfit" | "non-studio look" | "identity";
  scene: string;
  pose: string;
  expression: string;
  style: string;
  lighting: string;
  outfit: string;
  location?: string;
}

interface Persona {
  id: string;
  label: string;
  age: number;
  style: PersonaStyle;
  scenarios: Scenario[];
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
        label: "Studio beige — brassière + legging (style référentiel SaaS)",
        stresses: "outfit",
        scene: "studio",
        pose: "fullBody",
        expression: "natural",
        style: "fashion_campaign",
        lighting: "natural",
        outfit:
          "beige ribbed sports bra with thin straps, matching high-waisted beige ribbed capri leggings, white sneakers, gold hoop earrings",
      },
      {
        label: "Café matin — sweat oversize beige",
        stresses: "non-studio look",
        scene: "cafe",
        pose: "sitting",
        expression: "natural",
        style: "natural",
        lighting: "natural",
        outfit: "oversized beige hoodie with small coffee stain on the sleeve",
      },
      {
        label: "Selfie chambre — robe d'été",
        stresses: "identity",
        scene: "bedroom",
        pose: "selfie",
        expression: "smile",
        style: "natural",
        lighting: "studio",
        outfit: "yellow floral summer dress",
      },
    ],
  },
];

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractUrl(item: unknown): string {
  const s = String(item);
  if (s.startsWith("http")) return s;
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    if (typeof obj.url === "function") {
      const u = String((obj.url as () => unknown)());
      if (u.startsWith("http")) return u;
    }
    if (typeof obj.url === "string" && obj.url.startsWith("http")) return obj.url;
  }
  throw new Error(`Cannot extract URL from output: ${s.slice(0, 200)}`);
}

function extractFirstUrl(output: unknown): string {
  if (Array.isArray(output)) return extractUrl(output[0]);
  return extractUrl(output);
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let attempts = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes("429") || msg.toLowerCase().includes("throttled");
      if (!is429 || attempts >= 4) throw err;
      attempts += 1;
      const m = msg.match(/resets? in ~?(\d+)s/);
      const waitSec = m ? parseInt(m[1], 10) + 2 : 12 * attempts;
      console.warn(`        [throttle] ${label} 429, retry ${attempts}/4 in ${waitSec}s`);
      await sleep(waitSec * 1000);
    }
  }
}

async function runPrediction(
  model: `${string}/${string}`,
  input: Record<string, unknown>,
  label: string
): Promise<string> {
  return withRetry(label, async () => {
    const out = await replicate.run(model, { input });
    return extractFirstUrl(out);
  });
}

interface EngineRunResult {
  engine: EngineId;
  url: string | null;
  durationMs: number;
  error: string | null;
}

interface ScenarioResult {
  label: string;
  stresses: string;
  promptUsed: string;
  perEngine: EngineRunResult[];
}

interface PersonaResult {
  persona: Persona;
  baseImageUrl: string | null;
  baseError: string | null;
  baseDurationMs: number;
  scenarios: ScenarioResult[];
}

async function downloadToFile(url: string, filename: string): Promise<void> {
  const dest = path.join(OUT_DIR, filename);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

async function generateBase(persona: Persona): Promise<{ url: string; ms: number }> {
  const prompt = buildBasePortraitPrompt({
    age: persona.age,
    gender: persona.style.gender,
    ethnicity: persona.style.ethnicity,
    hairColor: persona.style.hairColor,
    hairStyle: persona.style.hairStyle,
    bodyType: persona.style.bodyType,
    fashionStyle: persona.style.fashionStyle,
  });
  const t0 = Date.now();
  const url = await runPrediction(
    "black-forest-labs/flux-1.1-pro",
    {
      ...PORTRAIT_IMAGE_PARAMS,
      prompt,
      negative_prompt: buildNegativePrompt(false, persona.style.gender),
      num_outputs: 1,
      safety_tolerance: 5,
    },
    `${persona.id} base`
  );
  return { url, ms: Date.now() - t0 };
}

async function runEngineForScenario(
  eng: EngineDescriptor,
  prompt: string,
  baseImageUrl: string,
  label: string
): Promise<EngineRunResult> {
  const t0 = Date.now();
  try {
    const url = await runPrediction(
      eng.model,
      eng.buildInput(prompt, baseImageUrl),
      `${eng.id} ${label}`
    );
    return { engine: eng.id, url, durationMs: Date.now() - t0, error: null };
  } catch (err) {
    return {
      engine: eng.id,
      url: null,
      durationMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function writeSummary(results: PersonaResult[]) {
  const perEngineTimes: Record<EngineId, number[]> = {
    "nano-banana": [],
    "seedream-4": [],
  };
  const perEngineFails: Record<EngineId, number> = {
    "nano-banana": 0,
    "seedream-4": 0,
  };

  for (const r of results) {
    for (const sc of r.scenarios) {
      for (const e of sc.perEngine) {
        if (e.error) perEngineFails[e.engine] += 1;
        else perEngineTimes[e.engine].push(e.durationMs);
      }
    }
  }

  const avg = (arr: number[]): number =>
    arr.length === 0 ? 0 : Math.round(arr.reduce((s, n) => s + n, 0) / arr.length);

  const summary = {
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    personasRun: results.length,
    scenariosPerPersona: results[0]?.scenarios.length ?? 0,
    engines: ENGINES.map((e) => ({
      id: e.id,
      model: e.model,
      avgMs: avg(perEngineTimes[e.id]),
      successes: perEngineTimes[e.id].length,
      failures: perEngineFails[e.id],
    })),
    details: results.map((r) => ({
      persona: r.persona.id,
      baseSec: (r.baseDurationMs / 1000).toFixed(1),
      scenarios: r.scenarios.map((sc) => ({
        label: sc.label,
        stresses: sc.stresses,
        engines: sc.perEngine.map((e) => ({
          engine: e.engine,
          sec: (e.durationMs / 1000).toFixed(1),
          ok: !e.error,
          error: e.error,
        })),
      })),
    })),
  };
  await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
}

async function writeReport(results: PersonaResult[]) {
  const sections = results
    .map((r) => {
      const baseTag = r.baseImageUrl
        ? `<img src="${r.persona.id}-base.jpg" alt="base ${r.persona.id}" loading="lazy" />`
        : `<div class="err">Base failed: ${escapeHtml(r.baseError ?? "unknown")}</div>`;

      const scenariosHtml = r.scenarios
        .map((sc, i) => {
          const cells = sc.perEngine
            .map((e) => {
              const img = e.url
                ? `<img src="${r.persona.id}-sc${i + 1}-${e.engine}.jpg" alt="${escapeHtml(sc.label)} - ${e.engine}" loading="lazy" />`
                : `<div class="err">${escapeHtml(e.error ?? "no output")}</div>`;
              return `
                <div class="cell">
                  <div class="cell-head">
                    <span class="engine-tag engine-${e.engine}">${e.engine}</span>
                    <span class="dur">${(e.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                  ${img}
                </div>`;
            })
            .join("");
          return `
            <div class="scenario">
              <div class="scenario-head">
                <span class="badge ${sc.stresses.replace(/\s/g, "-")}">${sc.stresses}</span>
                <h3>${escapeHtml(sc.label)}</h3>
              </div>
              <div class="grid2">${cells}</div>
              <details>
                <summary>Prompt (${sc.promptUsed.length} chars)</summary>
                <pre>${escapeHtml(sc.promptUsed)}</pre>
              </details>
            </div>`;
        })
        .join("");

      return `
        <section class="persona">
          <header>
            <h2>${escapeHtml(r.persona.label)}</h2>
            <p class="meta">${escapeHtml(r.persona.style.gender)} · ${r.persona.age}y · ${escapeHtml(r.persona.style.ethnicity)} · ${escapeHtml(r.persona.style.hairColor)} ${escapeHtml(r.persona.style.hairStyle)}</p>
          </header>
          <div class="row">
            <div class="base">
              <h3>Base portrait <span class="dur">${(r.baseDurationMs / 1000).toFixed(1)}s</span></h3>
              ${baseTag}
            </div>
            <div class="scenarios">${scenariosHtml}</div>
          </div>
        </section>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Seedream vs Nano — ${RUN_ID}</title>
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
      background: linear-gradient(135deg, #34d399, #818cf8);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .subtitle { color: #94a3b8; margin: 0 0 32px 0; font-size: 14px; }
    .persona { background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 16px; padding: 24px; margin-bottom: 32px; }
    .persona header h2 { margin: 0 0 4px 0; font-size: 22px; color: #f1f5f9; }
    .persona .meta { color: #94a3b8; font-size: 13px; margin: 0 0 20px 0; }
    .row { display: grid; grid-template-columns: 280px 1fr; gap: 20px; }
    .base h3 { margin: 0 0 8px 0; font-size: 13px; font-weight: 500; color: #cbd5e1; display: flex; justify-content: space-between; }
    .base img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 12px; border: 2px solid rgba(52, 211, 153, 0.3); }
    .scenarios { display: flex; flex-direction: column; gap: 20px; }
    .scenario { background: rgba(15, 23, 42, 0.6); border-radius: 12px; padding: 16px; }
    .scenario-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .scenario h3 { margin: 0; font-size: 14px; flex: 1; color: #e2e8f0; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .badge.outfit { background: rgba(244, 114, 182, 0.15); color: #f9a8d4; }
    .badge.non-studio-look { background: rgba(56, 189, 248, 0.15); color: #7dd3fc; }
    .badge.identity { background: rgba(34, 197, 94, 0.15); color: #86efac; }
    .grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .cell { background: rgba(2, 6, 23, 0.5); border-radius: 8px; padding: 8px; }
    .cell-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .engine-tag { font-size: 10px; font-family: ui-monospace, "SF Mono", monospace; padding: 2px 6px; border-radius: 4px; }
    .engine-nano-banana { background: rgba(251, 191, 36, 0.15); color: #fcd34d; }
    .engine-seedream-4 { background: rgba(52, 211, 153, 0.15); color: #6ee7b7; }
    .cell img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 6px; }
    .dur { font-size: 11px; color: #64748b; font-variant-numeric: tabular-nums; }
    .err { padding: 10px; background: rgba(239, 68, 68, 0.1); color: #fca5a5; border-radius: 6px; font-size: 11px; }
    details { margin-top: 10px; font-size: 11px; }
    details summary { cursor: pointer; color: #64748b; }
    details pre { background: rgba(15, 23, 42, 0.8); padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 10px; line-height: 1.5; max-height: 220px; }
    @media (max-width: 1100px) { .row { grid-template-columns: 1fr; } }
    @media (max-width: 700px) { .grid2 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>Seedream 4 vs Nano Banana</h1>
  <p class="subtitle">Run ${RUN_ID} · même portrait de base · mêmes prompts · face-lock via image_input</p>
  ${sections}
</body>
</html>`;
  await fs.writeFile(path.join(OUT_DIR, "report.html"), html);
}

async function main() {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN is not set. Source your .env first.");
  }

  console.log(`[seedream-vs-nano] Run ID: ${RUN_ID}`);
  console.log(`[seedream-vs-nano] Output dir: ${OUT_DIR}`);
  await fs.mkdir(OUT_DIR, { recursive: true });

  const personaLimit = parseInt(process.env.PERSONAS_LIMIT ?? "1", 10);
  const scenarioLimit = parseInt(process.env.SCENARIOS_LIMIT ?? "2", 10);
  const personasToRun = PERSONAS.slice(0, personaLimit);
  for (const p of personasToRun) p.scenarios = p.scenarios.slice(0, scenarioLimit);

  const totalCalls =
    personasToRun.length * (1 + (personasToRun[0]?.scenarios.length ?? 0) * ENGINES.length);
  console.log(
    `[seedream-vs-nano] Plan: ${personasToRun.length} persona(s) × ${personasToRun[0]?.scenarios.length ?? 0} scenario(s) × ${ENGINES.length} engine(s) ≈ ${totalCalls} Replicate calls`
  );

  const results: PersonaResult[] = [];

  for (const persona of personasToRun) {
    console.log(`\n══════ ${persona.label} ══════`);

    const result: PersonaResult = {
      persona,
      baseImageUrl: null,
      baseError: null,
      baseDurationMs: 0,
      scenarios: [],
    };

    try {
      console.log(`  [1] Generating base portrait (Flux 1.1 Pro)...`);
      const { url, ms } = await generateBase(persona);
      result.baseImageUrl = url;
      result.baseDurationMs = ms;
      console.log(`      OK in ${(ms / 1000).toFixed(1)}s`);
    } catch (err) {
      result.baseError = err instanceof Error ? err.message : String(err);
      console.error(`      FAILED: ${result.baseError}`);
      results.push(result);
      continue;
    }

    const REQ_SPACING_MS = parseInt(process.env.REQ_SPACING_MS ?? "8000", 10);
    for (const [si, sc] of persona.scenarios.entries()) {
      if (si > 0) await sleep(REQ_SPACING_MS);
      console.log(`  [2.${si + 1}] Scenario "${sc.label}" (${sc.stresses})`);

      const prompt = buildFullPrompt({
        gender: persona.style.gender,
        age: persona.age,
        ethnicity: persona.style.ethnicity,
        hairColor: persona.style.hairColor,
        hairStyle: persona.style.hairStyle,
        bodyType: persona.style.bodyType,
        fashionStyle: persona.style.fashionStyle,
        scene: sc.scene,
        pose: sc.pose,
        expression: sc.expression,
        style: sc.style,
        lighting: sc.lighting,
        location: sc.location,
        outfit: sc.outfit,
        useReferenceFace: true,
        isNsfw: false,
      });

      const perEngine = await Promise.all(
        ENGINES.map((eng) =>
          runEngineForScenario(eng, prompt, result.baseImageUrl!, sc.label)
        )
      );
      for (const e of perEngine) {
        const tag = e.error ? `FAILED (${e.error.slice(0, 80)})` : "OK";
        console.log(`        ${e.engine.padEnd(14)} ${(e.durationMs / 1000).toFixed(1)}s  ${tag}`);
      }

      result.scenarios.push({
        label: sc.label,
        stresses: sc.stresses,
        promptUsed: prompt,
        perEngine,
      });
    }

    results.push(result);
  }

  console.log(`\n[seedream-vs-nano] Downloading images locally...`);
  for (const r of results) {
    if (r.baseImageUrl) {
      try {
        await downloadToFile(r.baseImageUrl, `${r.persona.id}-base.jpg`);
      } catch (e) {
        console.warn(`  download base ${r.persona.id} failed:`, e);
      }
    }
    for (let i = 0; i < r.scenarios.length; i++) {
      for (const e of r.scenarios[i].perEngine) {
        if (e.url) {
          const fname = `${r.persona.id}-sc${i + 1}-${e.engine}.jpg`;
          try {
            await downloadToFile(e.url, fname);
          } catch (err) {
            console.warn(`  download ${fname} failed:`, err);
          }
        }
      }
    }
  }

  await writeSummary(results);
  await writeReport(results);

  console.log(`\n[seedream-vs-nano] DONE. Open: ${path.join(OUT_DIR, "report.html")}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seedream-vs-nano] FATAL:", err);
  process.exit(1);
});
