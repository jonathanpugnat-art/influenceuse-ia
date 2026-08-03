import type { Influencer, TrendItem } from "@/generated/prisma/client";
import type { TrendFormatBrief } from "@/lib/trends/trend-format-brief";
import {
  buildTrendsAgentUserPrompt,
  TRENDS_AGENT_MODEL,
  TRENDS_AGENT_SYSTEM_PROMPT,
  type TrendAnalysisPick,
  validateTrendsAgentAnalysis,
} from "@/lib/prompts/trends-agent-prompts";
import {
  addUtcDays,
  buildWeeklyFormatsUserPrompt,
  startOfWeekMonday,
  toIsoDateUtc,
  weeklySlotDate,
  WEEKLY_FORMATS_SYSTEM_PROMPT,
  WEEKLY_SLOT_DAYS,
  type WeeklyDayHint,
  type WeeklyFormatPick,
  type WeeklyFormatsResult,
} from "@/lib/prompts/weekly-formats-prompts";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { callAgentJsonLLM } from "@/server/services/ai-text.service";
import { inferAdultLaneFromSignals } from "@/lib/text-provider-config";
import { getTrendFormatBrief } from "@/server/services/trend-media-analysis.service";

export type TrendAnalysisInput = Pick<
  TrendItem,
  | "id"
  | "title"
  | "description"
  | "hashtags"
  | "growthScore"
  | "platform"
  | "nicheTags"
> & {
  formatBrief?: Pick<
    TrendFormatBrief,
    | "contentType"
    | "sceneDescription"
    | "mood"
    | "hook"
    | "lighting"
    | "cameraStyle"
    | "inspirationNotes"
    | "confidence"
  >;
};

export function mapTrendItemsForAnalysis(
  items: TrendItem[]
): TrendAnalysisInput[] {
  return items.map((t) => {
    const brief = getTrendFormatBrief(t);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      platform: t.platform,
      growthScore: t.growthScore,
      nicheTags: t.nicheTags,
      hashtags: t.hashtags,
      formatBrief: brief
        ? {
            contentType: brief.contentType,
            sceneDescription: brief.sceneDescription,
            mood: brief.mood,
            hook: brief.hook,
            lighting: brief.lighting,
            cameraStyle: brief.cameraStyle,
            inspirationNotes: brief.inspirationNotes,
            confidence: brief.confidence,
          }
        : undefined,
    };
  });
}

function buildFallbackPicks(
  influencer: Pick<Influencer, "niche" | "personality">,
  trends: TrendAnalysisInput[],
  language: "fr" | "en"
): TrendAnalysisPick[] {
  const ranked = [...trends].sort(
    (a, b) => (b.growthScore ?? 0) - (a.growthScore ?? 0)
  );

  return ranked.slice(0, 3).map((trend, index) => {
    const nicheMatch =
      trend.nicheTags.includes(influencer.niche) ||
      trend.nicheTags.includes("GENERAL") ||
      trend.nicheTags.length === 0;

    const title = trend.title.replace(/\s+/g, " ").trim().slice(0, 72);
    const tags =
      trend.hashtags.length > 0
        ? trend.hashtags
            .slice(0, 3)
            .map((h) => `#${h}`)
            .join(" ")
        : "";
    const score = Math.round(trend.growthScore ?? 0);
    const voice = influencer.personality.replace(/\s+/g, " ").trim().slice(0, 48);

    const whyItWorks =
      language === "fr"
        ? nicheMatch
          ? `« ${title} »${tags ? ` (${tags})` : ""} — ${trend.platform} en hausse (score ${score}). Ta niche ${influencer.niche} + ton ton « ${voice} » rendent ce hook crédible sans copier le créateur original.`
          : `« ${title} »${tags ? ` (${tags})` : ""} — momentum ${score}/100 sur ${trend.platform}. Twist-le avec ta personnalité « ${voice} » pour te démarquer dans ${influencer.niche}.`
        : nicheMatch
          ? `"${title}"${tags ? ` (${tags})` : ""} — rising on ${trend.platform} (score ${score}). Your ${influencer.niche} niche and "${voice}" voice make this hook feel authentic.`
          : `"${title}"${tags ? ` (${tags})` : ""} — momentum ${score}/100 on ${trend.platform}. Twist it with your "${voice}" personality to stand out in ${influencer.niche}.`;

    const angleHooks = [
      language === "fr"
        ? `Ouvre sur un détail visuel de « ${title.slice(0, 40)} » en moins de 3 secondes.`
        : `Open on a visual detail from "${title.slice(0, 40)}" within 3 seconds.`,
      tags
        ? language === "fr"
          ? `Reprends ${tags.split(" ")[0]} mais avec ta signature ${influencer.niche.toLowerCase()}.`
          : `Reuse ${tags.split(" ")[0]} with your ${influencer.niche.toLowerCase()} signature.`
        : language === "fr"
          ? `Reformule le hook avec ta voix « ${voice} » dès la première seconde.`
          : `Rewrite the hook in your "${voice}" voice from second one.`,
      language === "fr"
        ? `Termine sur une CTA soft alignée avec ${influencer.niche.toLowerCase()} (save / follow / lien bio).`
        : `Close with a soft CTA aligned to ${influencer.niche.toLowerCase()} (save / follow / bio link).`,
    ];

    return {
      trendId: trend.id,
      whyItWorks,
      suggestedAngle: angleHooks[index % angleHooks.length]!,
      confidence: nicheMatch ? "high" : "medium",
    };
  });
}

