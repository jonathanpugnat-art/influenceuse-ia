// ──────────────────────────────────────────────
// Caption & Text Generation Prompt Templates
// ──────────────────────────────────────────────

/** System prompts per platform */
export const CAPTION_SYSTEM_PROMPTS: Record<string, string> = {
  INSTAGRAM: `Tu es une influenceuse {niche} nommée {name}. Ta personnalité : {personality}.
Génère une caption Instagram engageante pour cette photo/vidéo.
Utilise des emojis, un ton {tone}, et inclus un call-to-action.
Longueur : 150-300 caractères.
Langue : {language}`,

  TIKTOK: `Tu es une influenceuse {niche} nommée {name}. Ta personnalité : {personality}.
Génère une caption TikTok courte et punchy pour cette vidéo.
Maximum 100 caractères, accrocheur, avec 1-2 emojis max.
Langue : {language}`,

  ONLYFANS: `Tu es une influenceuse {niche} nommée {name}. Ta personnalité : {personality}.
Génère un message OnlyFans intime et engageant pour ce contenu.
Ton personnel et exclusif, comme si tu parlais à un abonné fidèle.
Longueur : 100-200 caractères.
Langue : {language}`,
};

/** System prompt for hashtag generation */
export const HASHTAG_SYSTEM_PROMPT = `Tu es un expert en social media marketing.
Génère {count} hashtags pertinents pour un post {platform} dans la niche {niche}.
Le post montre : {description}.
Retourne UNIQUEMENT les hashtags séparés par des espaces, sans numérotation, sans explication.
Mélange des hashtags populaires (>1M posts) et des hashtags de niche (<100K posts).
Langue : {language}`;

/** System prompt for bio generation */
export const BIO_SYSTEM_PROMPT = `Tu es un expert en personal branding sur les réseaux sociaux.
Crée une bio courte et percutante pour une influenceuse.
Nom : {name}
Niche : {niche}
Personnalité : {personality}
Langue : {language}

La bio doit :
- Faire maximum 150 caractères
- Inclure 2-3 emojis pertinents
- Avoir un ton {tone} et authentique
- Inclure un petit call-to-action ou tagline

Retourne UNIQUEMENT la bio, sans guillemets ni explication.`;

/** Tone presets per niche */
export const NICHE_TONES: Record<string, string> = {
  FASHION: "tendance et sophistiqué",
  FITNESS: "motivant et énergique",
  LIFESTYLE: "chaleureux et inspirant",
  TRAVEL: "aventurier et poétique",
  TECH: "expert et accessible",
  GAMING: "fun et compétitif",
  ADULT: "séducteur et confiant",
  FOOD: "gourmand et passionné",
};

/** Language labels */
export const LANGUAGE_LABELS: Record<string, string> = {
  fr: "français",
  en: "anglais",
};

// ──────────────────────────────────────────────
// Template interpolation
// ──────────────────────────────────────────────

/**
 * Replaces {key} placeholders in a template string with values from the vars object.
 */
export function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) =>
      result.replace(new RegExp(`\\{${key}\\}`, "g"), value),
    template
  );
}

/**
 * Builds the system prompt for caption generation.
 */
export function buildCaptionSystemPrompt(input: {
  name: string;
  niche: string;
  personality: string;
  platform: string;
  tone?: string;
  language: string;
}): string {
  const template =
    CAPTION_SYSTEM_PROMPTS[input.platform] ??
    CAPTION_SYSTEM_PROMPTS.INSTAGRAM;

  return interpolateTemplate(template, {
    name: input.name,
    niche: input.niche.toLowerCase(),
    personality: input.personality,
    tone: input.tone ?? NICHE_TONES[input.niche] ?? "authentique",
    language: LANGUAGE_LABELS[input.language] ?? input.language,
  });
}

/**
 * Builds the system prompt for hashtag generation.
 */
export function buildHashtagSystemPrompt(input: {
  niche: string;
  platform: string;
  description: string;
  count: number;
  language: string;
}): string {
  return interpolateTemplate(HASHTAG_SYSTEM_PROMPT, {
    count: String(input.count),
    platform: input.platform,
    niche: input.niche.toLowerCase(),
    description: input.description,
    language: LANGUAGE_LABELS[input.language] ?? input.language,
  });
}

/**
 * Builds the system prompt for bio generation.
 */
export function buildBioSystemPrompt(input: {
  name: string;
  niche: string;
  personality: string;
  language: string;
  tone?: string;
}): string {
  return interpolateTemplate(BIO_SYSTEM_PROMPT, {
    name: input.name,
    niche: input.niche.toLowerCase(),
    personality: input.personality,
    language: LANGUAGE_LABELS[input.language] ?? input.language,
    tone: input.tone ?? NICHE_TONES[input.niche] ?? "authentique",
  });
}
