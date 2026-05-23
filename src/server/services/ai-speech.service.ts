/**
 * Text-to-speech for talking reels (roadmap S2).
 * Uses Replicate when configured; uploads MP3 to R2/local storage.
 */

import Replicate from "replicate";
import { nanoid } from "nanoid";
import { CREDIT_COSTS } from "@/lib/constants";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { withReplicateRetry } from "@/server/services/replicate-utils";
import { uploadFromUrl } from "@/server/services/storage.service";

const DEFAULT_TTS_MODEL = "jaaari/kokoro-82m";

let _replicate: Replicate | null = null;

function getReplicate(): Replicate {
  if (!_replicate) {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error(
        "REPLICATE_API_TOKEN is not configured. Set it in your .env file."
      );
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
    if (typeof obj.url === "string" && obj.url.startsWith("http"))
      return obj.url;
    if (typeof obj.href === "string" && obj.href.startsWith("http"))
      return obj.href;
  }
  throw new Error(
    `Cannot extract URL from Replicate output: ${str.slice(0, 200)}`
  );
}

function extractOutputUrls(output: unknown): string[] {
  if (Array.isArray(output)) {
    return output.map(extractUrl);
  }
  return [extractUrl(output)];
}

async function runReplicatePrediction(
  model: string,
  input: Record<string, unknown>
): Promise<string[]> {
  const replicate = getReplicate();
  const output = await withReplicateRetry(
    () =>
      replicate.run(
        model as `${string}/${string}` | `${string}/${string}:${string}`,
        { input }
      ),
    `tts:${model}`
  );

  const urls = extractOutputUrls(output);
  if (urls.length === 0) {
    throw new Error("Replicate returned no output");
  }
  return urls;
}

export function isSpeechConfigured(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN?.trim());
}

export function speechModelId(): string {
  return process.env.REPLICATE_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL;
}

export function reelNarrationCreditCost(): number {
  return CREDIT_COSTS.REEL_NARRATION;
}

export type GenerateSpeechInput = {
  text: string;
  /** Optional voice id supported by the underlying model. */
  voice?: string;
  language?: "fr" | "en";
};

export type GenerateSpeechResult = {
  audioUrl: string;
  model: string;
  characters: number;
};

/**
 * Synthesize speech and return a stable public URL.
 */
export async function generateReelNarration(
  userId: string,
  input: GenerateSpeechInput,
  options?: { omitCreditBilling?: boolean }
): Promise<GenerateSpeechResult> {
  if (!isSpeechConfigured()) {
    throw new Error(
      "La synthèse vocale n'est pas configurée sur ce serveur (REPLICATE_API_TOKEN manquant)."
    );
  }

  const text = input.text.trim();
  if (text.length < 10) {
    throw new Error("Le script doit contenir au moins 10 caractères pour générer une voix.");
  }
  if (text.length > 1200) {
    throw new Error("Script trop long pour la narration (max 1200 caractères).");
  }

  const cost = reelNarrationCreditCost();
  if (!options?.omitCreditBilling) {
    const ok = await checkCredits(userId, cost);
    if (!ok) {
      throw new Error(`Crédits insuffisants. Coût narration : ${cost} crédit.`);
    }
  }

  const model = speechModelId();
  const lang = input.language === "en" ? "en" : "fr";

  const outputUrls = await runReplicatePrediction(model, {
    text,
    voice: input.voice ?? (lang === "fr" ? "ff_siwis" : "af_bella"),
    speed: 1,
  });

  const remote = outputUrls[0];
  if (!remote) {
    throw new Error("La synthèse vocale n'a pas renvoyé de fichier audio.");
  }

  const stored = await uploadFromUrl(remote, `narration-${nanoid(8)}.mp3`);

  if (!options?.omitCreditBilling) {
    await deductCredits(userId, cost);
  }

  return {
    audioUrl: stored,
    model,
    characters: text.length,
  };
}
