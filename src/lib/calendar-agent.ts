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

const MAX_PLAN_DAYS = 14;

export function detectMessageLocale(text: string): "fr" | "en" {
  const sample = text.toLowerCase();
  const frenchHints =
    /\b(ce mois|cette semaine|semaine|été|vibe|niche|je veux|par semaine|sur instagram)\b/i;
  const englishHints =
    /\b(this month|this week|per week|summer vibe|niche|i want|on instagram)\b/i;

  if (frenchHints.test(sample) && !englishHints.test(sample)) return "fr";
  if (englishHints.test(sample) && !frenchHints.test(sample)) return "en";
  if (/[àâçéèêëîïôùûü]|(?:\bje\b|\bpour\b|\bdes\b)/i.test(sample)) return "fr";
  return "en";
}

export function countQuestions(message: string): number {
  return (message.match(/\?/g) ?? []).length;
}

function parsePostsPerWeek(text: string): number | null {
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
  locale: "fr" | "en"
): CalendarAgentTurnResult {
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content.toLowerCase() ?? "";
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
  const resolvedLocale = detectMessageLocale(lastUser?.content ?? "") || locale;

  const params: CalendarAgentParams = {
    postsPerWeek: parsePostsPerWeek(text),
    startDate:
      text.includes("ce mois") || text.includes("this month") ? monthStart : null,
    endDate:
      text.includes("ce mois") || text.includes("this month") ? monthEnd : null,
    vibe: parseVibe(text, resolvedLocale),
    goals: parseGoals(text),
    platforms: parsePlatforms(text),
    language: resolvedLocale,
  };

  const missing: string[] = [];
  if (!params.postsPerWeek) missing.push("postsPerWeek");
  if (!params.startDate) missing.push("startDate");
  if (!params.endDate) missing.push("endDate");
  if (!params.platforms?.length) missing.push("platforms");

  const message =
    missing.length > 0
      ? buildClarifyingMessage(missing, resolvedLocale)
      : resolvedLocale === "fr"
        ? "Parfait, je peux générer ton plan éditorial."
        : "Great, I can generate your editorial plan.";

  return {
    params,
    missingFields: missing,
    message,
    readyToExecute: missing.length === 0,
  };
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
      " Je lance la génération…"
    );
  }
  return (
    `Plan ready: ${total} posts over ${params.days} day(s) ` +
    `(≈ ${params.postsPerDay}/day), platforms ${params.platforms.join(" + ")}.` +
    (params.vibe ? ` Vibe: ${params.vibe}.` : "") +
    " Starting generation…"
  );
}

export function calendarAgentTurnToOutput(
  parsed: CalendarAgentTurnResult,
  executionParams: CalendarPlanExecutionParams | null,
  locale: "fr" | "en"
): AgentTurnOutput {
  const quickReplies =
    parsed.missingFields.length > 0
      ? parsed.missingFields.includes("platforms")
        ? ["Instagram", "TikTok", "Instagram + TikTok"]
        : parsed.missingFields.includes("postsPerWeek")
          ? ["2×/semaine", "3×/semaine", "1 post/jour"]
          : ["Ce mois", "2 prochaines semaines", "Cette semaine"]
      : undefined;

  const message = executionParams
    ? `${parsed.message}\n\n${buildPlanPreviewMessage(executionParams, locale)}`
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
