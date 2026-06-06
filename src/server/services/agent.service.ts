import {
  type AgentDomain,
  type AgentTurnInput,
  type AgentTurnOutput,
} from "@/lib/agent-core";
import { runCalendarAgentTurn } from "@/server/services/calendar-agent.service";

const PLACEHOLDER_MESSAGES: Record<
  Exclude<AgentDomain, "calendar">,
  { message: string; quickReplies: string[] }
> = {
  wizard: {
    message:
      "Agent création — bientôt disponible. Décris ton influenceuse idéale pour commencer.",
    quickReplies: [
      "Femme, 25 ans, fitness",
      "Homme, mode streetwear",
      "Non-binaire, lifestyle",
    ],
  },
  trends: {
    message:
      "Agent trends — bientôt disponible. Je t'aiderai à adapter les tendances TikTok et Instagram.",
    quickReplies: [
      "Top trends fitness",
      "Formats qui montent",
      "Idées pour cette semaine",
    ],
  },
  photo: {
    message:
      "Agent photo — utilise le studio photo pour l'instant. Cette route unifiée arrive bientôt.",
    quickReplies: ["Look café aesthetic", "Selfie gym", "Beach vibes"],
  },
};

function buildPlaceholderTurn(
  domain: Exclude<AgentDomain, "calendar">
): AgentTurnOutput {
  const preset = PLACEHOLDER_MESSAGES[domain];
  return {
    message: preset.message,
    quickReplies: preset.quickReplies,
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
    case "trends":
    case "photo":
      return buildPlaceholderTurn(input.domain);
    default: {
      const _exhaustive: never = input.domain;
      return _exhaustive;
    }
  }
}
