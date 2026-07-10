import {
  normalizeWizardStep1Raw,
  normalizeWizardStep2LookRaw,
  normalizeWizardStep2TurnRaw,
  wizardStep1TurnSchema,
  wizardStep2LookSchema,
  wizardStep2TurnSchema,
  wizardStep4TurnSchema,
} from "./schemas";
import type {
  WizardStep1TurnResult,
  WizardStep2LookResult,
  WizardStep2TurnResult,
  WizardStep4TurnResult,
} from "./schemas";

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
    `Return JSON: { "message": "...", "suggestions": { ... }, "brief"?: "...", "personaVariants"?: [{ "bio", "personality" }], "quickReplies"?: [...] }`,
    ``,
    `Conversation so far:`,
    opts.conversation || "(no messages yet — greet and ask about purpose)",
  ].join("\n");
}

export function buildWizardStep1PersonaVariantsUserPrompt(opts: {
  locale: "fr" | "en";
  profile: {
    name?: string;
    niche: string;
    gender: string;
    brief?: string;
  };
}): string {
  const lines = [
    `Task: generate exactly 3 persona variants (bio + personality) for the profile below.`,
    `UI locale: ${opts.locale}`,
    `Niche: ${opts.profile.niche}`,
    `Gender: ${opts.profile.gender}`,
  ];
  if (opts.profile.name?.trim()) {
    lines.push(`Name: ${opts.profile.name.trim()}`);
  }
  if (opts.profile.brief?.trim()) {
    lines.push("", `INFLUENCER BRIEF:\n${opts.profile.brief.trim()}`);
  }
  lines.push(
    "",
    "Return JSON only:",
    `{ "message": "...", "personaVariants": [{ "bio": "...", "personality": "..." }, ...] }`,
    "Three distinct tones: warm/authentic, playful/fun, aspirational/bold."
  );
  return lines.join("\n");
}

export function buildWizardStep2UserPrompt(opts: {
  locale: "fr" | "en";
  profile: { name: string; niche: string; personality: string; age: number; gender: string };
  appearance: Record<string, unknown>;
  brief?: string;
  conversation: string;
}): string {
  const lines = [
    `Wizard step: 2 (appearance chat)`,
    `UI locale: ${opts.locale}`,
    `Profile: ${opts.profile.name} | ${opts.profile.gender} | ${opts.profile.niche} | age ${opts.profile.age}`,
    `Current appearance: ${JSON.stringify(opts.appearance)}`,
  ];

  if (opts.brief?.trim()) {
    lines.push("", `INFLUENCER BRIEF:\n${opts.brief.trim()}`);
  }

  lines.push(
    "",
    "Return JSON:",
    `{ "message": "...", "look": { ethnicity?, hairColor?, hairLength?, hairTexture?, bodyType?, fashionStyles?, skinTone?, height?, bustLevel?, hipsLevel?, shouldersLevel? }, "quickReplies"? }`,
    "",
    "Conversation:",
    opts.conversation
  );

  return lines.join("\n");
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
  brief?: string;
  conversation: string;
}): string {
  const lines = [
    `Wizard step: 4 (summary / bio polish)`,
    `UI locale: ${opts.locale}`,
    `Profile: ${opts.profile.name} | ${opts.profile.niche} | ${opts.profile.personality.slice(0, 120)}`,
    `Appearance: ethnicity=${opts.appearance.ethnicity ?? "-"}, body=${opts.appearance.bodyType ?? "-"}, fashion=${(opts.appearance.fashionStyles ?? []).join(", ") || "-"}`,
    `Current bio: ${opts.currentBio.slice(0, 300) || "(empty)"}`,
  ];

  if (opts.brief?.trim()) {
    lines.push("", `INFLUENCER BRIEF:\n${opts.brief.trim()}`);
  }

  lines.push(
    "",
    "Return JSON:",
    `{ "message": "...", "bioOptions": ["<premium/pro bio>", "<authentic bio>"], "quickReplies"? }`,
    "",
    "Conversation:",
    opts.conversation
  );

  return lines.join("\n");
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
  brief?: string;
}): string {
  const appearanceJson =
    opts.appearance && Object.keys(opts.appearance).length > 0
      ? JSON.stringify(opts.appearance)
      : "none";
  const lines = [
    `Task: suggest ONE coherent look matching the profile below.`,
    `UI locale: ${opts.locale}`,
    `Name: ${opts.profile.name}`,
    `Gender: ${opts.profile.gender ?? "female"}`,
    `Niche: ${opts.profile.niche}`,
    `Age: ${opts.profile.age}`,
    `Personality: ${opts.profile.personality.slice(0, 200)}`,
    `Already chosen: ${appearanceJson}`,
  ];

  if (opts.brief?.trim()) {
    lines.push("", `INFLUENCER BRIEF:\n${opts.brief.trim()}`);
  }

  lines.push(
    "",
    "Return JSON only (omit empty fields):",
    `{ "ethnicity"?, "hairColor"?, "hairLength"?, "hairTexture"?, "bodyType"?, "fashionStyles"?: string[], "skinTone"?, "height"?, "bustLevel"?, "hipsLevel"?, "shouldersLevel"? }`,
    "Use exact French labels from the system prompt."
  );

  return lines.join("\n");
}
