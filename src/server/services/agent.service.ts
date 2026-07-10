import {
  type AgentTurnInput,
  type AgentTurnOutput,
} from "@/lib/agent-core";
import { runCalendarAgentTurn } from "@/server/services/calendar-agent.service";
import {
  runWizardAgentTurn,
  suggestWizardLook,
} from "@/server/services/wizard-agent.service";
import { runPhotoStudioAgentTurn } from "@/server/services/photo-studio-agent.service";
import {
  photoAgentTurnInputSchema,
  type PhotoAgentTurnInput,
} from "@/lib/photo-studio-agent";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";
import { analyzeTrendsForInfluencer, mapTrendItemsForAnalysis } from "@/server/services/trends-agent.service";
import { getFeedForInfluencer, getTopTrendsForInfluencer, resolveTrendCreatorTarget } from "@/server/services/trends.service";
import type { Plan } from "@/generated/prisma/client";

const PLACEHOLDER_MESSAGES: Record<
  Extract<AgentTurnInput["domain"], "trends">,
  { message: string; quickReplies: string[] }
> = {
  trends: {
    message:
      "Sélectionne une influenceuse pour analyser les tendances qui lui correspondent.",
    quickReplies: [
      "Top trends fitness",
      "Formats qui montent",
      "Idées pour cette semaine",
    ],
  },
};

function buildPlaceholderTurn(
  domain: Extract<AgentTurnInput["domain"], "trends">
): AgentTurnOutput {
  const preset = PLACEHOLDER_MESSAGES[domain];
  return {
    message: preset.message,
    quickReplies: preset.quickReplies,
    readyToExecute: false,
  };
}

function parsePhotoAgentContext(
  input: AgentTurnInput
): PhotoAgentTurnInput | null {
  const ctx = input.context ?? {};
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  const explicitMessage =
    typeof ctx.userMessage === "string" ? ctx.userMessage : undefined;

  const parsed = photoAgentTurnInputSchema.safeParse({
    locale: ctx.locale === "en" ? "en" : "fr",
    gender:
      ctx.gender === "male" || ctx.gender === "nonbinary" ? ctx.gender : "female",
    userMessage: explicitMessage ?? lastUser?.content,
    selectedLookId:
      typeof ctx.selectedLookId === "string" ? ctx.selectedLookId : undefined,
    selectedOutfit:
      typeof ctx.selectedOutfit === "string" ? ctx.selectedOutfit : undefined,
    assistantTurnCount:
      typeof ctx.assistantTurnCount === "number" ? ctx.assistantTurnCount : 0,
    contentMode: ctx.contentMode === "NSFW" ? "NSFW" : "SFW",
    selectedTrendId:
      typeof ctx.selectedTrendId === "string" ? ctx.selectedTrendId : undefined,
    history: input.messages.slice(0, -1).slice(-12),
  });

  return parsed.success ? parsed.data : null;
}

