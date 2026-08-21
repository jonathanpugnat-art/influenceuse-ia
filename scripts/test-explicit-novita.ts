/**
 * Explicit-tier bench — Novita InstantID face-lock.
 *
 * Pipeline:
 *   1. Generate one SFW base portrait (Flux 1.1 Pro) = face reference
 *   2. Run InstantID with RealVisXL V5.0 (recommended) + current epicrealism
 *      on the SAME face + SAME prompt, for a fair A/B
 *   3. Download locally + write a 2-column HTML report
 *
 * Usage:
 *   npx tsx scripts/test-explicit-novita.ts
 *
 * Cost (rough): 1 Flux base + 2 InstantID × 2 checkpoints ≈ 5 API calls.
 * Upscale is OFF here (we isolate checkpoint quality).
 */

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Replicate from "replicate";

import {
  buildBasePortraitPrompt,
  buildNegativePrompt,
  PORTRAIT_IMAGE_PARAMS,
} from "../src/lib/prompts/image-prompts";
import { buildPremiumFaceLockPrompt } from "../src/lib/prompts/premium-face-lock-prompt";
import { buildPremiumNegativePromptForTier } from "../src/lib/prompts/premium-negative";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT_DIR = path.join(ROOT, "test-output", `explicit-novita-${RUN_ID}`);

const NOVITA_INSTANTID_URL = "https://api.novita.ai/v3/async/instant-id";
const NOVITA_TASK_RESULT_URL = "https://api.novita.ai/v3/async/task-result";
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 180_000;

interface Checkpoint {
  id: string;
  label: string;
  model: string;
}

const CHECKPOINTS: Checkpoint[] = [
  {
    id: "realvis-v5",
    label: "RealVisXL V5.0 (recommandé)",
    model: "realvisxlV50_v50.safetensors",
  },
  {
    id: "epicrealism-v1",
    label: "epiCRealism XL v1.0 (actuel)",
    model: "epicrealismXL_v10_247189.safetensors",
  },
];

const PERSONA = {
  id: "luna",
  label: "Luna — femme blonde fitness",
  age: 24,
  gender: "female" as const,
  ethnicity: "caucasian",
  hairColor: "blonde",
  hairStyle: "long wavy",
  bodyType: "athletic",
  fashionStyle: "sporty",
};

const SCENARIOS = [
  {
    id: "sc1",
    label: "Boudoir chambre — lumière douce",
    sceneDescription: "intimate bedroom, silk sheets, soft warm lamp light, boudoir atmosphere",
    outfit: undefined as string | undefined,
  },
  {
    id: "sc2",
    label: "Salle de bain miroir — lumière naturelle",
    sceneDescription: "modern bathroom, large mirror, soft window light, tiled walls",
    outfit: undefined as string | undefined,
  },
];

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getNovitaKey(): string {
  const key = process.env.NOVITA_API_KEY?.trim();
  if (!key) throw new Error("NOVITA_API_KEY is not set in .env");
  return key;
}

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
  throw new Error(`Cannot extract URL: ${s.slice(0, 200)}`);
}

function extractFirstUrl(output: unknown): string {
  if (Array.isArray(output)) return extractUrl(output[0]);
  return extractUrl(output);
}

async function generateBasePortrait(): Promise<{ url: string; ms: number }> {
  const prompt = buildBasePortraitPrompt({
    age: PERSONA.age,
    gender: PERSONA.gender,
    ethnicity: PERSONA.ethnicity,
    hairColor: PERSONA.hairColor,
    hairStyle: PERSONA.hairStyle,
    bodyType: PERSONA.bodyType,
    fashionStyle: PERSONA.fashionStyle,
  });
  const t0 = Date.now();
  const out = await replicate.run("black-forest-labs/flux-1.1-pro", {
    input: {
      ...PORTRAIT_IMAGE_PARAMS,
      prompt,
      negative_prompt: buildNegativePrompt(false, PERSONA.gender),
      num_outputs: 1,
      safety_tolerance: 5,
    },
  });
  return { url: extractFirstUrl(out), ms: Date.now() - t0 };
}

