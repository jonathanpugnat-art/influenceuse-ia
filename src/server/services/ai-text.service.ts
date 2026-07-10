import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  buildCaptionSystemPrompt,
  buildHashtagSystemPrompt,
  buildBioSystemPrompt,
} from "@/lib/prompts/caption-prompts";
import {
  buildContentPlanSystemPrompt,
  buildIdeasSystemPrompt,
  JSON_REPAIR_INSTRUCTION,
  type ContentPlanContext,
  type IdeasContext,
} from "@/lib/prompts/content-plan-prompts";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import {
  getVoiceFingerprint,
  renderFingerprintPrompt,
} from "@/server/services/personality-memory.service";
import { CREDIT_COSTS } from "@/lib/constants";
import { WIZARD_AGENT_MODEL } from "@/lib/prompts/wizard-prompts";
import { PHOTO_AGENT_MODEL } from "@/lib/photo-studio-agent";
import {
  assertAuraTextAllowed,
  looksLikeProviderRefusal,
  type AuraContentLane,
} from "@/lib/content-safety/aura-content-policy";
import {
  resolveAdultTextModel,
  resolveAgentTextBackend,
} from "@/lib/text-provider-config";

export type { AuraContentLane };

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
  /**
   * Sprint 8 — Personality memory.
   * When provided, we sample the influencer's recent published captions
   * to keep voice / emojis / topic rotation consistent across posts.
   */
  influencerId?: string;
  /** Allows callers (or A/B tests) to ask for 2+ variants in a single call. */
  variants?: number;
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
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const PHOTO_ENRICHMENT_MODEL = "claude-sonnet-4-5";

let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
  }
  return _openai;
}

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not configured. Set it in your .env file."
      );
    }
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

/**
 * Selected text provider, controlled by `AI_TEXT_PROVIDER=deepseek|anthropic`.
 * Default = "deepseek" to keep backward compatibility.
 */
