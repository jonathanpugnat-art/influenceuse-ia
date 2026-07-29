import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import {
  type AgentTurnInput,
  type AgentTurnOutput,
  type CalendarPlanExecutionParams,
} from "@/lib/agent-core";
import type {
  CalendarAgentParams,
  CalendarAgentTurnResult,
} from "@/lib/prompts/calendar-agent-prompts";

/** Max span for an editorial plan (S5: 30-day month plans). */
export const MAX_PLAN_DAYS = 30;

const FRENCH_LOCALE_PATTERNS = [
  /\bce mois\b/,
  /\bcette semaine\b/,
  /\bpar semaine\b/,
  /\b(?:fois|x|×)\s*par\s*semaine\b/,
  /\bsemaine\b/,
  /\bété\b/,
  /\bje veux\b/,
  /\bsur instagram\b/,
  /\bgénérer\b/,
  /\bplanifier\b/,
  /\bcombien de posts\b/,
  /\bquelle période\b/,
  /\b(?:^|\s)(?:je|tu|vous|des|une|pour|avec|mon|ma|mes)(?:\s|$)/,
];

const ENGLISH_LOCALE_PATTERNS = [
  /\bthis month\b/,
  /\bthis week\b/,
  /\bper week\b/,
  /\bposts per week\b/,
  /\bi want\b/,
  /\bon instagram\b/,
  /\bhow many posts\b/,
  /\bwhich period\b/,
  /\b(?:^|\s)(?:the|and|with|your|would|could|my)(?:\s|$)/,
];

export function detectMessageLocale(text: string): "fr" | "en" | null {
  const sample = text.toLowerCase();
  let frScore = 0;
  let enScore = 0;

  for (const pattern of FRENCH_LOCALE_PATTERNS) {
    if (pattern.test(sample)) frScore += 1;
  }
  for (const pattern of ENGLISH_LOCALE_PATTERNS) {
    if (pattern.test(sample)) enScore += 1;
  }
  if (/[àâçéèêëîïôùûü]/.test(sample)) frScore += 2;

  if (frScore > enScore) return "fr";
  if (enScore > frScore) return "en";
  return null;
}

export function resolveCalendarAgentLocale(
  input: AgentTurnInput,
  fallback: "fr" | "en" = "fr"
): "fr" | "en" {
  const userMessages = input.messages.filter((m) => m.role === "user");
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const detected = detectMessageLocale(userMessages[i]!.content);
    if (detected) return detected;
  }

  const ctxLocale = input.context?.locale;
  if (ctxLocale === "fr" || ctxLocale === "en") return ctxLocale;
  return fallback;
}

export function countQuestions(message: string): number {
  return (message.match(/\?/g) ?? []).length;
}

function parsePostsPerWeek(text: string): number | null {
  // "30 posts" / "plan 30 jours" → ~1/day ≈ 7/week over a month
  // (must run before day-unit matching — "30 jours" is a span, not 30/day)
  if (
    /\b30\s*posts?\b/i.test(text) ||
    /\bplan\s*30\s*(?:jours?|days?)\b/i.test(text)
  ) {
    return 7;
  }
  // Require "post(s)" before the day unit so "30 jours" never matches.
  const perDay = text.match(
    /(\d+)\s*posts?\s*(?:par|per|\/)\s*(?:jour|day)\b/i
  );
  if (perDay?.[1]) {
    return Math.min(21, Math.max(1, Number(perDay[1]) * 7));
  }
  const match =
    text.match(/(\d+)\s*(?:x|×|\*)?\s*(?:\/|par\s*)?(?:semaine|week)/i) ??
    text.match(/(\d+)\s*posts?\s*(?:par|per|\/)\s*(?:semaine|week)/i);
  return match?.[1] ? Number(match[1]) : null;
}

function parseVibe(text: string, locale: "fr" | "en"): string | null {
  if (text.includes("été")) return "été";
  if (text.includes("summer")) return "summer";
  if (text.includes("vibe été")) return "été";
  if (text.includes("summer vibe")) return "summer";
  if (locale === "fr" && text.includes("vibe")) {
    const vibeMatch = text.match(/vibe\s+([a-zàâçéèêëîïôùûü\s]+)/i);
    return vibeMatch?.[1]?.trim() ?? null;
  }
  return null;
}

