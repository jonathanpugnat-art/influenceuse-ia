/**
 * Identity pack — multi-angle 2D reference stills from the wizard portrait.
 * Optimized for IG-realistic content (Nano multi-ref), not 3D meshes.
 */

export const IDENTITY_PACK_SHOT_IDS = [
  "portrait_front",
  "profile",
  "three_quarter",
  "full_body",
] as const;

export type IdentityPackShotId = (typeof IDENTITY_PACK_SHOT_IDS)[number];

export type IdentityPackShot = {
  id: IdentityPackShotId | string;
  url: string;
};

export type IdentityPackRecord = {
  status: "generating" | "ready" | "failed";
  shots: IdentityPackShot[];
  error?: string;
  updatedAt: string;
};

/** Shots generated after the user picks a base portrait (Kontext i2i). */
export const IDENTITY_PACK_GENERATION_SHOTS: Array<{
  id: Exclude<IdentityPackShotId, "portrait_front">;
  prompt: string;
}> = [
  {
    id: "profile",
    prompt:
      "same exact person as the reference, left profile view, head and shoulders, " +
      "neutral expression, soft window light, plain background, real skin texture, " +
      "iPhone photo, not CGI",
  },
  {
    id: "three_quarter",
    prompt:
      "same exact person as the reference, three-quarter angle medium shot from waist up, " +
      "natural relaxed smile, casual white t-shirt, soft daylight, real skin pores, " +
      "candid Instagram photo, not studio glamour",
  },
  {
    id: "full_body",
    prompt:
      "same exact person as the reference, full body standing, casual jeans and fitted top, " +
      "sneakers, relaxed pose, apartment or street background, natural light, " +
      "vertical iPhone photo, realistic proportions, not fashion editorial",
  },
];

export function parseIdentityPack(raw: unknown): IdentityPackRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = o.status;
  if (status !== "generating" && status !== "ready" && status !== "failed") {
    return null;
  }
  const shots = Array.isArray(o.shots)
    ? o.shots
        .filter(
          (s): s is IdentityPackShot =>
            !!s &&
            typeof s === "object" &&
            typeof (s as IdentityPackShot).url === "string" &&
            typeof (s as IdentityPackShot).id === "string"
        )
        .map((s) => ({ id: s.id, url: s.url.trim() }))
        .filter((s) => s.url.startsWith("http"))
    : [];
  return {
    status,
    shots,
    error: typeof o.error === "string" ? o.error : undefined,
    updatedAt:
      typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

export function identityPackGenerating(
  basePortraitUrl: string
): IdentityPackRecord {
  return {
    status: "generating",
    shots: [{ id: "portrait_front", url: basePortraitUrl }],
    updatedAt: new Date().toISOString(),
  };
}

const FULL_BODY_POSE_RE =
  /\b(full[\s_-]?body|head[\s_-]?to[\s_-]?toe|standing|ootd|outfit[\s_-]?check)\b/i;
const PROFILE_POSE_RE = /\b(profile|side view|90 degree)\b/i;

/**
 * Pick up to `maxExtra` pack URLs to append after the base portrait for Nano.
 */
export function selectIdentityPackRefs(
  basePortraitUrl: string,
  pack: IdentityPackRecord | null | undefined,
  opts?: { pose?: string; sceneDescription?: string; maxTotal?: number }
): string[] {
  const maxTotal = opts?.maxTotal ?? 4;
  const base = basePortraitUrl.trim();
  const urls: string[] = base.startsWith("http") ? [base] : [];

  if (!pack || pack.status !== "ready" || pack.shots.length === 0) {
    return urls;
  }

  const byId = new Map(pack.shots.map((s) => [s.id, s.url]));
  const scene = `${opts?.pose ?? ""} ${opts?.sceneDescription ?? ""}`.toLowerCase();

  const priority: IdentityPackShotId[] = FULL_BODY_POSE_RE.test(scene)
    ? ["full_body", "three_quarter", "profile"]
    : PROFILE_POSE_RE.test(scene)
      ? ["profile", "three_quarter", "full_body"]
      : ["three_quarter", "full_body", "profile"];

  for (const id of priority) {
    if (urls.length >= maxTotal) break;
    const url = byId.get(id);
    if (url && !urls.includes(url)) urls.push(url);
  }

  return urls.slice(0, maxTotal);
}