export type TextProvider = "deepseek" | "anthropic";
export function resolveTextProvider(): TextProvider {
  const raw = process.env.AI_TEXT_PROVIDER?.trim().toLowerCase();
  if (raw === "anthropic") return "anthropic";
  return "deepseek";
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callDeepSeekWithModel(
  messages: ChatMessage[],
  model: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error(
      "DEEPSEEK_API_KEY is not configured. Set it in your .env file."
    );
  }

  try {
    const response = await getOpenAI().chat.completions.create({
      model,
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

async function callOpenRouter(
  messages: ChatMessage[],
  model: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Aura Influencer IA",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenRouter returned empty response");
  }
  return content;
}

async function callAgentCompletion(
  messages: ChatMessage[],
  opts: {
    contentLane: AuraContentLane;
    maxTokens: number;
    temperature: number;
    anthropicModel?: string;
    cacheSystemPrompt?: boolean;
  }
): Promise<string> {
  const backend = resolveAgentTextBackend(opts.contentLane);

  if (backend === "openrouter") {
    return callOpenRouter(
      messages,
      resolveAdultTextModel(),
      opts.maxTokens,
      opts.temperature
    );
  }

  if (backend === "deepseek") {
    const model =
      opts.contentLane === "adult"
        ? resolveAdultTextModel()
        : DEEPSEEK_MODEL;
    return callDeepSeekWithModel(
      messages,
      model,
      opts.maxTokens,
      opts.temperature
    );
  }

  return callAnthropicWithModel(
    messages,
    opts.anthropicModel ?? ANTHROPIC_MODEL,
    opts.maxTokens,
    opts.temperature,
    opts.cacheSystemPrompt ?? false
  );
}

/**
 * Unified agent JSON LLM — routes adult/OF content to uncensored backend (DeepSeek/OpenRouter),
 * SFW to Claude when available. Applies Aura content policy before calling providers.
 */
export async function callAgentJsonLLM<T>(opts: {
  contentLane?: AuraContentLane;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  cacheSystemPrompt?: boolean;
  anthropicModel?: string;
  validate: (raw: unknown) => T;
  repairInstruction?: string;
}): Promise<T> {
  const contentLane = opts.contentLane ?? "sfw";
  assertAuraTextAllowed(opts.userPrompt, { lane: contentLane });

  const { systemPrompt, userPrompt, validate } = opts;
  const maxTokens = opts.maxTokens ?? 400;
  const temperature = opts.temperature ?? 0.4;
  const baseMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const tryParse = (text: string): T | null => {
    if (looksLikeProviderRefusal(text)) return null;
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    try {
      return validate(JSON.parse(cleaned));
    } catch {
      return null;
    }
  };

  const runPass = async (repair?: ChatMessage[]) => {
    const messages = repair ?? baseMessages;
    const text = await callAgentCompletion(messages, {
      contentLane,
      maxTokens,
      temperature: repair ? Math.min(temperature, 0.35) : temperature,
      anthropicModel: opts.anthropicModel,
      cacheSystemPrompt: opts.cacheSystemPrompt,
    });
    return tryParse(text) ?? text;
  };

  const first = await runPass();
  if (first !== null && typeof first !== "string") return first;

  if (typeof first === "string" && contentLane === "sfw") {
    console.warn(
      "[callAgentJsonLLM] SFW provider refusal detected, retrying on uncensored backend…"
    );
    const fallbackText = await callAgentCompletion(baseMessages, {
      contentLane: "adult",
      maxTokens,
      temperature,
    });
    const fallbackParsed = tryParse(fallbackText);
    if (fallbackParsed !== null) return fallbackParsed;
  }

  const repair: ChatMessage[] = [
    ...baseMessages,
    {
      role: "assistant",
      content: typeof first === "string" ? first : "",
    },
    {
      role: "user",
      content:
        opts.repairInstruction ??
        "Return only valid JSON matching the requested schema.",
    },
  ];

  const second = await runPass(repair);
  if (second !== null && typeof second !== "string") return second;

  throw new Error("Agent LLM returned invalid JSON after repair pass.");
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

async function callAnthropic(
  messages: ChatMessage[],
  maxTokens: number = 1024,
  temperature: number = 0.8
): Promise<string> {
  return callAnthropicWithModel(messages, ANTHROPIC_MODEL, maxTokens, temperature);
}

async function callAnthropicWithModel(
  messages: ChatMessage[],
  model: string,
  maxTokens: number,
  temperature: number,
  cacheSystemPrompt: boolean = false
): Promise<string> {
  const client = getAnthropic();
  const system = messages.find((m) => m.role === "system")?.content;
  const userTurns = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

  const response = await client.messages.create(
    {
      model,
      max_tokens: maxTokens,
      temperature,
      ...(system
        ? cacheSystemPrompt
          ? {
              system: [
                {
                  type: "text" as const,
                  text: system,
                  cache_control: { type: "ephemeral" as const },
                },
              ],
            }
          : { system }
        : {}),
      messages: userTurns,
    },
    cacheSystemPrompt
      ? { headers: { "anthropic-beta": "prompt-caching-2024-07-31" } }
      : undefined
  );

  // Concatenate all text blocks (Claude returns an array of content blocks)
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Anthropic returned empty response");
  }
  return text;
}

/**
 * Provider-agnostic text completion. Falls back to DeepSeek if Anthropic is
 * selected but ANTHROPIC_API_KEY is missing (so we never hard-crash captions).
 */
async function callLLM(
  messages: ChatMessage[],
  maxTokens: number = 300,
  temperature: number = 0.8
): Promise<string> {
  const provider = resolveTextProvider();
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    try {
      return await callAnthropic(messages, maxTokens, temperature);
    } catch (error) {
      console.error("[ai-text] Anthropic failed, falling back to DeepSeek:", error);
      // Fall through to DeepSeek so the user request still succeeds.
    }
  }
  return callDeepSeek(messages, maxTokens, temperature);
}

const TREND_PERSONALIZATION_MODEL_DEFAULT = "claude-haiku-4-5-20251001";

function resolveTrendPersonalizationAnthropicModel(): string {
  return (
    process.env.TREND_PERSONALIZATION_MODEL?.trim() ||
    TREND_PERSONALIZATION_MODEL_DEFAULT
  );
}

function resolveTrendPersonalizationLlmLabel(
  isNsfw: boolean,
  anthropicModel?: string
): string {
  if (isNsfw) {
    const backend = resolveAgentTextBackend("adult");
    return `${backend}:${resolveAdultTextModel()}`;
  }
  return `anthropic:${anthropicModel ?? resolveTrendPersonalizationAnthropicModel()}`;
}

/**
 * Trend personalization — Haiku (SFW) or uncensored backend (NSFW accounts).
 * Returns the model label stored on TrendRecommendation.llmModel.
 */
export async function callTrendPersonalizationJsonLLM<T>(opts: {
  isNsfw: boolean;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  validate: (raw: unknown) => T;
  repairInstruction?: string;
}): Promise<{ result: T; llmModel: string }> {
  const contentLane: AuraContentLane = opts.isNsfw ? "adult" : "sfw";
  const anthropicModel = opts.isNsfw
    ? undefined
    : resolveTrendPersonalizationAnthropicModel();

  const result = await callAgentJsonLLM({
    contentLane,
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    maxTokens: opts.maxTokens ?? 2000,
    temperature: opts.temperature ?? 0.55,
    anthropicModel,
    cacheSystemPrompt: !opts.isNsfw,
    validate: opts.validate,
    repairInstruction: opts.repairInstruction,
  });

  return {
    result,
    llmModel: resolveTrendPersonalizationLlmLabel(opts.isNsfw, anthropicModel),
  };
}

/**
 * Photo prompt enrichment — Claude Sonnet only (no DeepSeek fallback).
 * Callers should catch failures and fall back to raw user text.
 */
export async function callPhotoEnrichmentJsonLLM<T>(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  contentLane?: AuraContentLane;
  validate: (raw: unknown) => T;
  repairInstruction?: string;
}): Promise<T> {
  return callAgentJsonLLM({
    contentLane: opts.contentLane ?? "sfw",
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    maxTokens: opts.maxTokens ?? 500,
    temperature: opts.temperature ?? 0.25,
    anthropicModel: PHOTO_ENRICHMENT_MODEL,
    cacheSystemPrompt: opts.contentLane !== "adult",
    validate: opts.validate,
    repairInstruction: opts.repairInstruction,
  });
}

