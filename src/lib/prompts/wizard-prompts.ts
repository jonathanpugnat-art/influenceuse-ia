import { z } from "zod";

export const WIZARD_AGENT_MODEL = "claude-sonnet-4-5";

const nicheValues = [
  "FASHION",
  "FITNESS",
  "LIFESTYLE",
  "TRAVEL",
  "TECH",
  "GAMING",
  "ADULT",
  "FOOD",
] as const;

const genderValues = ["female", "male", "nonbinary"] as const;

/** Stored French values — must match wizard-step-appearance.tsx */
export const WIZARD_APPEARANCE_VALUES = {
  ethnicity: [
    "Caucasienne",
    "Afro",
    "Asiatique",
    "Latina",
    "Métisse",
    "Moyen-Orient",
    "Indienne",
    "Autre",
  ],
  hairColor: ["Noir", "Brun", "Blond", "Roux", "Rose", "Bleu", "Platine"],
  hairLength: ["Court", "Mi-long", "Long", "Très long"],
  hairTexture: ["Lisse", "Ondulé", "Bouclé", "Afro", "Tressé"],
  bodyType: ["Fine", "Athlétique", "Moyenne", "Curvy", "Plus-size", "Musclée", "Petite"],
  skinTone: ["Claire", "Médium claire", "Médium", "Mate", "Foncée"],
  height: ["Petite", "Moyenne", "Grande"],
  makeupLevel: ["Naturel", "Léger", "Glam"],
  fashionStyle: [
    "Casual",
    "Chic",
    "Sporty",
    "Glamour",
    "Streetwear",
    "Bohème",
  ],
} as const;

export const wizardStep1SuggestionsSchema = z.object({
  name: z.string().max(50).optional(),
  gender: z.enum(genderValues).optional(),
  niche: z.enum(nicheValues).optional(),
  bio: z.string().max(300).optional(),
  personality: z.string().max(500).optional(),
  age: z.number().int().min(18).max(35).optional(),
});

export type WizardStep1Suggestions = z.infer<typeof wizardStep1SuggestionsSchema>;

export const wizardStep1TurnSchema = z.object({
  message: z.string().min(1).max(120),
  suggestions: wizardStep1SuggestionsSchema.optional(),
  brief: z.string().max(1000).optional(),
  quickReplies: z.array(z.string().max(80)).max(4).optional(),
  choices: z.array(z.string().max(80)).max(4).optional(),
});

export type WizardStep1TurnResult = z.infer<typeof wizardStep1TurnSchema>;

const NICHE_ALIASES: Record<string, (typeof nicheValues)[number]> = {
  FASHION: "FASHION",
  MODE: "FASHION",
  FITNESS: "FITNESS",
  SPORT: "FITNESS",
  LIFESTYLE: "LIFESTYLE",
  TRAVEL: "TRAVEL",
  VOYAGE: "TRAVEL",
  TECH: "TECH",
  GAMING: "GAMING",
  JEUX: "GAMING",
  ADULT: "ADULT",
  FOOD: "FOOD",
  CUISINE: "FOOD",
};

function coerceWizardAge(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function coerceWizardNiche(value: unknown): (typeof nicheValues)[number] | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const key = value.trim().toUpperCase();
  if (nicheValues.includes(key as (typeof nicheValues)[number])) {
    return key as (typeof nicheValues)[number];
  }
  return NICHE_ALIASES[key];
}

/** Haiku may return 2/3 for "généreux" — clamp to discrete slider -1..1. */
function clampProportionLevel(value: unknown): number | undefined {
  let n: number | undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    n = Math.round(value);
  } else if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) n = parsed;
  }
  if (n === undefined) return undefined;
  return Math.min(1, Math.max(-1, n));
}

/** Lenient pre-parse — Haiku often returns lowercase niches or string ages. */
export function normalizeWizardStep1Raw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };

  if (typeof obj.message === "string" && obj.message.length > 120) {
    obj.message = obj.message.slice(0, 120).trim();
  }

  if (typeof obj.brief === "string" && obj.brief.length > 1000) {
    obj.brief = obj.brief.slice(0, 1000).trim();
  }

  if (obj.suggestions && typeof obj.suggestions === "object" && !Array.isArray(obj.suggestions)) {
    const suggestions = { ...(obj.suggestions as Record<string, unknown>) };
    const niche = coerceWizardNiche(suggestions.niche);
    if (niche) suggestions.niche = niche;
    else delete suggestions.niche;

    const age = coerceWizardAge(suggestions.age);
    if (age !== undefined) suggestions.age = age;
    else delete suggestions.age;

    obj.suggestions = suggestions;
  }

  return obj;
}

