import { type AgentTurnInput, type AgentTurnOutput } from "@/lib/agent-core";
import {
  buildWizardStep1UserPrompt,
  buildWizardStep1PersonaVariantsUserPrompt,
  buildWizardStep4UserPrompt,
  buildWizardStep2LookUserPrompt,
  buildWizardStep2UserPrompt,
  validateWizardStep1Turn,
  validateWizardStep4Turn,
  validateWizardStep2Look,
  validateWizardStep2Turn,
  WIZARD_STEP1_REPAIR_INSTRUCTION,
  WIZARD_STEP2_REPAIR_INSTRUCTION,
  WIZARD_STEP4_REPAIR_INSTRUCTION,
  WIZARD_AGENT_SYSTEM_PROMPT,
  type WizardStep2LookResult,
  type WizardPersonaVariant,
} from "@/lib/prompts/wizard-prompts";
import { callWizardJsonLLM } from "@/server/services/ai-text.service";
import type { AuraContentLane } from "@/lib/content-safety/aura-content-policy";
import { inferAdultLaneFromSignals } from "@/lib/text-provider-config";
import { coerceNicheCategory, parseNicheProfile } from "@/lib/niche-profile";

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
        message: "Parle-moi de son but — je t'aide à construire sa vision.",
        quickReplies: [
          "Influenceuse OF premium",
          "Coach fitness authentique",
          "Propose 3 bios différentes",
        ],
      }
    : {
        message: "Tell me her purpose — I'll help shape her vision.",
        quickReplies: [
          "Premium OF influencer",
          "Authentic fitness coach",
          "Suggest 3 different bios",
        ],
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

function resolveWizardContentLane(input: AgentTurnInput): AuraContentLane {
  const ctx = input.context ?? {};
  return inferAdultLaneFromSignals({
    isNsfw: ctx.isNsfw === true,
    niche:
      typeof ctx.niche === "string"
        ? ctx.niche
        : readContextRecord(ctx, "filledFields")?.niche?.toString(),
    brief: readContextString(ctx, "brief"),
  });
}

export async function runWizardAgentTurn(
  input: AgentTurnInput
): Promise<AgentTurnOutput> {
  const step = readContextNumber(input.context, "step") ?? 1;
  const locale = readContextString(input.context, "locale") === "en" ? "en" : "fr";
  const conversation = formatConversation(input.messages);
  const contentLane = resolveWizardContentLane(input);

  if (step === 4) {
    const profile = readContextRecord(input.context, "profile");
    const appearance = readContextRecord(input.context, "appearance");
    const currentBio = readContextString(input.context, "currentBio") ?? "";
    const brief = readContextString(input.context, "brief");

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
      brief,
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
        repairInstruction: WIZARD_STEP4_REPAIR_INSTRUCTION,
        contentLane,
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
    const brief = readContextString(input.context, "brief");

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
      brief,
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
        contentLane,
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
      contentLane,
    });

    const wizardStep1Suggestions = result.suggestions
      ? {
          ...result.suggestions,
          ...(result.brief?.trim() ? { brief: result.brief.trim() } : {}),
        }
      : result.brief?.trim()
        ? { brief: result.brief.trim() }
        : undefined;

    const fallbackNiche =
      coerceNicheCategory(filledFields.niche) ??
      coerceNicheCategory(result.suggestions?.niche);
    const nicheProfile =
      parseNicheProfile(result.nicheProfile, fallbackNiche) ?? undefined;

    return {
      message: result.message,
      quickReplies: result.quickReplies,
      choices: result.choices,
      wizardStep1Suggestions,
      personaVariants: result.personaVariants,
      nicheProfile,
    };
  } catch (error) {
    console.warn("[wizard-agent] step 1 failed:", error);
    return fallbackStep1Turn(locale);
  }
}

export async function suggestWizardPersonas(input: {
  locale: "fr" | "en";
  niche: string;
  gender: "female" | "male" | "nonbinary";
  name?: string;
  brief?: string;
  isNsfw?: boolean;
}): Promise<WizardPersonaVariant[]> {
  const contentLane = inferAdultLaneFromSignals({
    isNsfw: input.isNsfw,
    niche: input.niche,
    brief: input.brief,
  });
  const userPrompt = buildWizardStep1PersonaVariantsUserPrompt({
    locale: input.locale,
    profile: {
      name: input.name,
      niche: input.niche,
      gender: input.gender,
      brief: input.brief,
    },
  });

  try {
    const result = await callWizardJsonLLM({
      systemPrompt: WIZARD_AGENT_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 900,
      temperature: 0.55,
      cacheSystemPrompt: true,
      validate: validateWizardStep1Turn,
      repairInstruction: WIZARD_STEP1_REPAIR_INSTRUCTION,
      contentLane,
    });
    if (result.personaVariants?.length) {
      return result.personaVariants;
    }
  } catch (error) {
    console.warn("[wizard-agent] suggestPersonas failed:", error);
  }

  return input.locale === "fr"
    ? [
        {
          bio: "Créatrice authentique · partage sans filtre ✨",
          personality:
            "Chaleureuse et directe, elle raconte ses vraies galères autant que ses wins. Son audience se sent comprise, jamais jugée.",
        },
        {
          bio: "Ta dose quotidienne de good vibes 💫",
          personality:
            "Drôle et spontanée, elle transforme le quotidien en contenu léger. Beaucoup d'humour, peu de prise de tête.",
        },
        {
          bio: "Premium only · lifestyle & ambition",
          personality:
            "Ambitieuse et soignée, elle projette une image aspirante. Chaque post respire le luxe accessible et la confiance.",
        },
      ]
    : [
        {
          bio: "Authentic creator · no filter needed ✨",
          personality:
            "Warm and direct, she shares real struggles as much as wins. Her audience feels understood, never judged.",
        },
        {
          bio: "Your daily dose of good vibes 💫",
          personality:
            "Playful and spontaneous, she turns everyday life into light content. Lots of humor, zero pretension.",
        },
        {
          bio: "Premium only · lifestyle & ambition",
          personality:
            "Ambitious and polished, she projects an aspirational image. Every post breathes accessible luxury and confidence.",
        },
      ];
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
  brief?: string;
  isNsfw?: boolean;
}): Promise<WizardStep2LookResult> {
  const contentLane = inferAdultLaneFromSignals({
    isNsfw: input.isNsfw,
    brief: input.brief,
    niche: input.profile.niche,
  });
  const userPrompt = buildWizardStep2LookUserPrompt({
    locale: input.locale,
    profile: input.profile,
    appearance: input.appearance,
    brief: input.brief,
  });

  try {
    return await callWizardJsonLLM({
      systemPrompt: WIZARD_AGENT_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 200,
      temperature: 0.4,
      cacheSystemPrompt: false,
      validate: validateWizardStep2Look,
      contentLane,
    });
  } catch (error) {
    console.warn("[wizard-agent] suggestLook failed:", error);
    return fallbackStep2Look();
  }
}
