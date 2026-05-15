/**
 * Engines A/B/C bench — runs the SAME prompts on three Replicate SFW
 * image models, in parallel, so we can compare them side-by-side:
 *
 *   A) black-forest-labs/flux-1.1-pro     (T2I, no reference)
 *   B) black-forest-labs/flux-kontext-pro (image-ref preserving identity)
 *   C) google/nano-banana                 (Gemini 2.5 Flash Image)
 *
 * Pipeline per persona:
 *   1. Generate a base portrait with Flux 1.1 Pro (single source of truth
 *      for the face). All three engines then use that exact same URL as
 *      reference for the content scenarios (when the model supports it).
 *   2. For each scenario, fire one prediction per engine in parallel,
 *      with the SAME positive prompt (built by `buildFullPrompt`). Flux
 *      1.1 Pro has no `input_image` slot so it generates from prompt
 *      only — by design, this isolates how much the reference helps the
 *      other two.
 *
 * Outputs in ./test-output/engines-<run-id>/
 *   - base / scenario images downloaded locally
 *   - summary.json with timings per engine + per scenario
 *   - report.html with a 3-column comparison
 *
 * Usage:
 *   PERSONAS_LIMIT=2 SCENARIOS_LIMIT=2 npx tsx scripts/test-engines-ab.ts
 *
 * Cost (rough): 1 base (Flux 1.1 Pro) + (3 engines × scenarios) per persona.
 * For 4 personas × 3 scenarios × 3 engines = 36 content calls + 4 bases
 * ≈ $1.80 USD on Replicate at current prices.
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
  DEFAULT_IMAGE_PARAMS,
  PORTRAIT_IMAGE_PARAMS,
  KONTEXT_IMAGE_PARAMS,
  type Gender,
} from "../src/lib/prompts/image-prompts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT_DIR = path.join(ROOT, "test-output", `engines-${RUN_ID}`);

// ──────────────────────────────────────────────
// Engines under test
// ──────────────────────────────────────────────

type EngineId = "flux-1.1-pro" | "flux-kontext-pro" | "nano-banana";

interface EngineDescriptor {
  id: EngineId;
  model: `${string}/${string}`;
  /** Whether the model accepts a base image to preserve identity. */
  acceptsRef: boolean;
  /** Build the Replicate input for one prediction given the shared prompt + base URL. */
  buildInput: (prompt: string, baseImageUrl: string | null, isPortrait: boolean) => Record<string, unknown>;
}

const ENGINES: EngineDescriptor[] = [
  {
    id: "flux-1.1-pro",
    model: "black-forest-labs/flux-1.1-pro",
    acceptsRef: false,
    buildInput: (prompt, _base, isPortrait) => ({
      ...(isPortrait ? PORTRAIT_IMAGE_PARAMS : DEFAULT_IMAGE_PARAMS),
      prompt,
      safety_tolerance: 5,
    }),
  },
  {
    id: "flux-kontext-pro",
    model: "black-forest-labs/flux-kontext-pro",
    acceptsRef: true,
    buildInput: (prompt, base, _isPortrait) => {
      const out: Record<string, unknown> = {
        ...KONTEXT_IMAGE_PARAMS,
        prompt,
      };
      if (base) out.input_image = base;
      return out;
    },
  },
  {
    id: "nano-banana",
    model: "google/nano-banana",
    acceptsRef: true,
    buildInput: (prompt, base, _isPortrait) => ({
      prompt,
      image_input: base ? [base] : [],
      aspect_ratio: "3:4",
      output_format: "jpg",
    }),
  },
];

