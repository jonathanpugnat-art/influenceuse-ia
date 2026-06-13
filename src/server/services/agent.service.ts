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

const PLACEHOLDER_MESSAGES: Record<
  Extract<AgentTurnInput["domain"], "trends">,
  { message: string; quickReplies: string[] }
> = {
  trends: {
    message:
      "Agent trends — bientôt disponible. Je t'aiderai à adapter les tendances TikTok et Instagram.",
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

  const result = await runPhotoStudioAgentTurn(photoInput, influencerBrief);
  return {
    message: result.message,
    readyToExecute: result.showBrief,
    photoAgentResult: result,
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
      return buildPlaceholderTurn(input.domain);
    default: {
      const _exhaustive: never = input.domain;
      return _exhaustive;
    }
  }
}

export { suggestWizardLook };
