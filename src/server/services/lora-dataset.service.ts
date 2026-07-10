import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import archiver from "archiver";
import { nanoid } from "nanoid";
import {
  LORA_DATASET_SHOTS,
  LORA_MIN_DATASET_IMAGES,
  type LoraDatasetRecord,
} from "@/lib/lora";
import { KONTEXT_IMAGE_PARAMS } from "@/lib/prompts/image-prompts";
import { CREDIT_COSTS } from "@/lib/constants";
import { db } from "@/server/db";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { withReplicateRetry } from "@/server/services/replicate-utils";
import { uploadFromUrl, uploadFile } from "@/server/services/storage.service";
import { resolvePublicMediaUrl } from "@/server/lib/resolve-public-media-url";
import Replicate from "replicate";

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

async function runKontextShot(prompt: string, inputImageUrl: string): Promise<string> {
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
  return extractUrl(output);
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status}`);
  }
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(destPath));
}

async function zipImageUrls(
  imageUrls: string[],
  influencerId: string
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `lora-dataset-${influencerId}-`));

  try {
    const localFiles: string[] = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const filePath = join(dir, `img_${String(i).padStart(3, "0")}.jpg`);
      await downloadToFile(imageUrls[i], filePath);
      localFiles.push(filePath);
    }

    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
      for (const file of localFiles) {
        archive.file(file, { name: file.split("/").pop()! });
      }
      void archive.finalize();
    });

    return uploadFile(
      zipBuffer,
      `lora-dataset-${influencerId}-${nanoid(6)}.zip`,
      "application/zip"
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function generateLoraDataset(
  userId: string,
  influencerId: string,
  options?: { complimentary?: boolean }
): Promise<LoraDatasetRecord> {
  const influencer = await db.influencer.findFirst({
    where: { id: influencerId, userId },
  });
  if (!influencer?.baseImageUrl?.trim()) {
    throw new Error("Portrait de base manquant pour le dataset LoRA.");
  }
  if (influencer.isNsfw) {
    throw new Error("Le LoRA personnage n'est pas disponible en mode NSFW.");
  }

  const complimentary = options?.complimentary === true;
  const cost = CREDIT_COSTS.LORA_DATASET;
  if (!complimentary) {
    const hasCredits = await checkCredits(userId, cost);
    if (!hasCredits) {
      throw new Error(`Crédits insuffisants. Coût dataset LoRA : ${cost} crédits.`);
    }
  }

  const baseUrl = await resolvePublicMediaUrl(influencer.baseImageUrl.trim());
  if (!baseUrl) {
    throw new Error("Portrait de base inaccessible.");
  }

  const generating: LoraDatasetRecord = {
    status: "generating",
    imageUrls: [influencer.baseImageUrl.trim()],
    updatedAt: new Date().toISOString(),
  };
  await db.influencer.update({
    where: { id: influencerId },
    data: { loraDataset: generating as object },
  });

  const imageUrls: string[] = [influencer.baseImageUrl.trim()];

  try {
    for (const shot of LORA_DATASET_SHOTS) {
      const rawUrl = await runKontextShot(shot.prompt, baseUrl);
      const filename = `lora-dataset-${influencerId}-${shot.id}-${nanoid(6)}.jpg`;
      const stored = await uploadFromUrl(rawUrl, filename);
      imageUrls.push(stored);
    }

    if (imageUrls.length < LORA_MIN_DATASET_IMAGES) {
      throw new Error(
        `Dataset incomplet (${imageUrls.length}/${LORA_MIN_DATASET_IMAGES} images).`
      );
    }

    const zipUrl = await zipImageUrls(imageUrls, influencerId);

    if (!complimentary) {
      await deductCredits(userId, cost);
    }

    const record: LoraDatasetRecord = {
      status: "ready",
      imageUrls,
      zipUrl,
      updatedAt: new Date().toISOString(),
    };

    await db.influencer.update({
      where: { id: influencerId },
      data: { loraDataset: record as object },
    });

    return record;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const failed: LoraDatasetRecord = {
      status: "failed",
      imageUrls,
      error: msg.slice(0, 500),
      updatedAt: new Date().toISOString(),
    };
    await db.influencer.update({
      where: { id: influencerId },
      data: { loraDataset: failed as object },
    });
    throw error;
  }
}
