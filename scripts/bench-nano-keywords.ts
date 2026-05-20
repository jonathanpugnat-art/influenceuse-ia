/**
 * Bench Nano vs Kontext on keyword / phrase probes.
 *
 * For each probe, runs the same `buildFullPrompt` on nano-banana and
 * flux-kontext-pro (with a shared base portrait). Logs which engine succeeds
 * and suggests BORDERLINE_KEYWORDS updates.
 *
 * Usage:
 *   npx tsx scripts/bench-nano-keywords.ts
 *   PROBES_LIMIT=5 npx tsx scripts/bench-nano-keywords.ts
 *
 * Requires REPLICATE_API_TOKEN and costs ~2 × PROBES_LIMIT predictions.
 */

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Replicate from "replicate";
import {
  buildBasePortraitPrompt,
  buildFullPrompt,
  PORTRAIT_IMAGE_PARAMS,
  KONTEXT_IMAGE_PARAMS,
} from "../src/lib/prompts/image-prompts";
import {
  BORDERLINE_KEYWORDS,
  getMatchedBorderlineKeywords,
  shouldRouteToKontext,
} from "../src/lib/prompts/nano-borderline";
import { isContentSafetyFilterError } from "../src/lib/generation-errors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT_DIR = path.join(ROOT, "test-output", `nano-keywords-${RUN_ID}`);

const MODEL_NANO = "google/nano-banana";
const MODEL_KONTEXT = "black-forest-labs/flux-kontext-pro";
const MODEL_BASE = "black-forest-labs/flux-1.1-pro";

/** Probes: phrase injected into outfit or customPrompt to stress Nano. */
const PROBES: Array<{ label: string; outfit?: string; customPrompt?: string; scene?: string }> = [
  { label: "safe-control", outfit: "oversized hoodie and jeans", scene: "cafe" },
  { label: "beach-bikini", outfit: "bikini", scene: "beach" },
  { label: "gym-leggings", outfit: "leggings sports bra", scene: "gym" },
  { label: "mirror-selfie", customPrompt: "gym mirror selfie tight crop top" },
  { label: "nightclub", outfit: "bodycon dress", scene: "nightclub" },
  { label: "bedroom", scene: "bedroom", outfit: "silk pajamas" },
  { label: "pool", scene: "pool", outfit: "one piece swimsuit" },
  { label: "crop-top-street", outfit: "crop top high waist jeans", scene: "street" },
];

const PERSONA = {
  gender: "female" as const,
  age: 24,
  ethnicity: "caucasian",
  hairColor: "brown",
  hairStyle: "long straight",
  bodyType: "slim",
  fashionStyle: "casual",
};

async function runModel(
  replicate: Replicate,
  model: string,
  prompt: string,
  baseUrl: string
): Promise<{ ok: boolean; error?: string; ms: number }> {
  const start = Date.now();
  try {
    const input =
      model === MODEL_NANO
        ? { prompt, image_input: [baseUrl], aspect_ratio: "3:4", output_format: "jpg" }
        : { ...KONTEXT_IMAGE_PARAMS, prompt, input_image: baseUrl };

    await replicate.run(model as `${string}/${string}`, { input });
    return { ok: true, ms: Date.now() - start };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: msg.slice(0, 200),
      ms: Date.now() - start,
      safety: isContentSafetyFilterError(e),
    } as { ok: boolean; error?: string; ms: number; safety?: boolean };
  }
}

async function main() {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN missing");
  }

  const limit = Math.min(
    PROBES.length,
    parseInt(process.env.PROBES_LIMIT ?? String(PROBES.length), 10)
  );
  const probes = PROBES.slice(0, limit);

  await fs.mkdir(OUT_DIR, { recursive: true });
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  console.log("[bench-nano-keywords] Generating shared base portrait…");
  const basePrompt = buildBasePortraitPrompt({
    age: PERSONA.age,
    gender: PERSONA.gender,
    ethnicity: PERSONA.ethnicity,
    hairColor: PERSONA.hairColor,
    hairStyle: PERSONA.hairStyle,
    bodyType: PERSONA.bodyType,
    fashionStyle: PERSONA.fashionStyle,
  });

  const baseOut = await replicate.run(MODEL_BASE, {
    input: { ...PORTRAIT_IMAGE_PARAMS, prompt: basePrompt, safety_tolerance: 5 },
  });
  const baseUrl = String(Array.isArray(baseOut) ? baseOut[0] : baseOut);
  console.log("[bench-nano-keywords] Base URL:", baseUrl.slice(0, 80), "…");

  const results: Array<Record<string, unknown>> = [];

  for (const probe of probes) {
    const fields = {
      scene: probe.scene ?? "street",
      outfit: probe.outfit ?? "",
      customPrompt: probe.customPrompt,
      pose: "standing",
      expression: "smile",
    };
    const routed = shouldRouteToKontext(fields);
    const matched = getMatchedBorderlineKeywords(fields);

    const nanoPrompt = buildFullPrompt({
      ...PERSONA,
      ...fields,
      useReferenceFace: true,
      contentEngine: "nano",
    });
    const kontextPrompt = buildFullPrompt({
      ...PERSONA,
      ...fields,
      useReferenceFace: true,
      contentEngine: "kontext",
    });

    console.log(`\n[probe] ${probe.label} (router→${routed ? "kontext" : "nano"}, matched: ${matched.join(",") || "—"})`);

    const nano = await runModel(replicate, MODEL_NANO, nanoPrompt, baseUrl);
    const kontext = await runModel(replicate, MODEL_KONTEXT, kontextPrompt, baseUrl);

    const row = {
      label: probe.label,
      routerWouldUseKontext: routed,
      matchedKeywords: matched,
      nanoOk: nano.ok,
      nanoError: nano.error,
      nanoSafety: (nano as { safety?: boolean }).safety,
      kontextOk: kontext.ok,
      kontextError: kontext.error,
      suggestAddToBorderline:
        !nano.ok && kontext.ok && matched.length === 0 ? probe.label : null,
    };
    results.push(row);
    console.log("  nano:", nano.ok ? "OK" : `FAIL ${nano.error}`);
    console.log("  kontext:", kontext.ok ? "OK" : `FAIL ${kontext.error}`);
  }

  const suggestNew = results
    .filter((r) => r.suggestAddToBorderline)
    .map((r) => r.suggestAddToBorderline);

  const summary = {
    runId: RUN_ID,
    probes: results,
    currentKeywordCount: BORDERLINE_KEYWORDS.length,
    suggestReviewProbes: suggestNew,
  };

  await fs.writeFile(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log(`\n[bench-nano-keywords] Done. Summary: ${path.join(OUT_DIR, "summary.json")}`);
  if (suggestNew.length) {
    console.log("Consider adding keywords for probes:", suggestNew.join(", "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
