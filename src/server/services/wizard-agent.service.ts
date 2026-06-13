import { type AgentTurnInput, type AgentTurnOutput } from "@/lib/agent-core";
import {
  buildWizardStep1UserPrompt,
  buildWizardStep4UserPrompt,
  buildWizardStep2LookUserPrompt,
  buildWizardStep2UserPrompt,
  validateWizardStep1Turn,
  validateWizardStep4Turn,
  validateWizardStep2Look,
  validateWizardStep2Turn,
  WIZARD_STEP1_REPAIR_INSTRUCTION,
  WIZARD_STEP2_REPAIR_INSTRUCTION,
  WIZARD_AGENT_SYSTEM_PROMPT,
  type WizardStep2LookResult,
} from "@/lib/prompts/wizard-prompts";
import { callWizardJsonLLM } from "@/server/services/ai-text.service";

function readContextNumber(
  context: AgentTurnInput["context"],
  key: string
): number | undefined {
  const value = context?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readContextString(
  context: AgentTurnInput["context"],
  key: string
): string | undefined {
  const value = context?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readContextRecord(
  context: AgentTurnInput["context"],
  key: string
): Record<string, unknown> | undefined {
  const value = context?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function formatConversation(messages: AgentTurnInput["messages"]): string {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
}

function fallbackStep1Turn(locale: "fr" | "en"): AgentTurnOutput {
  return locale === "fr"
    ? {
        message: "Décris ton influenceuse idéale.",
        quickReplies: ["Femme fitness 25 ans", "Homme mode streetwear", "Lifestyle cozy"],
      }
    : {
        message: "Describe your ideal influencer.",
        quickReplies: ["Female fitness 25", "Male streetwear", "Cozy lifestyle"],
      };
}

function fallbackStep4Turn(locale: "fr" | "en"): AgentTurnOutput {
  return locale === "fr"
    ? {
        message: "Veux-tu une bio plus punchy ?",
        quickReplies: ["Plus court", "Plus premium", "Plus fun"],
      }
    : {
        message: "Want a punchier bio?",
        quickReplies: ["Shorter", "More premium", "More fun"],
      };
}

function fallbackStep2Look(): WizardStep2LookResult {
  return {
    ethnicity: "Caucasienne",
    hairColor: "Brun",
    hairLength: "Mi-long",
    hairTexture: "Ondulé",
    bodyType: "Athlétique",
    fashionStyles: ["Casual"],
  };
}

function fallbackStep2Turn(locale: "fr" | "en"): AgentTurnOutput {
  return locale === "fr"
    ? {
        message: "Décris le look souhaité.",
        quickReplies: ["Plus curvy", "Peau mate", "Cheveux longs"],
      }
    : {
        message: "Describe the look you want.",
        quickReplies: ["More curvy", "Tan skin", "Long hair"],
      };
}

export async function runWizardAgentTurn(
  input: AgentTurnInput
): Promise<AgentTurnOutput> {
  const step = readContextNumber(input.context, "step") ?? 1;
  const locale = readContextString(input.context, "locale") === "en" ? "en" : "fr";
  const conversation = formatConversation(input.messages);

  if (step === 4) {
    const profile = readContextRecord(input.context, "profile");
    const appearance = readContextRecord(input.context, "appearance");
    const currentBio = readContextString(input.context, "currentBio") ?? "";

    const userPrompt = buildWizardStep4UserPrompt({
      locale,
      profile: {
        name: typeof profile?.name === "string" ? profile.name : "",
        niche: typeof profile?.niche === "string" ? profile.niche : "",
        personality:
          typeof profile?.personality === "string" ? profile.personality : "",
      },
      appearance: {
        ethnicity:
          typeof appearance?.ethnicity === "string"
            ? appearance.ethnicity
            : undefined,
        bodyType:
          typeof appearance?.bodyType === "string"
            ? appearance.bodyType
            : undefined,
        fashionStyles: readStringArray(appearance?.fashionStyles),
      },
      currentBio,
      conversation,
    });

    try {
      const result = await callWizardJsonLLM({
        systemPrompt: WIZARD_AGENT_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 450,
        temperature: 0.4,
        cacheSystemPrompt: true,
        validate: validateWizardStep4Turn,
      });

      return {
        message: result.message,
        quickReplies: result.quickReplies,
        bioOptions: result.bioOptions,
      };
    } catch (error) {
      console.warn("[wizard-agent] step 4 failed:", error);
      return fallbackStep4Turn(locale);
    }
  }

  if (step === 2) {
    const profile = readContextRecord(input.context, "profile");
    const appearance = readContextRecord(input.context, "appearance");

    const userPrompt = buildWizardStep2UserPrompt({
      locale,
      profile: {
        name: typeof profile?.name === "string" ? profile.name : "",
        niche: typeof profile?.niche === "string" ? profile.niche : "",
        personality:
          typeof profile?.personality === "string" ? profile.personality : "",
        age: typeof profile?.age === "number" ? profile.age : 24,
        gender: typeof profile?.gender === "string" ? profile.gender : "female",
      },
      appearance: appearance ?? {},
      conversation,
    });

    try {
      const result = await callWizardJsonLLM({
        systemPrompt: WIZARD_AGENT_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 350,
        temperature: 0.45,
        cacheSystemPrompt: true,
        validate: validateWizardStep2Turn,
        repairInstruction: WIZARD_STEP2_REPAIR_INSTRUCTION,
      });

      return {
        message: result.message,
        quickReplies: result.quickReplies,
        wizardStep2Look: result.look,
      };
    } catch (error) {
      console.warn("[wizard-agent] step 2 failed:", error);
      return fallbackStep2Turn(locale);
    }
  }

  const filledFields = readContextRecord(input.context, "filledFields") ?? {};

  const userPrompt = buildWizardStep1UserPrompt({
    locale,
    filledFields: {
      name: typeof filledFields.name === "string" ? filledFields.name : undefined,
      niche: typeof filledFields.niche === "string" ? filledFields.niche : undefined,
      bio: typeof filledFields.bio === "string" ? filledFields.bio : undefined,
      personality:
        typeof filledFields.personality === "string"
          ? filledFields.personality
          : undefined,
    },
    conversation,
  });

  try {
    const result = await callWizardJsonLLM({
      systemPrompt: WIZARD_AGENT_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 800,
      temperature: 0.45,
      cacheSystemPrompt: true,
      validate: validateWizardStep1Turn,
      repairInstruction: WIZARD_STEP1_REPAIR_INSTRUCTION,
    });

    const wizardStep1Suggestions = result.suggestions
      ? {
          ...result.suggestions,
          ...(result.brief?.trim() ? { brief: result.brief.trim() } : {}),
        }
      : result.brief?.trim()
        ? { brief: result.brief.trim() }
        : undefined;

    return {
      message: result.message,
      quickReplies: result.quickReplies,
      choices: result.choices,
      wizardStep1Suggestions,
    };
  } catch (error) {
    console.warn("[wizard-agent] step 1 failed:", error);
    return fallbackStep1Turn(locale);
  }
}

export async function suggestWizardLook(input: {
  locale: "fr" | "en";
  profile: {
    name: string;
    niche: string;
    personality: string;
    age: number;
    gender?: string;
  };
  appearance?: Record<string, unknown>;
}): Promise<WizardStep2LookResult> {
  const userPrompt = buildWizardStep2LookUserPrompt({
    locale: input.locale,
    profile: input.profile,
    appearance: input.appearance,
  });

  try {
    return await callWizardJsonLLM({
      systemPrompt: WIZARD_AGENT_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 200,
      temperature: 0.4,
      cacheSystemPrompt: false,
      validate: validateWizardStep2Look,
    });
  } catch (error) {
    console.warn("[wizard-agent] suggestLook failed:", error);
    return fallbackStep2Look();
  }
}
