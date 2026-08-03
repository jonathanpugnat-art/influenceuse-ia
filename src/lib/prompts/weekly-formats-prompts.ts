import { z } from "zod";
import {
  buildTrendsAgentUserPrompt,
  trendAnalysisPickSchema,
  TRENDS_AGENT_MODEL,
  TRENDS_AGENT_SYSTEM_PROMPT,
  type TrendAnalysisPick,
  validateTrendsAgentAnalysis,
} from "@/lib/prompts/trends-agent-prompts";

export {
  TRENDS_AGENT_MODEL,
  TRENDS_AGENT_SYSTEM_PROMPT,
  trendAnalysisPickSchema,
  type TrendAnalysisPick,
  validateTrendsAgentAnalysis,
  buildTrendsAgentUserPrompt,
};

export const WEEKLY_DAY_HINTS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export type WeeklyDayHint = (typeof WEEKLY_DAY_HINTS)[number];

/** Default publish cadence for a 3-format week slate. */
export const WEEKLY_SLOT_DAYS: WeeklyDayHint[] = ["mon", "wed", "fri"];

export const weeklyFormatPickSchema = trendAnalysisPickSchema.extend({
  dayHint: z.enum(WEEKLY_DAY_HINTS),
  preferredStudio: z.enum(["photo", "reel"]).default("photo"),
});

export type WeeklyFormatPick = z.infer<typeof weeklyFormatPickSchema>;

export const weeklyFormatsResultSchema = z.object({
  weekStart: z.string().min(8),
  weekEnd: z.string().min(8),
  picks: z.array(weeklyFormatPickSchema).max(3),
});

export type WeeklyFormatsResult = z.infer<typeof weeklyFormatsResultSchema>;

/** Monday 00:00 UTC of the week containing `from` (or today). */
export function startOfWeekMonday(from: Date = new Date()): Date {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function addUtcDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function toIsoDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Monday=0 … Sunday=6 within the ISO week starting at weekStart. */
export const WEEKLY_DAY_OFFSET: Record<WeeklyDayHint, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

/** Concrete UTC date for a weekly slot (Mon/Wed/Fri…). */
export function weeklySlotDate(
  weekStart: string,
  dayHint: WeeklyDayHint
): Date {
  const monday = startOfWeekMonday(new Date(`${weekStart}T12:00:00.000Z`));
  return addUtcDays(monday, WEEKLY_DAY_OFFSET[dayHint]);
}

export const WEEKLY_FORMATS_SYSTEM_PROMPT = `${TRENDS_AGENT_SYSTEM_PROMPT}

ADDITIONAL WEEKLY SLATE RULES:
- These 3 picks are a content week plan (publish Mon / Wed / Fri).
- Prefer diversity of formats when possible (mix photo and reel-friendly trends).
- Prefer distinct visual scenes (don't pick 3 near-identical gym mirror hooks).
- Order picks by publish priority for the week (best opener first = Monday).`;

export function buildWeeklyFormatsUserPrompt(
  opts: Parameters<typeof buildTrendsAgentUserPrompt>[0] & {
    weekStart: string;
    weekEnd: string;
  }
): string {
  return [
    buildTrendsAgentUserPrompt(opts),
    "",
    `Week window: ${opts.weekStart} → ${opts.weekEnd} (publish slots Mon / Wed / Fri).`,
    "Return the same JSON picks schema — day assignment is applied server-side.",
  ].join("\n");
}