/**
 * Wizard agent JSON — routes adult lane away from Claude refusals.
 */
export async function callWizardJsonLLM<T>(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  cacheSystemPrompt?: boolean;
  contentLane?: AuraContentLane;
  validate: (raw: unknown) => T;
  repairInstruction?: string;
}): Promise<T> {
  return callAgentJsonLLM({
    contentLane: opts.contentLane ?? "sfw",
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    maxTokens: opts.maxTokens ?? 400,
    temperature: opts.temperature ?? 0.4,
    cacheSystemPrompt: opts.cacheSystemPrompt ?? false,
    anthropicModel: WIZARD_AGENT_MODEL,
    validate: opts.validate,
    repairInstruction: opts.repairInstruction,
  });
}

/**
 * Photo / agent JSON LLM — Claude when configured, else global callJsonLLM chain.
 */
export async function callPhotoPromptJsonLLM<T>(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  contentLane?: AuraContentLane;
  cacheSystemPrompt?: boolean;
  validate: (raw: unknown) => T;
  repairInstruction?: string;
}): Promise<T> {
  const hasAnyKey =
    Boolean(process.env.ANTHROPIC_API_KEY?.trim()) ||
    Boolean(process.env.DEEPSEEK_API_KEY?.trim()) ||
    Boolean(process.env.OPENROUTER_API_KEY?.trim());

  if (hasAnyKey) {
    try {
      return await callAgentJsonLLM({
        contentLane: opts.contentLane ?? "sfw",
        systemPrompt: opts.systemPrompt,
        userPrompt: opts.userPrompt,
        maxTokens: opts.maxTokens ?? 500,
        temperature: opts.temperature ?? 0.25,
        cacheSystemPrompt: opts.cacheSystemPrompt ?? true,
        anthropicModel: PHOTO_AGENT_MODEL,
        validate: opts.validate,
        repairInstruction: opts.repairInstruction,
      });
    } catch (error) {
      console.warn("[ai-text] callPhotoPromptJsonLLM agent failed, fallback:", error);
    }
  }

  return callJsonLLM(opts);
}

/**
 * Strict-JSON variant: forces JSON output and parses the result.
 * Tries one repair pass if the first response isn't valid JSON.
 */
