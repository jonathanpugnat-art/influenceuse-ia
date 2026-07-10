import {
  buildCalendarAgentUserPrompt,
  CALENDAR_AGENT_SYSTEM_PROMPT,
  type CalendarAgentTurnResult,
  validateCalendarAgentTurn,
} from "@/lib/prompts/calendar-agent-prompts";
import {
  buildCalendarExecutionParams,
  buildFallbackCalendarTurn,
  calendarAgentTurnToOutput,
  localizeCalendarAgentTurn,
  resolveCalendarAgentLocale,
} from "@/lib/calendar-agent";
import { callAgentJsonLLM } from "@/server/services/ai-text.service";
import { inferAdultLaneFromSignals } from "@/lib/text-provider-config";
import { CALENDAR_AGENT_MODEL } from "@/lib/prompts/calendar-agent-prompts";
import { type AgentTurnInput, type AgentTurnOutput } from "@/lib/agent-core";
import { db } from "@/server/db";
import { endOfMonth, format, startOfMonth } from "date-fns";

async function callCalendarAgentJson(
  userPrompt: string,
  contentLane: "sfw" | "adult"
): Promise<CalendarAgentTurnResult> {
  return callAgentJsonLLM({
    contentLane,
    systemPrompt: CALENDAR_AGENT_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 700,
    temperature: 0.35,
    anthropicModel: CALENDAR_AGENT_MODEL,
    validate: validateCalendarAgentTurn,
    repairInstruction:
      "Return only valid JSON matching the requested schema. No markdown.",
  });
}

function readContextString(
  context: AgentTurnInput["context"],
  key: string
): string | undefined {
  const value = context?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function runCalendarAgentTurn(
  input: AgentTurnInput,
  userId: string
): Promise<AgentTurnOutput> {
  const uiLocale =
    readContextString(input.context, "locale") === "en" ? "en" : "fr";
  const conversationLocale = resolveCalendarAgentLocale(input, uiLocale);
  const influencerId = readContextString(input.context, "influencerId");

  const today = new Date();
  const todayIso = format(today, "yyyy-MM-dd");
  const monthStartIso = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEndIso = format(endOfMonth(today), "yyyy-MM-dd");

  let influencerName: string | undefined;
  let influencerNiche: string | undefined;
  let influencerBrief: string | undefined;
  let contentLane: "sfw" | "adult" = "sfw";

  if (influencerId) {
    const influencer = await db.influencer.findFirst({
      where: { id: influencerId, userId },
      select: { name: true, niche: true, brief: true, isNsfw: true },
    });
    if (influencer) {
      influencerName = influencer.name;
      influencerNiche = influencer.niche;
      influencerBrief = influencer.brief ?? undefined;
      contentLane = inferAdultLaneFromSignals({
        isNsfw: influencer.isNsfw,
        niche: influencer.niche,
        brief: influencer.brief ?? undefined,
      });
    }
  }

  if (!influencerId) {
    return {
      message:
        conversationLocale === "fr"
          ? "Choisis d'abord une influenceuse pour générer le plan."
          : "Select an influencer first to generate the plan.",
      quickReplies: [],
      readyToExecute: false,
    };
  }

  const conversation = input.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const userPrompt = buildCalendarAgentUserPrompt({
    todayIso,
    monthStartIso,
    monthEndIso,
    locale: conversationLocale,
    influencerId,
    influencerName,
    influencerNiche,
    influencerBrief,
    conversation,
  });

  let parsed: CalendarAgentTurnResult;
  try {
    parsed = localizeCalendarAgentTurn(
      await callCalendarAgentJson(userPrompt, contentLane),
      conversationLocale
    );
  } catch (error) {
    console.warn("[calendar-agent] LLM failed, using fallback:", error);
    parsed = buildFallbackCalendarTurn(input, uiLocale);
  }

  if (!parsed.readyToExecute) {
    return calendarAgentTurnToOutput(parsed, null, conversationLocale);
  }

  const executionParams = buildCalendarExecutionParams({
    params: parsed.params,
    influencerId,
    locale: conversationLocale,
  });

  if (!executionParams) {
    return calendarAgentTurnToOutput(
      localizeCalendarAgentTurn(
        {
          ...parsed,
          readyToExecute: false,
          missingFields: parsed.missingFields.length
            ? parsed.missingFields
            : ["startDate"],
          message: "",
        },
        conversationLocale
      ),
      null,
      conversationLocale
    );
  }

  return calendarAgentTurnToOutput(parsed, executionParams, conversationLocale);
}