// ──────────────────────────────────────────────
// Personas — same as Sprint 11 bench
// ──────────────────────────────────────────────

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
        label: "Salle de sport — débardeur rose vif",
        stresses: "outfit",
        scene: "gym",
        pose: "fullBody",
        expression: "natural",
        style: "fashion_campaign",
        lighting: "natural",
        outfit: "hot pink tank top, black leggings, white sneakers",
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
        scene: "urban",
        pose: "fullBody",
        expression: "serious",
        style: "street_style",
        lighting: "blue_hour",
        outfit:
          "olive green bomber jacket, white t-shirt, baggy carpenter jeans, dark Air Force 1 sneakers",
      },
      {
        label: "Rooftop apéro — chemise hawaïenne",
        stresses: "non-studio look",
        scene: "rooftop",
        pose: "candid",
        expression: "laughing",
        style: "vintage",
        lighting: "golden_hour",
        outfit:
          "open Hawaiian shirt with palm tree print, plain black t-shirt underneath, tan cargo shorts",
      },
      {
        label: "Sport — débardeur orange",
        stresses: "identity",
        scene: "gym",
        pose: "fullBody",
        expression: "serious",
        style: "natural",
        lighting: "natural",
        outfit: "bright orange sleeveless gym tank top, grey shorts",
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
        scene: "restaurant",
        pose: "sitting",
        expression: "seductive",
        style: "glamour",
        lighting: "dramatic",
        outfit:
          "fitted red satin midi dress with thin straps, gold hoop earrings",
      },
      {
        label: "Plage — paréo motif léopard",
        stresses: "non-studio look",
        scene: "beach",
        pose: "action",
        expression: "playful",
        style: "natural",
        lighting: "natural",
        outfit:
          "black bikini top with leopard-print sarong tied at the waist, gold ankle bracelet",
      },
      {
        label: "Boutique — total look denim",
        stresses: "identity",
        scene: "urban",
        pose: "fullBody",
        expression: "natural",
        style: "fashion_campaign",
        lighting: "natural",
        outfit:
          "head-to-toe denim outfit, oversized denim jacket and matching wide-leg jeans, white tank top underneath",
        location: "Soho New York",
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
        scene: "cafe",
        pose: "sitting",
        expression: "natural",
        style: "minimalist",
        lighting: "natural",
        outfit:
          "plain black turtleneck sweater, beige wool overcoat draped on the chair",
      },
      {
        label: "Tokyo — t-shirt blanc et pantalon ample",
        stresses: "non-studio look",
        scene: "urban",
        pose: "fullBody",
        expression: "natural",
        style: "street_style",
        lighting: "neon",
        outfit:
          "plain oversized white t-shirt, wide-leg dark navy trousers, white socks visible above black loafers",
        location: "Shibuya Tokyo",
      },
      {
        label: "Chambre — peignoir blanc",
        stresses: "identity",
        scene: "bedroom",
        pose: "candid",
        expression: "natural",
        style: "minimalist",
        lighting: "natural",
        outfit: "plain white waffle bathrobe, hair slightly damp",
      },
    ],
  },
];

