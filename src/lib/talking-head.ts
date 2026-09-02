/**
 * Talking-head V1 — shared client/server helpers.
 *
 * The client uses these to render the script counter and cost preview; the
 * server uses the exact same math when it holds credits so the price the
 * user sees before "Generate" matches the actual debit to the last unit.
 */

import {
  CREDIT_COSTS,
  MAX_TALKING_HEAD_SEC,
  MAX_TALKING_HEAD_WORDS,
  TALKING_HEAD_WORDS_PER_SEC,
} from "@/lib/constants";

/** Count words the same way on client and server (whitespace tokens). */
export function countScriptWords(script: string): number {
  const trimmed = script.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Estimate audio duration (in seconds) from a script. Uses a fixed
 * 2.5 w/s cadence — Hedra's actual runtime will be whatever ElevenLabs
 * emits, but this is enough to compute a credit hold that never
 * over-charges (we cap at MAX_TALKING_HEAD_SEC either way).
 */
export function estimateTalkingHeadDurationSec(script: string): number {
  const words = countScriptWords(script);
  if (words === 0) return 0;
  const raw = words / TALKING_HEAD_WORDS_PER_SEC;
  return clampTalkingHeadDurationSec(raw);
}

/**
 * Clamp a duration (from estimate OR measured MP3 length) to the
 * V1 limit. Never exceeds `MAX_TALKING_HEAD_SEC`.
 */
export function clampTalkingHeadDurationSec(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds, MAX_TALKING_HEAD_SEC);
}

/**
 * Aura credits held for a script of the given estimated duration.
 * Ceils to whole seconds so a 1-word test still holds a full second of
 * credits — matches how ElevenLabs / Hedra bill in whole seconds.
 */
export function estimateTalkingHeadCredits(
  durationSec: number
): number {
  const clamped = clampTalkingHeadDurationSec(durationSec);
  if (clamped <= 0) return 0;
  const rounded = Math.ceil(clamped);
  return rounded * CREDIT_COSTS.TALKING_HEAD_PER_SEC;
}

/**
 * Script validity check used by both the client (button enable/disable)
 * and the tRPC input schema. Returns a short French error message
 * on failure so the surface message stays consistent everywhere.
 */
export function validateTalkingHeadScript(script: string): {
  ok: boolean;
  error?: string;
  words: number;
} {
  const words = countScriptWords(script);
  if (words === 0) {
    return { ok: false, error: "Écris un script pour l'influenceuse.", words };
  }
  if (words > MAX_TALKING_HEAD_WORDS) {
    return {
      ok: false,
      error: `Script trop long : ${words} mots (max ${MAX_TALKING_HEAD_WORDS} pour ~${MAX_TALKING_HEAD_SEC}s).`,
      words,
    };
  }
  return { ok: true, words };
}