async function callTrendsAgentJson(
  userPrompt: string,
  contentLane: "sfw" | "adult",
  systemPrompt: string = TRENDS_AGENT_SYSTEM_PROMPT
): Promise<TrendAnalysisPick[]> {
  const result = await callAgentJsonLLM({
    contentLane,
    systemPrompt,
    userPrompt,
    maxTokens: 900,
    temperature: 0.35,
    anthropicModel: TRENDS_AGENT_MODEL,
    validate: validateTrendsAgentAnalysis,
    repairInstruction: "Return only valid JSON matching the schema.",
  });
  return result.picks;
}

function resolvePreferredStudio(
  trend: TrendAnalysisInput | undefined
): "photo" | "reel" {
  const type = trend?.formatBrief?.contentType?.toLowerCase() ?? "";
  if (
    type.includes("reel") ||
    type.includes("video") ||
    type.includes("tiktok") ||
    type.includes("ugc")
  ) {
    return "reel";
  }
  return "photo";
}

function toWeeklyPicks(
  picks: TrendAnalysisPick[],
  pool: TrendAnalysisInput[]
): WeeklyFormatPick[] {
  const byId = new Map(pool.map((t) => [t.id, t]));
  return picks.slice(0, 3).map((pick, index) => ({
    ...pick,
    dayHint: WEEKLY_SLOT_DAYS[index] ?? "fri",
    preferredStudio: resolvePreferredStudio(byId.get(pick.trendId)),
  }));
}

export async function analyzeTrendsForInfluencer(
  influencer: Pick<
    Influencer,
    "id" | "name" | "niche" | "personality" | "bio" | "brief" | "isNsfw"
  >,
  trends: TrendAnalysisInput[],
  opts?: { language?: "fr" | "en"; searchQuery?: string }
): Promise<TrendAnalysisPick[]> {
  const language = opts?.language ?? "fr";
  const pool = trends.slice(0, 10);

  if (pool.length === 0) return [];

  const contentLane = inferAdultLaneFromSignals({
    isNsfw: influencer.isNsfw,
    niche: influencer.niche,
    brief: influencer.brief ?? undefined,
  });

  const userPrompt = buildTrendsAgentUserPrompt({
    influencerName: influencer.name,
    niche: influencer.niche,
    personality: influencer.personality,
    bio: influencer.bio,
    brief: influencer.brief ?? undefined,
    language,
    trends: pool,
    searchQuery: opts?.searchQuery,
  });

  try {
    const picks = await callTrendsAgentJson(userPrompt, contentLane);
    const validIds = new Set(pool.map((t) => t.id));
    const filtered = picks.filter((p) => validIds.has(p.trendId)).slice(0, 3);
    if (filtered.length >= 1) return filtered;
  } catch (error) {
    console.warn("[trends-agent] LLM failed, using fallback:", error);
  }

  return buildFallbackPicks(influencer, pool, language);
}

/**
 * Weekly editorial slate: top 3 scrapes from the DB feed, framed as Mon/Wed/Fri.
 * Reuses the trends agent; day slots + studio preference are assigned server-side.
 */