async function submitInstantId(
  apiKey: string,
  model: string,
  faceUrl: string,
  prompt: string,
  negativePrompt: string
): Promise<string> {
  const body = {
    model_name: model,
    face_image_urls: [faceUrl],
    prompt,
    negative_prompt: negativePrompt,
    id_strength: 0.72,
    adapter_strength: 0.75,
    steps: 40,
    guidance_scale: 5.0,
    sampler_name: "DPM++ 2M Karras",
    width: 1024,
    height: 1280,
    image_num: 1,
    seed: Math.floor(Math.random() * 2147483647),
    extra: {
      response_image_type: "jpeg",
      enable_nsfw_detection: false,
    },
  };

  const res = await fetch(NOVITA_INSTANTID_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Novita submit ${res.status}: ${text.slice(0, 280)}`);
  }

  const json = (await res.json()) as { task_id?: string };
  if (!json.task_id?.trim()) throw new Error("Novita returned no task_id");
  return json.task_id.trim();
}

async function pollInstantId(apiKey: string, taskId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${NOVITA_TASK_RESULT_URL}?task_id=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Novita poll ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      task?: { status?: string; reason?: string };
      images?: Array<{ image_url?: string }>;
    };
    const status = json.task?.status;
    if (status === "TASK_STATUS_SUCCEED") {
      const url = json.images?.[0]?.image_url?.trim();
      if (!url?.startsWith("http")) throw new Error("Novita succeeded with no URL");
      return url;
    }
    if (status === "TASK_STATUS_FAILED") {
      throw new Error(`Novita failed: ${json.task?.reason || "unknown"}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Novita timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

interface RunResult {
  checkpointId: string;
  url: string | null;
  durationMs: number;
  error: string | null;
}

interface ScenarioResult {
  id: string;
  label: string;
  promptUsed: string;
  perCheckpoint: RunResult[];
}

async function downloadToFile(url: string, filename: string): Promise<void> {
  const dest = path.join(OUT_DIR, filename);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function writeReport(
  baseUrl: string | null,
  baseMs: number,
  scenarios: ScenarioResult[]
) {
  const baseTag = baseUrl
    ? `<img src="base-portrait.jpg" alt="base" />`
    : `<div class="err">Base failed</div>`;

  const sections = scenarios
    .map((sc) => {
      const cells = sc.perCheckpoint
        .map((r) => {
          const img = r.url
            ? `<img src="${sc.id}-${r.checkpointId}.jpg" alt="${escapeHtml(r.checkpointId)}" />`
            : `<div class="err">${escapeHtml(r.error ?? "no output")}</div>`;
          const cp = CHECKPOINTS.find((c) => c.id === r.checkpointId);
          return `
            <div class="cell">
              <div class="cell-head">
                <span class="tag">${escapeHtml(cp?.label ?? r.checkpointId)}</span>
                <span class="dur">${(r.durationMs / 1000).toFixed(1)}s</span>
              </div>
              ${img}
            </div>`;
        })
        .join("");
      return `
        <div class="scenario">
          <h3>${escapeHtml(sc.label)}</h3>
          <div class="grid2">${cells}</div>
          <details><summary>Prompt</summary><pre>${escapeHtml(sc.promptUsed)}</pre></details>
        </div>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8" />
<title>Explicit Novita A/B — ${RUN_ID}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 32px; font-family: -apple-system, sans-serif; background: #0a0a0e; color: #e2e8f0; }
  h1 { margin: 0 0 4px; background: linear-gradient(135deg,#f472b6,#818cf8); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .sub { color: #94a3b8; margin: 0 0 28px; font-size: 14px; }
  .row { display: grid; grid-template-columns: 240px 1fr; gap: 20px; }
  .base img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 12px; }
  .scenario { background: rgba(15,23,42,.6); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .scenario h3 { margin: 0 0 12px; font-size: 15px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .cell { background: rgba(2,6,23,.5); border-radius: 8px; padding: 8px; }
  .cell-head { display: flex; justify-content: space-between; margin-bottom: 6px; gap: 8px; }
  .tag { font-size: 11px; color: #a5b4fc; }
  .dur { font-size: 11px; color: #64748b; }
  .cell img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 6px; }
  .err { padding: 10px; background: rgba(239,68,68,.1); color: #fca5a5; border-radius: 6px; font-size: 11px; }
  details { margin-top: 10px; font-size: 11px; color: #64748b; }
  pre { background: #0f172a; padding: 10px; border-radius: 6px; overflow: auto; max-height: 180px; font-size: 10px; }
  @media (max-width: 900px) { .row, .grid2 { grid-template-columns: 1fr; } }
</style>
</head><body>
  <h1>Explicit Novita A/B</h1>
  <p class="sub">Run ${RUN_ID} · même visage · même prompt · RealVisXL V5.0 vs epiCRealism v1.0 · InstantID face-lock</p>
  <div class="row">
    <div class="base">
      <h3>Base portrait <span class="dur">${(baseMs / 1000).toFixed(1)}s</span></h3>
      ${baseTag}
    </div>
    <div>${sections}</div>
  </div>
</body></html>`;
  await fs.writeFile(path.join(OUT_DIR, "report.html"), html);
}

async function main() {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN missing");
  }
  const apiKey = getNovitaKey();

  console.log(`[explicit-novita] Run ID: ${RUN_ID}`);
  console.log(`[explicit-novita] Output: ${OUT_DIR}`);
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log("\n[1] Base portrait (Flux 1.1 Pro)...");
  let baseUrl: string;
  let baseMs: number;
  try {
    const base = await generateBasePortrait();
    baseUrl = base.url;
    baseMs = base.ms;
    console.log(`    OK in ${(baseMs / 1000).toFixed(1)}s`);
    await downloadToFile(baseUrl, "base-portrait.jpg");
  } catch (err) {
    console.error("    FAILED:", err);
    process.exit(1);
  }

  // Novita InstantID rejects negatives longer than 1024 runes (same clamp as
  // the production provider).
  const negativeRaw = buildPremiumNegativePromptForTier("explicit", PERSONA.gender, {
    lockFace: true,
  });
  const negative =
    negativeRaw.length <= 1024
      ? negativeRaw
      : (() => {
          const slice = negativeRaw.slice(0, 1024);
          const lastComma = slice.lastIndexOf(",");
          return (lastComma > 700 ? slice.slice(0, lastComma) : slice).trim();
        })();
  console.log(`[explicit-novita] negative_prompt length: ${negative.length}/1024`);
  const scenarios: ScenarioResult[] = [];

  for (const [si, sc] of SCENARIOS.entries()) {
    if (si > 0) await sleep(3000);
    console.log(`\n[2.${si + 1}] ${sc.label}`);

    const prompt = buildPremiumFaceLockPrompt(
      {
        gender: PERSONA.gender,
        age: PERSONA.age,
        ethnicity: PERSONA.ethnicity,
        hairColor: PERSONA.hairColor,
        hairStyle: PERSONA.hairStyle,
        bodyType: PERSONA.bodyType,
        fashionStyle: PERSONA.fashionStyle,
        sceneDescription: sc.sceneDescription,
        outfit: sc.outfit,
        useReferenceFace: true,
        isNsfw: true,
        nsfwLevel: "explicit",
      },
      "explicit"
    );

    const perCheckpoint: RunResult[] = [];
    // Sequential to avoid Novita rate limits
    for (const cp of CHECKPOINTS) {
      const t0 = Date.now();
      try {
        console.log(`    → ${cp.id} (${cp.model})...`);
        const taskId = await submitInstantId(apiKey, cp.model, baseUrl, prompt, negative);
        const url = await pollInstantId(apiKey, taskId);
        const durationMs = Date.now() - t0;
        console.log(`      OK in ${(durationMs / 1000).toFixed(1)}s`);
        await downloadToFile(url, `${sc.id}-${cp.id}.jpg`);
        perCheckpoint.push({ checkpointId: cp.id, url, durationMs, error: null });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`      FAILED: ${msg.slice(0, 160)}`);
        perCheckpoint.push({
          checkpointId: cp.id,
          url: null,
          durationMs: Date.now() - t0,
          error: msg,
        });
      }
    }

    scenarios.push({
      id: sc.id,
      label: sc.label,
      promptUsed: prompt,
      perCheckpoint,
    });
  }

  const summary = {
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    baseMs,
    checkpoints: CHECKPOINTS,
    scenarios: scenarios.map((sc) => ({
      id: sc.id,
      label: sc.label,
      results: sc.perCheckpoint.map((r) => ({
        checkpoint: r.checkpointId,
        sec: (r.durationMs / 1000).toFixed(1),
        ok: !r.error,
        error: r.error,
      })),
    })),
  };
  await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  await writeReport(baseUrl, baseMs, scenarios);

  console.log(`\n[explicit-novita] DONE → ${path.join(OUT_DIR, "report.html")}`);
}

main().catch((err) => {
  console.error("[explicit-novita] FATAL:", err);
  process.exit(1);
});
