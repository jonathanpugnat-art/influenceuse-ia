import Replicate from "replicate";
import { nanoid } from "nanoid";
import {
  IDENTITY_PACK_GENERATION_SHOTS,
  type IdentityPackRecord,
  type IdentityPackShot,
} from "@/lib/identity-pack";
import { KONTEXT_IMAGE_PARAMS } from "@/lib/prompts/image-prompts";
import { CREDIT_COSTS } from "@/lib/constants";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { uploadFromUrl } from "@/server/services/storage.service";
import { withReplicateRetry } from "@/server/services/replicate-utils";
import { resolvePublicMediaUrl } from "@/server/lib/resolve-public-media-url";
import { db } from "@/server/db";

const MODEL_KONTEXT = "black-forest-labs/flux-kontext-pro" as const;

let _replicate: Replicate | null = null;

function getReplicate(): Replicate {
  if (!_replicate) {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN is not configured.");
    }
    _replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }
  return _replicate;
}

function extractUrl(item: unknown): string {
  const str = String(item);
  if (str.startsWith("http")) return str;
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    if (typeof obj.url === "function") {
      const u = String((obj.url as () => unknown)());
      if (u.startsWith("http")) return u;
    }
    if (typeof obj.url === "string" && obj.url.startsWith("http")) return obj.url;
  }
  throw new Error(`Cannot extract URL from Replicate output: ${str.slice(0, 120)}`);
}

async function runKontextShot(
  prompt: string,
  inputImageUrl: string
): Promise<string> {
  const replicate = getReplicate();
  const output = await withReplicateRetry(
    () =>
      replicate.run(MODEL_KONTEXT, {
        input: {
          ...KONTEXT_IMAGE_PARAMS,
          prompt,
          input_image: inputImageUrl,
        },
      }),
    MODEL_KONTEXT
  );
  const url = extractUrl(output);
  return url;
}

/**
 * Generate profile / 3-4 / full-body stills from the wizard portrait and
 * persist them on the influencer row.
 */
export async function generateAndPersistIdentityPack(
  userId: string,
  influencerId: string,
  options?: { complimentary?: boolean }
): Promise<IdentityPackRecord> {
  const influencer = await db.influencer.findFirst({
    where: { id: influencerId, userId },
  });
  if (!influencer?.baseImageUrl?.trim()) {
    throw new Error("Portrait de base manquant pour le kit identité.");
  }
  if (influencer.isNsfw) {
    throw new Error("Le kit identité n'est pas disponible en mode NSFW.");
  }

  const complimentary = options?.complimentary === true;
  const cost = CREDIT_COSTS.IDENTITY_PACK;
  if (!complimentary) {
    const hasCredits = await checkCredits(userId, cost);
    if (!hasCredits) {
      throw new Error(
        `Crédits insuffisants. Coût : ${cost} crédits pour le kit identité.`
      );
    }
  }

  const baseUrl = await resolvePublicMediaUrl(influencer.baseImageUrl.trim());
  if (!baseUrl) {
    throw new Error("Portrait de base inaccessible.");
  }

  const shots: IdentityPackShot[] = [
    { id: "portrait_front", url: influencer.baseImageUrl.trim() },
  ];

  console.log(
    `[identity-pack] Generating ${IDENTITY_PACK_GENERATION_SHOTS.length} refs for influencer ${influencerId}`
  );

  for (const shot of IDENTITY_PACK_GENERATION_SHOTS) {
    const rawUrl = await runKontextShot(shot.prompt, baseUrl);
    const filename = `identity-${influencerId}-${shot.id}-${nanoid(6)}.jpg`;
    const stored = await uploadFromUrl(rawUrl, filename);
    shots.push({ id: shot.id, url: stored });
  }

  if (!complimentary) {
    await deductCredits(userId, cost);
  }

  const record: IdentityPackRecord = {
    status: "ready",
    shots,
    updatedAt: new Date().toISOString(),
  };

  await db.influencer.update({
    where: { id: influencerId },
    data: { identityPack: record as object },
  });

  console.log(`[identity-pack] Ready for ${influencerId} (${shots.length} shots)`);
  return record;
}

export async function markIdentityPackFailed(
  influencerId: string,
  error: string,
  basePortraitUrl?: string
): Promise<void> {
  const shots: IdentityPackShot[] = basePortraitUrl
    ? [{ id: "portrait_front", url: basePortraitUrl }]
    : [];
  await db.influencer.update({
    where: { id: influencerId },
    data: {
      identityPack: {
        status: "failed",
        shots,
        error: error.slice(0, 500),
        updatedAt: new Date().toISOString(),
      } as object,
    },
  });
}

export async function scheduleIdentityPackGeneration(
  userId: string,
  influencerId: string,
  basePortraitUrl: string,
  options?: { complimentary?: boolean }
): Promise<void> {
  await db.influencer.update({
    where: { id: influencerId },
    data: {
      identityPack: {
        status: "generating",
        shots: [{ id: "portrait_front", url: basePortraitUrl }],
        updatedAt: new Date().toISOString(),
      } as object,
    },
  });

  try {
    await generateAndPersistIdentityPack(userId, influencerId, options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[identity-pack] Generation failed:", msg);
    await markIdentityPackFailed(influencerId, msg, basePortraitUrl);
    throw err;
  }
}