export async function proposeWeeklyFormatsForInfluencer(
  influencer: Pick<
    Influencer,
    "id" | "name" | "niche" | "personality" | "bio" | "brief" | "isNsfw"
  >,
  trends: TrendAnalysisInput[],
  opts?: {
    language?: "fr" | "en";
    searchQuery?: string;
    weekStart?: string;
  }
): Promise<WeeklyFormatsResult> {
  const language = opts?.language ?? "fr";
  const pool = trends.slice(0, 10);
  const weekStartDate = opts?.weekStart
    ? startOfWeekMonday(new Date(`${opts.weekStart}T00:00:00.000Z`))
    : startOfWeekMonday();
  const weekEndDate = addUtcDays(weekStartDate, 6);
  const weekStart = toIsoDateUtc(weekStartDate);
  const weekEnd = toIsoDateUtc(weekEndDate);

  if (pool.length === 0) {
    return { weekStart, weekEnd, picks: [] };
  }

  const contentLane = inferAdultLaneFromSignals({
    isNsfw: influencer.isNsfw,
    niche: influencer.niche,
    brief: influencer.brief ?? undefined,
  });

  const userPrompt = buildWeeklyFormatsUserPrompt({
    influencerName: influencer.name,
    niche: influencer.niche,
    personality: influencer.personality,
    bio: influencer.bio,
    brief: influencer.brief ?? undefined,
    language,
    trends: pool,
    searchQuery: opts?.searchQuery,
    weekStart,
    weekEnd,
  });

  let picks: TrendAnalysisPick[];
  try {
    const raw = await callTrendsAgentJson(
      userPrompt,
      contentLane,
      WEEKLY_FORMATS_SYSTEM_PROMPT
    );
    const validIds = new Set(pool.map((t) => t.id));
    const filtered = raw.filter((p) => validIds.has(p.trendId)).slice(0, 3);
    picks =
      filtered.length >= 1
        ? filtered
        : buildFallbackPicks(influencer, pool, language);
  } catch (error) {
    console.warn("[weekly-formats] LLM failed, using fallback:", error);
    picks = buildFallbackPicks(influencer, pool, language);
  }

  return {
    weekStart,
    weekEnd,
    picks: toWeeklyPicks(picks, pool),
  };
}

export type TrendPlanAnchor = WeeklyFormatPick & {
  weekIndex: number;
  weekStart: string;
  date: string;
  dayIndex: number;
  title: string;
};

function dayIndexFromPlanStart(planStart: Date, slotDate: Date): number {
  return differenceInCalendarDays(startOfDay(slotDate), startOfDay(planStart));
}

function unusedPool(
  pool: TrendAnalysisInput[],
  usedIds: Set<string>
): TrendAnalysisInput[] {
  return [...pool]
    .filter((t) => !usedIds.has(t.id))
    .sort((a, b) => (b.growthScore ?? 0) - (a.growthScore ?? 0));
}

/**
 * Multi-week trend anchors for a 7–30 day editorial plan.
 * Week 0 uses the weekly LLM agent; later weeks diversify remaining scrapes
 * (no extra LLM) on Mon/Wed/Fri slots.
 */
export async function proposeTrendAnchorsForPlanRange(
  influencer: Pick<
    Influencer,
    "id" | "name" | "niche" | "personality" | "bio" | "brief" | "isNsfw"
  >,
  trends: TrendAnalysisInput[],
  opts: {
    language?: "fr" | "en";
    planStart: Date;
    days: number;
    maxWeeks?: number;
  }
): Promise<TrendPlanAnchor[]> {
  const language = opts.language ?? "fr";
  const pool = trends.slice(0, 24);
  if (pool.length === 0 || opts.days < 1) return [];

  const weekCount = Math.min(
    opts.maxWeeks ?? 5,
    Math.max(1, Math.ceil(opts.days / 7))
  );
  const planMonday = startOfWeekMonday(opts.planStart);
  const usedIds = new Set<string>();
  const anchors: TrendPlanAnchor[] = [];
  const titleById = new Map(pool.map((t) => [t.id, t.title]));

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex++) {
    const weekStartDate = addUtcDays(planMonday, weekIndex * 7);
    const weekStart = toIsoDateUtc(weekStartDate);
    const remaining = unusedPool(pool, usedIds);

    let weekPicks: WeeklyFormatPick[];
    if (weekIndex === 0) {
      const week = await proposeWeeklyFormatsForInfluencer(
        influencer,
        remaining.length > 0 ? remaining : pool,
        { language, weekStart }
      );
      weekPicks = week.picks;
    } else if (remaining.length === 0) {
      break;
    } else {
      weekPicks = toWeeklyPicks(
        buildFallbackPicks(influencer, remaining, language),
        remaining
      );
    }

    for (const pick of weekPicks) {
      if (usedIds.has(pick.trendId)) continue;
      const slotDate = weeklySlotDate(weekStart, pick.dayHint as WeeklyDayHint);
      const dayIndex = dayIndexFromPlanStart(opts.planStart, slotDate);
      if (dayIndex < 0 || dayIndex >= opts.days) continue;
      usedIds.add(pick.trendId);
      anchors.push({
        ...pick,
        weekIndex,
        weekStart,
        date: toIsoDateUtc(slotDate),
        dayIndex,
        title: titleById.get(pick.trendId)?.slice(0, 80) ?? pick.trendId,
      });
    }
  }

  return anchors;
}
