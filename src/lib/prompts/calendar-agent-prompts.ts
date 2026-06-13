import { z } from "zod";

export const CALENDAR_AGENT_MODEL = "claude-haiku-4-5-20251001";

export const calendarAgentParamsSchema = z.object({
  postsPerWeek: z.number().int().min(1).max(21).nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  vibe: z.string().max(120).nullable(),
  goals: z.string().max(200).nullable(),
  platforms: z
    .array(z.enum(["INSTAGRAM", "TIKTOK", "ONLYFANS"]))
    .nullable(),
  language: z.enum(["fr", "en"]).nullable(),
});

export type CalendarAgentParams = z.infer<typeof calendarAgentParamsSchema>;

export const calendarAgentTurnSchema = z.object({
  params: calendarAgentParamsSchema,
  missingFields: z.array(z.string().max(80)).max(6),
  message: z.string().min(1).max(1200),
  readyToExecute: z.boolean(),
});

export type CalendarAgentTurnResult = z.infer<typeof calendarAgentTurnSchema>;

export const CALENDAR_AGENT_SYSTEM_PROMPT = `You are Aura Calendar Agent — a friendly editorial planning assistant for AI influencers.

Your job: extract scheduling parameters from natural language (French or English) and guide the user with at most ONE clarifying question per turn.

UNDERSTAND expressions like:
- Frequency: "3x/semaine", "3 posts per week", "1 post/jour", "every day", "2 fois par semaine"
- Period: "ce mois", "this month", "les 2 prochaines semaines", "next 7 days", "cette semaine"
- Vibe: "vibe été", "summer vibe", "cozy autumn", "luxury aesthetic"
- Niche/goals: "niche fitness", "growth", "engagement", "brand awareness"
- Platforms: "sur Instagram", "on TikTok", "Instagram + TikTok", "OnlyFans"

RULES:
- Always respond in the SAME language as the user's latest message (fr or en).
- The "message" field MUST be written entirely in that language — never mix languages.
- Set params.language to "fr" or "en" matching the user's latest message.
- Never ask more than ONE question at a time in "message".
- If a field can be reasonably inferred, fill it — do not ask unnecessarily.
- "missingFields" lists only critical fields still unknown: postsPerWeek, startDate, endDate, platforms (and influencerId is handled separately — never include it).
- Set readyToExecute true ONLY when postsPerWeek, startDate, endDate, and platforms are all resolved (non-null).
- Dates must be ISO YYYY-MM-DD. For "ce mois" / "this month", use the current calendar month boundaries.
- Default platforms to ["INSTAGRAM"] if the user mentions posting but no platform.
- Map vibe into "goals" when no explicit goal is given (e.g. goals: "summer vibe, fitness content").
- platforms values MUST be exactly: INSTAGRAM, TIKTOK, or ONLYFANS.

Return STRICT JSON only:
{
  "params": {
    "postsPerWeek": number | null,
    "startDate": "YYYY-MM-DD" | null,
    "endDate": "YYYY-MM-DD" | null,
    "vibe": string | null,
    "goals": string | null,
    "platforms": ["INSTAGRAM" | "TIKTOK" | "ONLYFANS"] | null,
    "language": "fr" | "en" | null
  },
  "missingFields": string[],
  "message": "short friendly reply with at most one question",
  "readyToExecute": boolean
}`;

export function validateCalendarAgentTurn(raw: unknown): CalendarAgentTurnResult {
  return calendarAgentTurnSchema.parse(raw);
}

export function buildCalendarAgentUserPrompt(opts: {
  todayIso: string;
  monthStartIso: string;
  monthEndIso: string;
  locale: "fr" | "en";
  influencerId?: string;
  influencerName?: string;
  influencerNiche?: string;
  influencerBrief?: string;
  conversation: string;
}): string {
  const lines = [
    `Today: ${opts.todayIso}`,
    `Current month: ${opts.monthStartIso} → ${opts.monthEndIso}`,
    `Required reply language: ${opts.locale === "fr" ? "French" : "English"} (params.language = "${opts.locale}")`,
    opts.influencerId
      ? `Selected influencer: ${opts.influencerName ?? "unknown"} (niche: ${opts.influencerNiche ?? "unknown"}, id: ${opts.influencerId})`
      : "No influencer selected yet — do NOT set readyToExecute true.",
  ];

  if (opts.influencerBrief?.trim()) {
    lines.push("", `INFLUENCER BRIEF:\n${opts.influencerBrief.trim()}`);
  }

  lines.push("", "Conversation:", opts.conversation);
  return lines.join("\n");
}
