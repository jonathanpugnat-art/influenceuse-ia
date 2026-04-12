import OpenAI from "openai";
import {
  buildCaptionSystemPrompt,
  buildHashtagSystemPrompt,
  buildBioSystemPrompt,
} from "@/lib/prompts/caption-prompts";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { CREDIT_COSTS } from "@/lib/constants";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CaptionInput {
  influencerName: string;
  personality: string;
  niche: string;
  platform: string;
  contentDescription: string;
  language: "fr" | "en";
  tone?: string;
}

export interface HashtagInput {
  niche: string;
  platform: string;
  description: string;
  count: number;
  language?: "fr" | "en";
}

export interface BioInput {
  name: string;
  niche: string;
  personality: string;
  language: "fr" | "en";
  tone?: string;
}

// ──────────────────────────────────────────────
// DeepSeek client (OpenAI-compatible SDK)
// ──────────────────────────────────────────────

const DEEPSEEK_MODEL = "deepseek-chat";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
  }
  return _openai;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callDeepSeek(
  messages: ChatMessage[],
  maxTokens: number = 300,
  temperature: number = 0.8
): Promise<string> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error(
      "DEEPSEEK_API_KEY is not configured. Set it in your .env file."
    );
  }

  try {
    const response = await getOpenAI().chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("DeepSeek returned empty response");
    }

    return content.trim();
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error("[ai-text] DeepSeek API error:", error.message);
      throw new Error(`DeepSeek API error: ${error.message}`);
    }
    throw error;
  }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Generate a caption for a social media post.
 */
export async function generateCaption(
  userId: string,
  input: CaptionInput
): Promise<string> {
  const cost = CREDIT_COSTS.CAPTION;
  const hasCredits = await checkCredits(userId, cost);
  if (!hasCredits) {
    throw new Error(
      `Crédits insuffisants. Coût : ${cost} crédits.`
    );
  }

  const systemPrompt = buildCaptionSystemPrompt({
    name: input.influencerName,
    niche: input.niche,
    personality: input.personality,
    platform: input.platform,
    tone: input.tone,
    language: input.language,
  });

  try {
    console.log("[ai-text] Generating caption for", input.platform);

    const caption = await callDeepSeek(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Génère une caption pour ce contenu : ${input.contentDescription}`,
        },
      ],
      300,
      0.85
    );

    await deductCredits(userId, cost);

    return caption;
  } catch (error) {
    console.error("[ai-text] generateCaption error:", error);
    throw error;
  }
}

/**
 * Generate relevant hashtags for a post.
 */
export async function generateHashtags(
  userId: string,
  input: HashtagInput
): Promise<string[]> {
  const cost = CREDIT_COSTS.HASHTAGS;
  const hasCredits = await checkCredits(userId, cost);
  if (!hasCredits) {
    throw new Error(
      `Crédits insuffisants. Coût : ${cost} crédits.`
    );
  }

  const systemPrompt = buildHashtagSystemPrompt({
    niche: input.niche,
    platform: input.platform,
    description: input.description,
    count: input.count,
    language: input.language ?? "fr",
  });

  try {
    console.log("[ai-text] Generating hashtags...");

    const result = await callDeepSeek(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Génère ${input.count} hashtags pour : ${input.description}`,
        },
      ],
      200,
      0.7
    );

    const hashtags = result
      .split(/[\s,\n]+/)
      .map((h) => h.trim())
      .filter((h) => h.startsWith("#"))
      .map((h) => h.replace(/^#+/, "#"))
      .slice(0, input.count);

    await deductCredits(userId, cost);

    return hashtags;
  } catch (error) {
    console.error("[ai-text] generateHashtags error:", error);
    throw error;
  }
}

/**
 * Generate a suggested bio for an influencer.
 */
export async function generateBio(
  userId: string,
  input: BioInput
): Promise<string> {
  const systemPrompt = buildBioSystemPrompt({
    name: input.name,
    niche: input.niche,
    personality: input.personality,
    language: input.language,
    tone: input.tone,
  });

  try {
    console.log("[ai-text] Generating bio for", input.name);

    const bio = await callDeepSeek(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: "Génère une bio pour ce profil.",
        },
      ],
      100,
      0.9
    );

    return bio;
  } catch (error) {
    console.error("[ai-text] generateBio error:", error);
    throw error;
  }
}