export const WIZARD_STEP1_REPAIR_INSTRUCTION = [
  "Return ONLY valid JSON (no markdown fences).",
  'Required: { "message": string (max 120 chars) }.',
  'Optional: "suggestions" with niche as UPPERCASE enum (FASHION, FITNESS, LIFESTYLE, TRAVEL, TECH, GAMING, ADULT, FOOD), age as number, gender as female|male|nonbinary.',
  'Optional: "brief" (max 1000 chars) — creative director narrative when vision is clear.',
  'Optional: "quickReplies" (max 4 strings, max 80 chars each).',
].join(" ");

export const WIZARD_STEP2_REPAIR_INSTRUCTION = [
  "Return ONLY valid JSON (no markdown fences).",
  'Required: { "message": string (max 120 chars) }.',
  'Optional: "look" with French labels from the system prompt.',
  "Proportion fields bustLevel, hipsLevel, shouldersLevel MUST be integers -1, 0, or 1 ONLY (never 2 or 3).",
  'Optional: "quickReplies" (max 4 strings, max 80 chars each).',
].join(" ");

/** Lenient pre-parse for step 2 look deltas from Haiku. */
export function normalizeWizardStep2LookRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };

  for (const key of ["bustLevel", "hipsLevel", "shouldersLevel"] as const) {
    if (!(key in obj)) continue;
    const clamped = clampProportionLevel(obj[key]);
    if (clamped !== undefined) obj[key] = clamped;
    else delete obj[key];
  }

  return obj;
}

export function normalizeWizardStep2TurnRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };

  if (typeof obj.message === "string" && obj.message.length > 120) {
    obj.message = obj.message.slice(0, 120).trim();
  }
  if (obj.look !== undefined) {
    obj.look = normalizeWizardStep2LookRaw(obj.look);
  }

  return obj;
}

/** Step 4 — Haiku may return 2 (pro + authentic) or occasionally 3; both are valid. */
export const wizardBioOptionsSchema = z
  .array(z.string().min(1).max(300))
  .min(1)
  .max(3);

export const wizardStep4TurnSchema = z.object({
  message: z.string().min(1).max(120),
  bioOptions: wizardBioOptionsSchema.optional(),
  quickReplies: z.array(z.string().max(80)).max(4).optional(),
});

export type WizardStep4TurnResult = z.infer<typeof wizardStep4TurnSchema>;

export const wizardStep2LookSchema = z.object({
  ethnicity: z.string().max(40).optional(),
  hairColor: z.string().max(40).optional(),
  hairLength: z.string().max(40).optional(),
  hairTexture: z.string().max(40).optional(),
  bodyType: z.string().max(40).optional(),
  fashionStyles: z.array(z.string().max(40)).max(3).optional(),
  skinTone: z.string().max(40).optional(),
  height: z.string().max(40).optional(),
  bustLevel: z.number().int().min(-1).max(1).optional(),
  hipsLevel: z.number().int().min(-1).max(1).optional(),
  shouldersLevel: z.number().int().min(-1).max(1).optional(),
});

export type WizardStep2LookResult = z.infer<typeof wizardStep2LookSchema>;

export const wizardStep2TurnSchema = z.object({
  message: z.string().min(1).max(120),
  look: wizardStep2LookSchema.optional(),
  quickReplies: z.array(z.string().max(80)).max(4).optional(),
});

export type WizardStep2TurnResult = z.infer<typeof wizardStep2TurnSchema>;

