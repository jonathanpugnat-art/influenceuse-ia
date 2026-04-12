import Replicate from "replicate";
import { nanoid } from "nanoid";
import { uploadFromUrl } from "@/server/services/storage.service";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { CREDIT_COSTS } from "@/lib/constants";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface VideoGenerationInput {
  influencerId: string;
  baseImageUrl: string;
  duration: 5 | 10;
  script: string;
  videoType: string;
  effects?: string;
  isNsfw: boolean;
}

export interface VideoGenerationOutput {
  videoUrl: string;
  thumbnailUrl?: string;
  parameters: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// Replicate SDK
// ──────────────────────────────────────────────

const MODEL_VIDEO = "minimax/video-01" as const;

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

async function runReplicatePrediction(
  model: string,
  input: Record<string, unknown>
): Promise<string[]> {
  const replicate = getReplicate();

  const output = await replicate.run(
    model as `${string}/${string}` | `${string}/${string}:${string}`,
    { input }
  );

  const urls = extractOutputUrls(output);
  if (urls.length === 0) {
    throw new Error("Replicate returned no output");
  }
  return urls;
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

// ──────────────────────────────────────────────
// Video type prompt builders — TikTok/Instagram style
// ──────────────────────────────────────────────

const VIDEO_TYPE_PROMPTS: Record<string, string> = {
  talking_head:
    "talking to camera like a TikTok, natural hand gestures, casual tone, phone propped up on desk, ring light reflection in eyes, genuine expressions",
  transition:
    "TikTok outfit transition, hand covers camera then reveals new outfit, snap transition effect, fun and creative, trending transition style",
  dance:
    "TikTok dance trend, fun casual choreography in bedroom or living room, phone propped against wall, natural rhythm, viral dance challenge",
  workout:
    "gym workout clip, phone propped on bench filming, exercise form demo, sweat on skin, gym mirror visible, motivational fitness content",
  unboxing:
    "unboxing haul on bed or table, excited genuine reaction, showing items close to camera, tissue paper and packaging visible, ASMR style",
  travel:
    "travel vlog clip, walking through streets or landmark, looking around in awe, phone held low angle, golden hour, wanderlust vibes",
  cooking:
    "cooking video overhead angle, hands chopping and stirring, steam rising, kitchen counter visible, quick recipe style, satisfying food prep",
  tutorial:
    "get ready with me style, bathroom mirror, applying makeup or doing hair, talking to camera casually, beauty products visible on counter",
  grwm:
    "get ready with me, sitting at vanity mirror, doing makeup step by step, products on table, chatting casually, morning routine",
  ootd:
    "outfit of the day reveal, spinning in mirror, showing outfit from angles, bedroom background, closet visible, fashion try-on",
};

const VIDEO_EFFECT_PROMPTS: Record<string, string> = {
  "slow-mo":
    "slow motion hair flip or movement, dramatic but casual, iPhone slow-mo mode",
  zoom: "quick zoom in on face or outfit detail, TikTok zoom trend",
  pan: "smooth phone pan around the person, revealing environment",
  timelapse: "getting ready timelapse, fast forward routine, sped up",
  bokeh:
    "portrait mode video, blurred background, face in sharp focus",
  none: "no special effects, natural phone recording",
};

function buildVideoPrompt(input: VideoGenerationInput): string {
  const parts: string[] = [];

  parts.push(
    "realistic phone video, filmed on iPhone, vertical video, social media reel"
  );

  const typePrompt =
    VIDEO_TYPE_PROMPTS[input.videoType] ?? input.videoType;
  parts.push(typePrompt);

  if (input.script) {
    parts.push(input.script);
  }

  if (input.effects) {
    const effect =
      VIDEO_EFFECT_PROMPTS[input.effects] ?? input.effects;
    parts.push(effect);
  }

  parts.push(
    "natural handheld camera movement, slight camera shake, " +
      "realistic skin and hair movement, natural lighting, " +
      "TikTok style video, Instagram reel quality, " +
      "real person natural movement, casual and authentic"
  );

  return parts.join(", ");
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Generate a short video (4-10s) from a reference image.
 */
export async function generateVideo(
  userId: string,
  input: VideoGenerationInput
): Promise<VideoGenerationOutput> {
  const cost = CREDIT_COSTS.REEL;
  const hasCredits = await checkCredits(userId, cost);
  if (!hasCredits) {
    throw new Error(
      `Crédits insuffisants. Coût : ${cost} crédits. Passez à un plan supérieur.`
    );
  }

  if (!input.baseImageUrl) {
    throw new Error(
      "Une image de référence est obligatoire pour la génération vidéo."
    );
  }

  const prompt = buildVideoPrompt(input);

  const params: Record<string, unknown> = {
    prompt,
    first_frame_image: input.baseImageUrl,
    prompt_optimizer: true,
  };

  try {
    console.log("[ai-video] Generating video...");
    console.log("[ai-video] Model:", MODEL_VIDEO);

    const outputUrls = await runReplicatePrediction(MODEL_VIDEO, params);

    if (outputUrls.length === 0) {
      throw new Error("No video generated");
    }

    const videoFilename = `reel-${input.influencerId}-${nanoid(6)}.mp4`;
    const storedUrl = await uploadFromUrl(outputUrls[0], videoFilename);

    await deductCredits(userId, cost);

    return {
      videoUrl: storedUrl,
      parameters: params,
    };
  } catch (error) {
    console.error("[ai-video] generateVideo error:", error);
    throw error;
  }
}