function parseGoals(text: string): string | null {
  if (text.includes("niche fitness") || text.includes("fitness niche")) {
    return "fitness";
  }
  if (text.includes("fitness")) return "fitness";
  return null;
}

function parsePlatforms(text: string): CalendarAgentParams["platforms"] {
  if (text.includes("tiktok") && text.includes("instagram")) {
    return ["INSTAGRAM", "TIKTOK"];
  }
  if (text.includes("tiktok")) return ["TIKTOK"];
  if (text.includes("instagram")) return ["INSTAGRAM"];
  return ["INSTAGRAM"];
}

function buildClarifyingMessage(
  missingFields: string[],
  locale: "fr" | "en"
): string {
  const field = missingFields[0] ?? "postsPerWeek";

  if (locale === "fr") {
    switch (field) {
      case "postsPerWeek":
        return "Combien de posts par semaine souhaites-tu publier ?";
      case "startDate":
      case "endDate":
        return "Sur quelle période veux-tu planifier (ex. ce mois) ?";
      case "platforms":
        return "Sur quelle plateforme veux-tu publier (Instagram, TikTok) ?";
      default:
        return "Peux-tu préciser ta fréquence de publication ?";
    }
  }

  switch (field) {
    case "postsPerWeek":
      return "How many posts per week would you like?";
    case "startDate":
    case "endDate":
      return "Which period should we plan for (e.g. this month)?";
    case "platforms":
      return "Which platform should we target (Instagram, TikTok)?";
    default:
      return "Can you clarify your posting frequency?";
  }
}

function buildQuickReplies(
  missingFields: string[],
  locale: "fr" | "en"
): string[] | undefined {
  if (!missingFields.length) return undefined;

  if (missingFields.includes("platforms")) {
    return ["Instagram", "TikTok", "Instagram + TikTok"];
  }
  if (missingFields.includes("postsPerWeek")) {
    return locale === "fr"
      ? ["3×/semaine", "1 post/jour", "30 posts sur 30 jours"]
      : ["3×/week", "1 post/day", "30 posts over 30 days"];
  }
  return locale === "fr"
    ? ["Ce mois", "2 prochaines semaines", "Cette semaine"]
    : ["This month", "Next 2 weeks", "This week"];
}

export function localizeCalendarAgentTurn(
  parsed: CalendarAgentTurnResult,
  locale: "fr" | "en"
): CalendarAgentTurnResult {
  const message =
    parsed.missingFields.length > 0
      ? buildClarifyingMessage(parsed.missingFields, locale)
      : parsed.readyToExecute
        ? locale === "fr"
          ? "Parfait, je peux générer ton plan éditorial."
          : "Great, I can generate your editorial plan."
        : parsed.message;

  return {
    ...parsed,
    message,
    params: {
      ...parsed.params,
      language: locale,
    },
  };
}

export function postsPerWeekToPlanShape(opts: {
  postsPerWeek: number;
  startDate: Date;
  endDate: Date;
}): { days: number; postsPerDay: number; startDate: Date } {
  const spanDays = Math.min(
    MAX_PLAN_DAYS,
    Math.max(1, differenceInCalendarDays(opts.endDate, opts.startDate) + 1)
  );
  const totalPosts = Math.max(
    1,
    Math.min(spanDays * 5, Math.ceil(opts.postsPerWeek * (spanDays / 7)))
  );

  if (totalPosts <= spanDays) {
    return {
      days: Math.min(MAX_PLAN_DAYS, totalPosts),
      postsPerDay: 1,
      startDate: opts.startDate,
    };
  }

  const postsPerDay = Math.min(5, Math.ceil(totalPosts / spanDays));
  const days = Math.min(MAX_PLAN_DAYS, Math.ceil(totalPosts / postsPerDay));
  return { days, postsPerDay, startDate: opts.startDate };
}