export async function callJsonLLM<T>(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  /** Validator that throws on invalid shape. Returns the typed value. */
  validate: (raw: unknown) => T;
  repairInstruction?: string;
}): Promise<T> {
  const { systemPrompt, userPrompt, validate } = opts;
  const maxTokens = opts.maxTokens ?? 2000;
  const temperature = opts.temperature ?? 0.7;

  const baseMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const tryParse = (text: string): T | null => {
    const cleaned = text
      .trim()
      // Strip code fences if model added them despite instructions.
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    try {
      const json = JSON.parse(cleaned);
      return validate(json);
    } catch {
      return null;
    }
  };

  const first = await callLLM(baseMessages, maxTokens, temperature);
  const firstParsed = tryParse(first);
  if (firstParsed !== null) return firstParsed;

  console.warn("[ai-text] callJsonLLM: invalid JSON, attempting repair pass.");
  const repair: ChatMessage[] = [
    ...baseMessages,
    { role: "assistant", content: first },
    {
      role: "user",
      content:
        opts.repairInstruction ??
        "Your previous answer was not valid JSON. Reply ONLY with valid JSON matching the requested schema.",
    },
  ];
  const second = await callLLM(repair, maxTokens, Math.min(temperature, 0.4));
  const secondParsed = tryParse(second);
  if (secondParsed !== null) return secondParsed;

  throw new Error("LLM did not return valid JSON after retry.");
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

  const baseSystemPrompt = buildCaptionSystemPrompt({
    name: input.influencerName,
    niche: input.niche,
    personality: input.personality,
    platform: input.platform,
    tone: input.tone,
    language: input.language,
  });

  // Sprint 8 — Inject voice fingerprint when an influencer id is provided.
  let systemPrompt = baseSystemPrompt;
  if (input.influencerId) {
    try {
      const fingerprint = await getVoiceFingerprint(input.influencerId);
      const fragment = renderFingerprintPrompt(fingerprint);
      if (fragment) {
        systemPrompt = `${baseSystemPrompt}\n\n${fragment}`;
      }
    } catch (e) {
      // Memory is best-effort: never block caption generation.
      console.warn("[ai-text] voice fingerprint failed, falling back:", e);
    }
  }

  try {
    console.log("[ai-text] Generating caption for", input.platform);

    const caption = await callLLM(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            `Génère une caption qui correspond EXACTEMENT au contenu visuel décrit ci-dessous. ` +
            `Ne change pas de lieu, d'activité ni de tenue.\n\n${input.contentDescription}`,
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

    const result = await callLLM(
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
 * Sprint 12 — Generate 3 distinct {bio, personality} drafts for an influencer
 * in a single LLM call. Free of charge (no credits): we want the wizard to
 * feel magical and we lose nothing — the cost is a few cents for thousands of
 * users.
 *
 * Why 3 ideas: a single suggestion biases the user; offering choices triggers
 * "this one fits her best" rather than "I have to use what I get".
 */
const personaIdeasSchema = z.array(
  z.object({
    bio: z.string().min(20).max(300),
    personality: z.string().min(20).max(500),
  })
).min(1).max(5);

export type PersonaIdea = { bio: string; personality: string };

export async function generatePersonaIdeas(input: {
  name?: string;
  niche: string;
  gender?: "female" | "male" | "nonbinary";
  language: "fr" | "en";
  tone?: string;
}): Promise<PersonaIdea[]> {
  const lang = input.language === "en" ? "English" : "French";
  const genderHint =
    input.gender === "male"
      ? "male influencer"
      : input.gender === "nonbinary"
        ? "non-binary influencer"
        : "female influencer";

  const systemPrompt = `You are a content strategist for ${genderHint}s on Instagram and TikTok.
Generate exactly 3 DIFFERENT persona drafts for an influencer in the "${input.niche}" niche.
Each draft must contain:
  - bio: a punchy first-person Instagram bio (50-180 chars), 0-2 emojis, NO hashtags, NO @mentions, NO URLs
  - personality: a 2-3 sentence description of voice and quirks, written in third person, useful for an LLM later (180-400 chars)

The 3 drafts MUST feel different from each other:
  - draft 1 = warm and authentic
  - draft 2 = funny and playful
  - draft 3 = aspirational and bold

Write everything in ${lang}. Stay tasteful, avoid clichés, no "fitness model" / "content creator" filler.${
  input.name ? `\nThe influencer's name is "${input.name}".` : ""
}${input.tone ? `\nOverall tone hint: ${input.tone}.` : ""}

Reply ONLY with valid JSON of shape:
[{"bio": "...", "personality": "..."}, {...}, {...}]
No prose, no code fences, no explanation.`;

  const userPrompt = "Return the JSON array now.";

  const ideas = await callJsonLLM<PersonaIdea[]>({
    systemPrompt,
    userPrompt,
    maxTokens: 900,
    temperature: 0.95,
    repairInstruction: JSON_REPAIR_INSTRUCTION,
    validate: (raw) => personaIdeasSchema.parse(raw),
  });

  // Cap to 3 (LLM may go over) and trim to safe lengths.
  return ideas.slice(0, 3).map((i) => ({
    bio: i.bio.trim().slice(0, 300),
    personality: i.personality.trim().slice(0, 500),
  }));
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

    const bio = await callLLM(
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

// ──────────────────────────────────────────────
// Content Plan & Ideas (Phase 3)
// ──────────────────────────────────────────────

const PLATFORM_ENUM = z.enum(["INSTAGRAM", "TIKTOK", "ONLYFANS"]);
const CONTENT_TYPE_ENUM = z.enum(["PHOTO", "REEL", "CAROUSEL"]);

const contentPlanPostSchema = z.object({
  dayIndex: z.number().int().min(0).max(13),
  slotIndex: z.number().int().min(0).max(9),
  platform: PLATFORM_ENUM,
  type: CONTENT_TYPE_ENUM,
  hook: z.string().min(1).max(200),
  concept: z.string().min(1).max(500),
  sceneDescription: z.string().min(10).max(800),
  scene: z.string().min(1).max(60),
  pose: z.string().min(1).max(60),
  expression: z.string().min(1).max(60),
  outfit: z.string().min(1).max(160),
  caption: z.string().min(1).max(2000),
  hashtags: z.array(z.string()).max(40),
  cta: z.string().min(0).max(200),
});

const contentPlanSchema = z.object({
  summary: z.string().min(0).max(2000),
  posts: z.array(contentPlanPostSchema).min(1).max(70),
});

export type ContentPlanPost = z.infer<typeof contentPlanPostSchema>;
export type ContentPlan = z.infer<typeof contentPlanSchema>;

const ideasSchema = z.array(
  z.object({
    hook: z.string().min(1).max(200),
    concept: z.string().min(1).max(500),
    type: CONTENT_TYPE_ENUM,
    scene: z.string().min(1).max(60),
  })
);

export type ContentIdea = z.infer<typeof ideasSchema>[number];

/**
 * Generate a multi-day editorial plan with hooks, captions, hashtags and per-post details.
 * Cost is `CREDIT_COSTS.CONTENT_PLAN_PER_POST × days × postsPerDay`.
 */
export async function generateContentPlan(
  userId: string,
  ctx: ContentPlanContext
): Promise<ContentPlan> {
  const totalPosts = ctx.days * ctx.postsPerDay;
  const cost = +(CREDIT_COSTS.CONTENT_PLAN_PER_POST * totalPosts).toFixed(2);
  const hasCredits = await checkCredits(userId, cost);
  if (!hasCredits) {
    throw new Error(`Crédits insuffisants. Coût : ${cost} crédits.`);
  }

  const systemPrompt = buildContentPlanSystemPrompt(ctx);
  const userPrompt = `Generate the editorial plan now. Output ONLY the JSON object.`;

  console.log(
    `[ai-text] Generating content plan: ${ctx.days}d × ${ctx.postsPerDay}/d = ${totalPosts} posts (provider=${resolveTextProvider()})`
  );

  const plan = await callJsonLLM<ContentPlan>({
    systemPrompt,
    userPrompt,
    maxTokens: 6000,
    temperature: 0.7,
    repairInstruction: JSON_REPAIR_INSTRUCTION,
    validate: (raw) => contentPlanSchema.parse(raw),
  });

  // Hard cap on posts so a chatty model can't blow up downstream cost.
  const trimmed: ContentPlan = {
    ...plan,
    posts: plan.posts.slice(0, totalPosts),
  };

  await deductCredits(userId, cost);
  return trimmed;
}

/**
 * Generate a small batch of stand-alone content ideas (hooks).
 */
export async function generateIdeas(
  userId: string,
  ctx: IdeasContext
): Promise<ContentIdea[]> {
  const cost = CREDIT_COSTS.IDEAS;
  const hasCredits = await checkCredits(userId, cost);
  if (!hasCredits) {
    throw new Error(`Crédits insuffisants. Coût : ${cost} crédits.`);
  }

  const systemPrompt = buildIdeasSystemPrompt(ctx);
  const userPrompt = `Return the JSON array now.`;

  const ideas = await callJsonLLM<ContentIdea[]>({
    systemPrompt,
    userPrompt,
    maxTokens: 1500,
    temperature: 0.85,
    repairInstruction: JSON_REPAIR_INSTRUCTION,
    validate: (raw) => ideasSchema.parse(raw),
  });

  await deductCredits(userId, cost);
  return ideas.slice(0, ctx.count);
}