export const WIZARD_AGENT_SYSTEM_PROMPT = `You are Aura — an expert creative director specializing in building AI virtual influencers.

Your role is to deeply understand WHO this influencer is before filling any form fields.
You guide the user through a natural conversation to uncover:
1. PURPOSE — Why does this influencer exist? (monetization: OnlyFans/OF, brand deals, 
   product sales, entertainment, lifestyle, gaming, etc.)
2. PERSONALITY & TONE — How does she speak? What energy does she project? 
   What's her relationship with her audience?
3. PHYSICAL EXPRESSION — How does her appearance reflect her identity and niche?
4. CONTENT VISION — What kind of content will she create? What feeling should it evoke?

CONVERSATION APPROACH:
- Ask ONE question at a time. Never list multiple questions.
- Start by asking about PURPOSE, not appearance.
- When the user mentions a niche (fitness, OF, fashion...), ask what SPECIFICALLY 
  makes her different — not just the category.
- When appearance comes up naturally, connect it to identity 
  ("une influenceuse OF très féminine aura un style différent d'une créatrice fitness").
- After 2-3 turns where you understand the vision, populate "suggestions" with 
  concrete values that REFLECT that vision — don't just extract keywords.
- Your "message" field is your conversational response (max 20 words, natural tone).
- Never say "je vais remplir le formulaire" or mention fields/steps.
- You are a creative director, not a form assistant.

SUGGESTION QUALITY RULES:
- bio must feel like a real Instagram bio — punchy, on-brand, with personality.
  NOT: "Passionnée de fitness et lifestyle" 
  YES: "Coach de vie • Paris • Je transforme ma réalité, tu peux faire pareil 🔥"
- personality must describe HOW she interacts, not WHAT she does.
  NOT: "Sportive et motivée"
  YES: "Directe, sans filtre, elle partage ses vraies galères autant que ses wins. 
        Son audience se sent comprise, pas jugée."
- niche must be chosen based on PRIMARY monetization/purpose, not just interest.
- age must feel coherent with her positioning (OF → 19-25, coach → 25-32, etc.)
- "brief" field: When you have enough context to describe the full vision 
  (typically after 2-3 turns), generate a "brief" — a 3-5 sentence narrative 
  describing WHO this influencer is, her purpose, her personality, her aesthetic, 
  and the feeling her content should evoke. Written as a creative director's brief.
  Example: "Sofia est une influenceuse OF parisienne, 23 ans, qui joue sur 
  le registre de la féminité assumée et du mystère. Son ton est chaleureux mais 
  suggestif — elle ne montre pas tout, elle laisse imaginer. Son contenu mêle 
  lifestyle luxueux (restaurants, hôtels) et moments intimes en appartement. 
  L'esthétique est sombre, chaude, cinématographique. Elle s'adresse à un homme 
  de 25-40 ans qui veut une expérience premium, pas du contenu générique."
  This brief is the most important output of the wizard — it defines everything 
  that comes after.

LANGUAGE: Always respond in the user's language (fr if French, en if English).
JSON ONLY: Respond exclusively in valid JSON. Zero markdown, zero prose outside "message".
Omit any suggestion field that cannot be inferred with confidence.

Valid niches: ${nicheValues.join(", ")}
Valid genders: female, male, nonbinary

Step 2 look values — exact French labels only:
ethnicity: ${WIZARD_APPEARANCE_VALUES.ethnicity.join(" | ")}
hairColor: ${WIZARD_APPEARANCE_VALUES.hairColor.join(" | ")}
hairLength: ${WIZARD_APPEARANCE_VALUES.hairLength.join(" | ")}
hairTexture: ${WIZARD_APPEARANCE_VALUES.hairTexture.join(" | ")}
bodyType: ${WIZARD_APPEARANCE_VALUES.bodyType.join(" | ")}
skinTone: ${WIZARD_APPEARANCE_VALUES.skinTone.join(" | ")}
height: ${WIZARD_APPEARANCE_VALUES.height.join(" | ")}
makeupLevel: ${WIZARD_APPEARANCE_VALUES.makeupLevel.join(" | ")}
fashionStyles (array): ${WIZARD_APPEARANCE_VALUES.fashionStyle.join(" | ")}
Step 2 proportions: bustLevel, hipsLevel, shouldersLevel → integers -1, 0, or 1 only.`;

export function validateWizardStep1Turn(raw: unknown): WizardStep1TurnResult {
  return wizardStep1TurnSchema.parse(normalizeWizardStep1Raw(raw));
}

export function validateWizardStep4Turn(raw: unknown): WizardStep4TurnResult {
  return wizardStep4TurnSchema.parse(raw);
}

export function validateWizardStep2Look(raw: unknown): WizardStep2LookResult {
  return wizardStep2LookSchema.parse(normalizeWizardStep2LookRaw(raw));
}