// ──────────────────────────────────────────────
// Replicate plumbing
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// Bench
// ──────────────────────────────────────────────

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
  baseImageUrl: string | null,
  label: string
): Promise<EngineRunResult> {
  const t0 = Date.now();
  try {
    const url = await runPrediction(
      eng.model,
      eng.buildInput(prompt, baseImageUrl, false),
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

async function main() {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN is not set. Source your .env first.");
  }

  console.log(`[engines-ab] Run ID: ${RUN_ID}`);
  console.log(`[engines-ab] Output dir: ${OUT_DIR}`);
  await fs.mkdir(OUT_DIR, { recursive: true });

  const personaLimit = parseInt(process.env.PERSONAS_LIMIT ?? "100", 10);
  const scenarioLimit = parseInt(process.env.SCENARIOS_LIMIT ?? "100", 10);
  const personasToRun = PERSONAS.slice(0, personaLimit);
  for (const p of personasToRun) p.scenarios = p.scenarios.slice(0, scenarioLimit);

  const totalCalls =
    personasToRun.length * (1 + personasToRun[0]?.scenarios.length * ENGINES.length);
  console.log(
    `[engines-ab] Plan: ${personasToRun.length} persona(s) × ${personasToRun[0]?.scenarios.length ?? 0} scenario(s) × ${ENGINES.length} engine(s) ≈ ${totalCalls} Replicate calls`
  );

  const results: PersonaResult[] = [];

  for (const [pi, persona] of personasToRun.entries()) {
    if (pi > 0) {
      const wait = parseInt(process.env.PERSONA_SPACING_MS ?? "10000", 10);
      console.log(`\n[engines-ab] cooling ${wait / 1000}s between personas...`);
      await sleep(wait);
    }
    console.log(`\n══════ ${persona.label} ══════`);

    const result: PersonaResult = {
      persona,
      baseImageUrl: null,
      baseError: null,
      baseDurationMs: 0,
      scenarios: [],
    };

    // ── 1) Base portrait (single source of truth for the face) ──────────
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

    // ── 2) For each scenario, run the 3 engines IN PARALLEL on same prompt
    const REQ_SPACING_MS = parseInt(process.env.REQ_SPACING_MS ?? "12000", 10);
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
        // Flux 1.1 Pro has no input_image, but we keep the identity-lock
        // phrasing because the other two engines do. The prompt is shared
        // by construction — that's the whole point of the A/B/C.
        useReferenceFace: true,
        isNsfw: false,
      });

      const perEngine = await Promise.all(
        ENGINES.map((eng) =>
          runEngineForScenario(eng, prompt, result.baseImageUrl, sc.label)
        )
      );
      for (const e of perEngine) {
        const tag = e.error ? `FAILED (${e.error.slice(0, 60)})` : "OK";
        console.log(`        ${e.engine.padEnd(18)} ${(e.durationMs / 1000).toFixed(1)}s  ${tag}`);
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

  // ── 3) Download all images locally ──────────────────────────────────────
  console.log(`\n[engines-ab] Downloading images locally...`);
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

  console.log(`\n[engines-ab] DONE. Open: ${path.join(OUT_DIR, "report.html")}`);
  process.exit(0);
}

async function writeSummary(results: PersonaResult[]) {
  const perEngineTimes: Record<EngineId, number[]> = {
    "flux-1.1-pro": [],
    "flux-kontext-pro": [],
    "nano-banana": [],
  };
  const perEngineFails: Record<EngineId, number> = {
    "flux-1.1-pro": 0,
    "flux-kontext-pro": 0,
    "nano-banana": 0,
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
      acceptsRef: e.acceptsRef,
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
              <div class="grid3">${cells}</div>
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
  <title>Engines A/B/C — ${RUN_ID}</title>
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
    .persona { background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 16px; padding: 24px; margin-bottom: 32px; }
    .persona header h2 { margin: 0 0 4px 0; font-size: 22px; color: #f1f5f9; }
    .persona .meta { color: #94a3b8; font-size: 13px; margin: 0 0 20px 0; }
    .row { display: grid; grid-template-columns: 280px 1fr; gap: 20px; }
    .base h3 { margin: 0 0 8px 0; font-size: 13px; font-weight: 500; color: #cbd5e1; display: flex; justify-content: space-between; }
    .base img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 12px; border: 2px solid rgba(192, 132, 252, 0.3); }
    .scenarios { display: flex; flex-direction: column; gap: 20px; }
    .scenario { background: rgba(15, 23, 42, 0.6); border-radius: 12px; padding: 16px; }
    .scenario-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .scenario h3 { margin: 0; font-size: 14px; flex: 1; color: #e2e8f0; }
    .badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .badge.outfit { background: rgba(244, 114, 182, 0.15); color: #f9a8d4; }
    .badge.non-studio-look { background: rgba(56, 189, 248, 0.15); color: #7dd3fc; }
    .badge.identity { background: rgba(34, 197, 94, 0.15); color: #86efac; }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .cell { background: rgba(2, 6, 23, 0.5); border-radius: 8px; padding: 8px; }
    .cell-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .engine-tag { font-size: 10px; font-family: ui-monospace, "SF Mono", monospace; padding: 2px 6px; border-radius: 4px; }
    .engine-flux-1\\.1-pro { background: rgba(251, 191, 36, 0.15); color: #fcd34d; }
    .engine-flux-kontext-pro { background: rgba(168, 85, 247, 0.15); color: #d8b4fe; }
    .engine-nano-banana { background: rgba(34, 197, 94, 0.15); color: #86efac; }
    .cell img { width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 6px; }
    .dur { font-size: 11px; color: #64748b; font-variant-numeric: tabular-nums; }
    .err { padding: 10px; background: rgba(239, 68, 68, 0.1); color: #fca5a5; border-radius: 6px; font-size: 11px; }
    details { margin-top: 10px; font-size: 11px; }
    details summary { cursor: pointer; color: #64748b; }
    details pre { background: rgba(15, 23, 42, 0.8); padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 10px; line-height: 1.5; max-height: 220px; }
    @media (max-width: 1100px) { .row { grid-template-columns: 1fr; } }
    @media (max-width: 700px) { .grid3 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>Engines A/B/C bench</h1>
  <p class="subtitle">Run ${RUN_ID} · Flux 1.1 Pro vs Flux Kontext Pro vs Google Nano Banana — same prompts, same base portrait</p>
  ${sections}
</body>
</html>`;
  await fs.writeFile(path.join(OUT_DIR, "report.html"), html);
}

main().catch((err) => {
  console.error("[engines-ab] FATAL:", err);
  process.exit(1);
});
