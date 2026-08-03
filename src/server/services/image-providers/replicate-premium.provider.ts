import { resolveReplicatePremiumModel } from "@/lib/premium-image-config";
import type { TogetherFluxInput } from "@/server/services/image-providers/together-flux.provider";

let cachedVersionId: string | null = null;
let cachedVersionForSlug: string | null = null;

export const DEFAULT_REPLICATE_PULID_MODEL = "bytedance/flux-pulid" as const;

let cachedPulidVersionId: string | null = null;
let cachedPulidVersionForSlug: string | null = null;

export function isPulidReplicateModel(model: string): boolean {
  const slug = model.split(":")[0]?.toLowerCase() ?? "";
  return slug === DEFAULT_REPLICATE_PULID_MODEL;
}

/** Replicate PuLID requires owner/name:version — bare slug 404s on /models/.../predictions. */
export async function resolveReplicatePulidModelRef(): Promise<string> {
  const configured =
    process.env.PREMIUM_PULID_MODEL?.trim() || DEFAULT_REPLICATE_PULID_MODEL;
  if (configured.includes(":")) {
    return configured;
  }

  if (cachedPulidVersionId && cachedPulidVersionForSlug === configured) {
    return `${configured}:${cachedPulidVersionId}`;
  }

  const res = await fetch(`https://api.replicate.com/v1/models/${configured}`, {
    headers: { Authorization: `Bearer ${getReplicateApiToken()}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[premium-gen] PuLID introuvable sur Replicate (${configured}, HTTP ${res.status}). ${text.slice(0, 120)}`
    );
  }

  const json = (await res.json()) as { latest_version?: { id?: string } };
  const versionId = json.latest_version?.id?.trim();
  if (!versionId) {
    throw new Error(
      `[premium-gen] Aucune version publiée pour PuLID (${configured}) sur Replicate.`
    );
  }

  cachedPulidVersionForSlug = configured;
  cachedPulidVersionId = versionId;
  return `${configured}:${versionId}`;
}

export function sanitizePulidReplicateInput(
  params: Record<string, unknown>
): Record<string, unknown> {
  const numSteps =
    typeof params.num_steps === "number"
      ? Math.min(20, Math.max(1, params.num_steps))
      : 20;
  return {
    main_face_image: params.main_face_image,
    prompt: String(params.prompt ?? ""),
    negative_prompt:
      typeof params.negative_prompt === "string" ? params.negative_prompt : "",
    id_weight: typeof params.id_weight === "number" ? params.id_weight : 0.65,
    start_step: typeof params.start_step === "number" ? params.start_step : 3,
    num_outputs:
      typeof params.num_outputs === "number"
        ? Math.min(4, Math.max(1, params.num_outputs))
        : 1,
    width: typeof params.width === "number" ? params.width : 1024,
    height: typeof params.height === "number" ? params.height : 1280,
    guidance_scale:
      typeof params.guidance_scale === "number" ? params.guidance_scale : 3,
    true_cfg: typeof params.true_cfg === "number" ? params.true_cfg : 3,
    num_steps: numSteps,
    // jpg triggers an internal 'JPG' failure on this Replicate model — webp is stable.
    output_format: "webp",
    output_quality:
      typeof params.output_quality === "number" ? params.output_quality : 90,
    ...(typeof params.seed === "number" ? { seed: params.seed } : {}),
  };
}

export function isAishaPremiumFluxModel(model: string): boolean {
  const slug = model.split(":")[0]?.toLowerCase() ?? "";
  return slug.includes("aisha-ai-official/flux.1dev-uncensored");
}

export function isPremiumUncensoredReplicateModel(model: string): boolean {
  const slug = model.split(":")[0]?.toLowerCase() ?? "";
  if (isAishaPremiumFluxModel(model)) return true;
  if (slug.includes("uncensored")) return true;
  return slug === resolveReplicatePremiumModel().split(":")[0]?.toLowerCase();
}

function getReplicateApiToken(): string {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not configured. Set it in your .env file.");
  }
  return token.replace(/^"|"$/g, "");
}

/** Replicate needs owner/name:version for some community models. */
export async function resolveReplicatePremiumModelRef(): Promise<string> {
  const configured = resolveReplicatePremiumModel();
  if (configured.includes(":")) {
    return configured;
  }

  if (cachedVersionId && cachedVersionForSlug === configured) {
    return `${configured}:${cachedVersionId}`;
  }

  const res = await fetch(`https://api.replicate.com/v1/models/${configured}`, {
    headers: { Authorization: `Bearer ${getReplicateApiToken()}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[premium-gen] Modèle Premium introuvable sur Replicate (${configured}, HTTP ${res.status}). ` +
        `Définis PREMIUM_REPLICATE_MODEL ou mets à jour le slug. ${text.slice(0, 120)}`
    );
  }

  const json = (await res.json()) as { latest_version?: { id?: string } };
  const versionId = json.latest_version?.id?.trim();
  if (!versionId) {
    throw new Error(
      `[premium-gen] Aucune version publiée pour ${configured} sur Replicate.`
    );
  }

  cachedVersionForSlug = configured;
  cachedVersionId = versionId;
  return `${configured}:${versionId}`;
}

export function buildPremiumReplicateInput(
  modelRef: string,
  input: TogetherFluxInput
): Record<string, unknown> {
  const seed =
    input.seed ?? Math.floor(Math.random() * 2147483647);
  const width = input.width ?? 1024;
  const height = input.height ?? 1280;
  const steps = input.num_inference_steps ?? input.steps ?? 28;
  const cfg = input.guidance_scale ?? 3.5;

  if (isAishaPremiumFluxModel(modelRef)) {
    return {
      prompt: input.prompt,
      width,
      height,
      steps,
      cfg_scale: cfg,
      seed,
    };
  }

  return {
    prompt: input.prompt,
    negative_prompt: input.negative_prompt,
    width,
    height,
    num_inference_steps: steps,
    guidance_scale: cfg,
    output_format: "jpg",
    output_quality: 92,
    seed,
  };
}

export function sanitizePremiumReplicateInput(
  modelRef: string,
  params: Record<string, unknown>
): Record<string, unknown> {
  if (isAishaPremiumFluxModel(modelRef)) {
    return {
      prompt: String(params.prompt ?? ""),
      width: typeof params.width === "number" ? params.width : 1024,
      height: typeof params.height === "number" ? params.height : 1280,
      steps:
        typeof params.steps === "number"
          ? params.steps
          : typeof params.num_inference_steps === "number"
            ? params.num_inference_steps
            : 28,
      cfg_scale:
        typeof params.cfg_scale === "number"
          ? params.cfg_scale
          : typeof params.guidance_scale === "number"
            ? params.guidance_scale
            : 3.5,
      ...(typeof params.seed === "number" ? { seed: params.seed } : {}),
    };
  }

  const {
    safety_tolerance: _st,
    negative_prompt: _np,
    num_outputs: _no,
    image: _img,
    ip_adapter_scale: _ip,
    ...clean
  } = params;
  return clean;
}