export function buildCalendarExecutionParams(opts: {
  params: CalendarAgentParams;
  influencerId: string;
  locale: "fr" | "en";
}): CalendarPlanExecutionParams | null {
  const { params, influencerId, locale } = opts;
  if (
    !params.postsPerWeek ||
    !params.startDate ||
    !params.endDate ||
    !params.platforms?.length
  ) {
    return null;
  }

  const startDate = parseISO(params.startDate);
  const endDate = parseISO(params.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  const planShape = postsPerWeekToPlanShape({
    postsPerWeek: params.postsPerWeek,
    startDate,
    endDate: endDate < startDate ? addDays(startDate, 6) : endDate,
  });

  const goalsParts = [params.goals, params.vibe].filter(Boolean);
  const goals = goalsParts.length ? goalsParts.join(", ") : undefined;

  const scheduledStart = new Date(planShape.startDate);
  scheduledStart.setHours(10, 0, 0, 0);

  return {
    influencerId,
    days: planShape.days,
    postsPerDay: planShape.postsPerDay,
    platforms: params.platforms,
    language: params.language ?? locale,
    goals,
    startDate: scheduledStart.toISOString(),
    vibe: params.vibe ?? undefined,
  };
}

export function buildFallbackCalendarTurn(
  input: AgentTurnInput,
  fallback: "fr" | "en"
): CalendarAgentTurnResult {
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content.toLowerCase() ?? "";
  const conversationLocale = resolveCalendarAgentLocale(input, fallback);
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

  const params: CalendarAgentParams = {
    postsPerWeek: parsePostsPerWeek(text),
    startDate:
      text.includes("ce mois") || text.includes("this month") ? monthStart : null,
    endDate:
      text.includes("ce mois") || text.includes("this month") ? monthEnd : null,
    vibe: parseVibe(text, conversationLocale),
    goals: parseGoals(text),
    platforms: parsePlatforms(text),
    language: conversationLocale,
  };

  const missing: string[] = [];
  if (!params.postsPerWeek) missing.push("postsPerWeek");
  if (!params.startDate) missing.push("startDate");
  if (!params.endDate) missing.push("endDate");
  if (!params.platforms?.length) missing.push("platforms");

  return localizeCalendarAgentTurn(
    {
      params,
      missingFields: missing,
      message: "",
      readyToExecute: missing.length === 0,
    },
    conversationLocale
  );
}

function buildPlanPreviewMessage(
  params: CalendarPlanExecutionParams,
  locale: "fr" | "en"
): string {
  const total = params.days * params.postsPerDay;
  if (locale === "fr") {
    return (
      `Plan prêt : ${total} posts sur ${params.days} jour(s) ` +
      `(≈ ${params.postsPerDay}/jour), plateformes ${params.platforms.join(" + ")}.` +
      (params.vibe ? ` Vibe : ${params.vibe}.` : "") +
      " Valide le lot avant de lancer les images."
    );
  }
  return (
    `Plan ready: ${total} posts over ${params.days} day(s) ` +
    `(≈ ${params.postsPerDay}/day), platforms ${params.platforms.join(" + ")}.` +
    (params.vibe ? ` Vibe: ${params.vibe}.` : "") +
    " Review the batch before generating images."
  );
}

export function calendarAgentTurnToOutput(
  parsed: CalendarAgentTurnResult,
  executionParams: CalendarPlanExecutionParams | null,
  locale: "fr" | "en"
): AgentTurnOutput {
  const replyLocale = parsed.params.language ?? locale;
  const quickReplies = buildQuickReplies(parsed.missingFields, replyLocale);

  const message = executionParams
    ? `${parsed.message}\n\n${buildPlanPreviewMessage(executionParams, replyLocale)}`
    : parsed.message;

  return {
    message,
    quickReplies,
    action: executionParams ? "generate_content_plan" : undefined,
    readyToExecute: Boolean(executionParams),
    executionParams: executionParams ?? undefined,
  };
}

export function mergeCalendarParams(
  base: CalendarAgentParams,
  patch: Partial<CalendarAgentParams>
): CalendarAgentParams {
  return {
    postsPerWeek: patch.postsPerWeek ?? base.postsPerWeek,
    startDate: patch.startDate ?? base.startDate,
    endDate: patch.endDate ?? base.endDate,
    vibe: patch.vibe ?? base.vibe,
    goals: patch.goals ?? base.goals,
    platforms: patch.platforms ?? base.platforms,
    language: patch.language ?? base.language,
  };
}

export function isCalendarParamsReady(params: CalendarAgentParams): boolean {
  return Boolean(
    params.postsPerWeek &&
      params.startDate &&
      params.endDate &&
      params.platforms?.length
  );
}
