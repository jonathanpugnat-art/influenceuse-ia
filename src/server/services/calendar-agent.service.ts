import Anthropic from "@anthropic-ai/sdk";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { type AgentTurnInput, type AgentTurnOutput } from "@/lib/agent-core";
import {
  buildCalendarAgentUserPrompt,
  CALENDAR_AGENT_MODEL,
  CALENDAR_AGENT_SYSTEM_PROMPT,
  type CalendarAgentTurnResult,
  validateCalendarAgentTurn,
} from "@/lib/prompts/calendar-agent-prompts";
import {
  buildCalendarExecutionParams,
  buildFallbackCalendarTurn,
  calendarAgentTurnToOutput,
} from "@/lib/calendar-agent";
import { db } from "@/server/db";

function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function callCalendarHaikuJson(
  userPrompt: string
): Promise<CalendarAgentTurnResult> {
  const client = getAnthropic();
  const tryParse = (text: string): CalendarAgentTurnResult | null => {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    try {
      return validateCalendarAgentTurn(JSON.parse(cleaned));
    } catch {
      return null;
    }
  };

  const baseMessages = [{ role: "user" as const, content: userPrompt }];

  const first = await client.messages.create({
    model: CALENDAR_AGENT_MODEL,
    max_tokens: 700,
    temperature: 0.35,
    system: CALENDAR_AGENT_SYSTEM_PROMPT,
    messages: baseMessages,
  });

  const firstText = first.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const parsed = tryParse(firstText);
  if (parsed) return parsed;

  const repair = await client.messages.create({
    model: CALENDAR_AGENT_MODEL,
    max_tokens: 700,
    temperature: 0.2,
    system: CALENDAR_AGENT_SYSTEM_PROMPT,
    messages: [
      ...baseMessages,
      { role: "assistant", content: firstText },
      {
        role: "user",
        content:
          "Return only valid JSON matching the requested schema. No markdown.",
      },
    ],
  });

  const repairText = repair.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const repaired = tryParse(repairText);
  if (repaired) return repaired;

  throw new Error("Calendar agent: invalid JSON from Haiku.");
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
  const locale =
    readContextString(input.context, "locale") === "en" ? "en" : "fr";
  const influencerId = readContextString(input.context, "influencerId");

  const today = new Date();
  const todayIso = format(today, "yyyy-MM-dd");
  const monthStartIso = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEndIso = format(endOfMonth(today), "yyyy-MM-dd");

  let influencerName: string | undefined;
  let influencerNiche: string | undefined;

  if (influencerId) {
    const influencer = await db.influencer.findFirst({
      where: { id: influencerId, userId },
      select: { name: true, niche: true },
    });
    if (influencer) {
      influencerName = influencer.name;
      influencerNiche = influencer.niche;
    }
  }

  if (!influencerId) {
    return {
      message:
        locale === "fr"
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
    locale,
    influencerId,
    influencerName,
    influencerNiche,
    conversation,
  });

  let parsed: CalendarAgentTurnResult;
  try {
    parsed = await callCalendarHaikuJson(userPrompt);
  } catch (error) {
    console.warn("[calendar-agent] Haiku failed, using fallback:", error);
    parsed = buildFallbackCalendarTurn(input, locale);
  }

  if (!parsed.readyToExecute) {
    return calendarAgentTurnToOutput(parsed, null, locale);
  }

  const executionParams = buildCalendarExecutionParams({
    params: parsed.params,
    influencerId,
    locale: parsed.params.language ?? locale,
  });

  if (!executionParams) {
    return calendarAgentTurnToOutput(
      {
        ...parsed,
        readyToExecute: false,
        missingFields: parsed.missingFields.length
          ? parsed.missingFields
          : ["startDate"],
        message:
          locale === "fr"
            ? "Sur quelle période veux-tu planifier (ex. ce mois) ?"
            : "Which period should we plan for (e.g. this month)?",
      },
      null,
      locale
    );
  }

  return calendarAgentTurnToOutput(parsed, executionParams, locale);
}