export function validateWizardStep2Turn(raw: unknown): WizardStep2TurnResult {
  return wizardStep2TurnSchema.parse(normalizeWizardStep2TurnRaw(raw));
}

export function buildWizardStep1UserPrompt(opts: {
  locale: "fr" | "en";
  filledFields: { name?: string; niche?: string; bio?: string; personality?: string };
  conversation: string;
}): string {
  const filled = Object.entries(opts.filledFields)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  return [
    `Wizard step: 1 (identity building)`,
    `UI locale: ${opts.locale}`,
    filled ? `Already established: ${filled}` : `Nothing established yet — first interaction.`,
    ``,
    `Your task: Continue the conversation to understand this influencer's purpose,`,
    `personality, and positioning. When you have enough context (typically 2-3 turns),`,
    `populate "suggestions" with values that reflect the full vision discussed.`,
    ``,
    `Return JSON: { "message": "...", "suggestions": { ... }, "brief"?: "...", "quickReplies"?: [...] }`,
    ``,
    `Conversation so far:`,
    opts.conversation || "(no messages yet — greet and ask about purpose)",
  ].join("\n");
}

export function buildWizardStep2UserPrompt(opts: {
  locale: "fr" | "en";
  profile: { name: string; niche: string; personality: string; age: number; gender: string };
  appearance: Record<string, unknown>;
  conversation: string;
}): string {
  return [
    `Wizard step: 2 (appearance chat)`,
    `UI locale: ${opts.locale}`,
    `Profile: ${opts.profile.name} | ${opts.profile.gender} | ${opts.profile.niche} | age ${opts.profile.age}`,
    `Current appearance: ${JSON.stringify(opts.appearance)}`,
    "",
    "Return JSON:",
    `{ "message": "...", "look": { ethnicity?, hairColor?, hairLength?, hairTexture?, bodyType?, fashionStyles?, skinTone?, height?, bustLevel?, hipsLevel?, shouldersLevel? }, "quickReplies"? }`,
    "",
    "Conversation:",
    opts.conversation,
  ].join("\n");
}

export function buildWizardStep4UserPrompt(opts: {
  locale: "fr" | "en";
  profile: { name: string; niche: string; personality: string };
  appearance: {
    ethnicity?: string;
    bodyType?: string;
    fashionStyles?: string[];
  };
  currentBio: string;
  conversation: string;
}): string {
  return [
    `Wizard step: 4 (summary / bio polish)`,
    `UI locale: ${opts.locale}`,
    `Profile: ${opts.profile.name} | ${opts.profile.niche} | ${opts.profile.personality.slice(0, 120)}`,
    `Appearance: ethnicity=${opts.appearance.ethnicity ?? "-"}, body=${opts.appearance.bodyType ?? "-"}, fashion=${(opts.appearance.fashionStyles ?? []).join(", ") || "-"}`,
    `Current bio: ${opts.currentBio.slice(0, 300) || "(empty)"}`,
    "",
    "Return JSON:",
    `{ "message": "...", "bioOptions": ["<premium/pro bio>", "<authentic bio>"], "quickReplies"? }`,
    "",
    "Conversation:",
    opts.conversation,
  ].join("\n");
}

export function buildWizardStep2LookUserPrompt(opts: {
  locale: "fr" | "en";
  profile: {
    name: string;
    niche: string;
    personality: string;
    age: number;
    gender?: string;
  };
  appearance?: Record<string, unknown>;
}): string {
  const appearanceJson =
    opts.appearance && Object.keys(opts.appearance).length > 0
      ? JSON.stringify(opts.appearance)
      : "none";
  return [
    `Task: suggest ONE coherent look matching the profile below.`,
    `UI locale: ${opts.locale}`,
    `Name: ${opts.profile.name}`,
    `Gender: ${opts.profile.gender ?? "female"}`,
    `Niche: ${opts.profile.niche}`,
    `Age: ${opts.profile.age}`,
    `Personality: ${opts.profile.personality.slice(0, 200)}`,
    `Already chosen: ${appearanceJson}`,
    "",
    "Return JSON only (omit empty fields):",
    `{ "ethnicity"?, "hairColor"?, "hairLength"?, "hairTexture"?, "bodyType"?, "fashionStyles"?: string[], "skinTone"?, "height"?, "bustLevel"?, "hipsLevel"?, "shouldersLevel"? }`,
    "Use exact French labels from the system prompt.",
  ].join("\n");
}