function readContextString(
  context: AgentTurnInput["context"],
  key: string
): string | undefined {
  const value = context?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function fetchInfluencerBrief(
  influencerId: string,
  userId: string
): Promise<string | undefined> {
  const influencer = await db.influencer.findFirst({
    where: { id: influencerId, userId },
    select: { brief: true },
  });
  return influencer?.brief?.trim() || undefined;
}

async function runPhotoAgentTurn(
  input: AgentTurnInput,
  userId: string
): Promise<AgentTurnOutput> {
  const photoInput = parsePhotoAgentContext(input);
  if (!photoInput) {
    return {
      message:
        "Sélectionne une influenceuse et décris le type de photo souhaité (look, tenue, ambiance).",
      quickReplies: ["Look café aesthetic", "Selfie gym", "Boudoir lingerie"],
      readyToExecute: false,
    };
  }

  const influencerId = readContextString(input.context, "influencerId");
  const influencerBrief = influencerId
    ? await fetchInfluencerBrief(influencerId, userId)
    : undefined;

  let topTrends: Awaited<ReturnType<typeof getTopTrendsForInfluencer>> = [];
  if (influencerId) {
    const influencer = await db.influencer.findFirst({
      where: { id: influencerId, userId },
      select: { id: true, niche: true, isNsfw: true },
    });
    if (influencer) {
      topTrends = await getTopTrendsForInfluencer(influencer, { limit: 3 });
    }
  }

  const result = await runPhotoStudioAgentTurn(photoInput, {
    influencerBrief,
    topTrends,
  });
  return {
    message: result.message,
    readyToExecute: result.showBrief,
    photoAgentResult: result,
  };
}

async function runTrendsAgentTurn(
  input: AgentTurnInput,
  userId: string
): Promise<AgentTurnOutput> {
  const influencerId = readContextString(input.context, "influencerId");
  const locale = readContextString(input.context, "locale") === "en" ? "en" : "fr";

  if (!influencerId) {
    return buildPlaceholderTurn("trends");
  }

  const user = await getDbUser(userId);
  const influencer = await db.influencer.findFirst({
    where: { id: influencerId, userId: user.id },
  });

  if (!influencer) {
    return buildPlaceholderTurn("trends");
  }

  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  const searchQuery = lastUser?.content.trim() || undefined;

  const { items } = await getFeedForInfluencer(influencer, {
    limit: 10,
    userPlan: user.plan as Plan,
    userLocale: user.locale,
  });

  if (items.length === 0) {
    return {
      message:
        locale === "fr"
          ? "Aucune tendance disponible pour le moment — reviens plus tard ou rafraîchis le feed."
          : "No trends available right now — check back later or refresh the feed.",
      quickReplies: locale === "fr" ? ["Rafraîchir"] : ["Refresh"],
      readyToExecute: false,
    };
  }

  const picks = await analyzeTrendsForInfluencer(
    influencer,
    mapTrendItemsForAnalysis(items),
    {
      language: locale,
      searchQuery,
    }
  );

  const lines = picks.map(
    (pick, i) =>
      `${i + 1}. **${items.find((t) => t.id === pick.trendId)?.title ?? pick.trendId}** (${pick.confidence})\n${pick.whyItWorks}\n→ ${pick.suggestedAngle}`
  );

  const trendStudioActions = picks.map((pick) => {
    const trend = items.find((t) => t.id === pick.trendId);
    const title = trend?.title ?? pick.trendId;
    const short = title.replace(/\s+/g, " ").trim().slice(0, 48);
    const studio = trend ? resolveTrendCreatorTarget(trend) : "photo";
    return {
      trendId: pick.trendId,
      studio,
      label:
        locale === "fr"
          ? `${studio === "reel" ? "Ouvrir reel" : "Ouvrir photo"} · ${short}`
          : `${studio === "reel" ? "Open reel" : "Open photo"} · ${short}`,
    };
  });

  return {
    message:
      locale === "fr"
        ? `Voici ${picks.length} tendances adaptées à ${influencer.name} :\n\n${lines.join("\n\n")}`
        : `Here are ${picks.length} trends tailored for ${influencer.name}:\n\n${lines.join("\n\n")}`,
    choices: trendStudioActions.map((a) => a.label),
    trendStudioActions,
    quickReplies:
      locale === "fr"
        ? ["Autres angles", "Formats Reels", "Tendances OF"]
        : ["Other angles", "Reel formats", "Rising trends"],
    readyToExecute: false,
  };
}

export async function runAgentTurn(
  input: AgentTurnInput,
  userId: string
): Promise<AgentTurnOutput> {
  switch (input.domain) {
    case "calendar":
      return runCalendarAgentTurn(input, userId);
    case "wizard":
      return runWizardAgentTurn(input);
    case "photo":
      return runPhotoAgentTurn(input, userId);
    case "trends":
      return runTrendsAgentTurn(input, userId);
    default: {
      const _exhaustive: never = input.domain;
      return _exhaustive;
    }
  }
}

export { suggestWizardLook, suggestWizardPersonas } from "@/server/services/wizard-agent.service";
