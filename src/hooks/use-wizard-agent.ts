"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  type AgentMessage,
  type AgentTurnOutput,
  type WizardStep1SuggestionsOutput,
  toAgentChatHistory,
} from "@/lib/agent-core";
import type { WizardStep2LookResult } from "@/lib/prompts/wizard-prompts";
import {
  type WizardData,
  useInfluencerWizard,
} from "@/hooks/use-influencer-wizard";
import { trpc } from "@/lib/trpc";

export type WizardAgentStep = 1 | 2 | 4;

export type WizardContextStep2 = {
  profile: WizardLookProfile & { gender: WizardData["gender"] };
  appearance: {
    ethnicity?: string;
    hairColor?: string;
    hairLength?: string;
    hairTexture?: string;
    bodyType?: string;
    fashionStyles?: string[];
    skinTone?: string;
    height?: string;
    bustLevel?: number;
    hipsLevel?: number;
    shouldersLevel?: number;
  };
};

export type WizardContextStep1 = {
  filledFields: {
    name?: string;
    niche?: string;
    bio?: string;
  };
};

export type WizardContextStep4 = {
  profile: {
    name: string;
    niche: string;
    personality: string;
  };
  appearance: {
    ethnicity?: string;
    bodyType?: string;
    fashionStyles?: string[];
  };
  currentBio: string;
};

/** Minimal profile for `agent.wizardSuggestLook` — step 2 has no chatTurn context. */
export type WizardLookProfile = {
  name: string;
  niche: string;
  personality: string;
  age: number;
};

export function getWizardLookProfile(wizardData: WizardData): WizardLookProfile {
  return {
    name: wizardData.name.trim() || "Influenceuse",
    niche: wizardData.niche.trim() || "LIFESTYLE",
    personality:
      wizardData.personality.trim() || "Confiante et authentique",
    age: wizardData.age || 24,
  };
}

export function getWizardContext(
  step: WizardAgentStep,
  wizardData: WizardData
): WizardContextStep1 | WizardContextStep2 | WizardContextStep4 {
  if (step === 2) {
    return {
      profile: {
        ...getWizardLookProfile(wizardData),
        gender: wizardData.gender,
      },
      appearance: {
        ethnicity: wizardData.ethnicity.trim() || undefined,
        hairColor: wizardData.hairColor.trim() || undefined,
        hairLength: wizardData.hairLength.trim() || undefined,
        hairTexture: wizardData.hairTexture.trim() || undefined,
        bodyType: wizardData.bodyType.trim() || undefined,
        fashionStyles:
          wizardData.fashionStyles.length > 0
            ? wizardData.fashionStyles
            : undefined,
        skinTone: wizardData.skinTone.trim() || undefined,
        height: wizardData.height.trim() || undefined,
        bustLevel: wizardData.bustLevel,
        hipsLevel: wizardData.hipsLevel,
        shouldersLevel: wizardData.shouldersLevel,
      },
    };
  }
  if (step === 4) {
    return {
      profile: {
        name: wizardData.name.trim(),
        niche: wizardData.niche.trim(),
        personality: wizardData.personality.trim(),
      },
      appearance: {
        ethnicity: wizardData.ethnicity.trim() || undefined,
        bodyType: wizardData.bodyType.trim() || undefined,
        fashionStyles:
          wizardData.fashionStyles.length > 0
            ? wizardData.fashionStyles
            : undefined,
      },
      currentBio: wizardData.bio.trim(),
    };
  }

  return {
    filledFields: {
      name: wizardData.name.trim() || undefined,
      niche: wizardData.niche.trim() || undefined,
      bio: wizardData.bio.trim() || undefined,
    },
  };
}

type SetValueFn = (
  field: keyof Pick<
    WizardData,
    "name" | "gender" | "bio" | "personality" | "niche" | "age"
  >,
  value: unknown,
  options?: { shouldValidate?: boolean }
) => void;

export function applyStep1Suggestions(
  suggestions: WizardStep1SuggestionsOutput | undefined,
  updateData: (partial: Partial<WizardData>) => void,
  setValue?: SetValueFn
): boolean {
  if (!suggestions) return false;

  const patch: Partial<WizardData> = {};
  if (suggestions.name?.trim()) patch.name = suggestions.name.trim();
  if (suggestions.gender) patch.gender = suggestions.gender;
  if (suggestions.niche) patch.niche = suggestions.niche;
  if (suggestions.bio?.trim()) patch.bio = suggestions.bio.trim();
  if (suggestions.personality?.trim()) {
    patch.personality = suggestions.personality.trim();
  }
  if (typeof suggestions.age === "number") patch.age = suggestions.age;
  if (suggestions.brief?.trim()) patch.brief = suggestions.brief.trim();

  if (Object.keys(patch).length === 0) return false;

  updateData(patch);

  if (setValue) {
    if (patch.name !== undefined) {
      setValue("name", patch.name, { shouldValidate: true });
    }
    if (patch.gender !== undefined) {
      setValue("gender", patch.gender, { shouldValidate: true });
    }
    if (patch.niche !== undefined) {
      setValue("niche", patch.niche, { shouldValidate: true });
    }
    if (patch.bio !== undefined) {
      setValue("bio", patch.bio, { shouldValidate: true });
    }
    if (patch.personality !== undefined) {
      setValue("personality", patch.personality, { shouldValidate: true });
    }
    if (patch.age !== undefined) {
      setValue("age", patch.age, { shouldValidate: true });
    }
  }

  return true;
}

export function applyStep2Suggestions(
  suggestions: WizardStep2LookResult | undefined,
  updateData: (partial: Partial<WizardData>) => void
): boolean {
  if (!suggestions) return false;

  const patch: Partial<WizardData> = {};
  if (suggestions.ethnicity?.trim()) patch.ethnicity = suggestions.ethnicity.trim();
  if (suggestions.hairColor?.trim()) patch.hairColor = suggestions.hairColor.trim();
  if (suggestions.hairLength?.trim()) {
    patch.hairLength = suggestions.hairLength.trim();
  }
  if (suggestions.hairTexture?.trim()) {
    patch.hairTexture = suggestions.hairTexture.trim();
  }
  if (suggestions.bodyType?.trim()) patch.bodyType = suggestions.bodyType.trim();
  if (typeof suggestions.skinTone === "string" && suggestions.skinTone.trim()) {
    patch.skinTone = suggestions.skinTone.trim();
  }
  if (typeof suggestions.height === "string" && suggestions.height.trim()) {
    patch.height = suggestions.height.trim();
  }
  if (typeof suggestions.bustLevel === "number") patch.bustLevel = suggestions.bustLevel;
  if (typeof suggestions.hipsLevel === "number") patch.hipsLevel = suggestions.hipsLevel;
  if (typeof suggestions.shouldersLevel === "number") {
    patch.shouldersLevel = suggestions.shouldersLevel;
  }
  if (suggestions.fashionStyles?.length) {
    patch.fashionStyles = suggestions.fashionStyles.filter(Boolean);
  }

  if (Object.keys(patch).length === 0) return false;
  updateData(patch);
  return true;
}

export function applyBio(
  bio: string,
  updateData: (partial: Partial<WizardData>) => void,
  setValue?: SetValueFn
): void {
  const trimmed = bio.trim();
  if (!trimmed) return;
  updateData({ bio: trimmed });
  setValue?.("bio", trimmed, { shouldValidate: true });
}

export type UseWizardAgentOptions = {
  step: WizardAgentStep;
  setValue?: SetValueFn;
};

export function useWizardAgent({ step, setValue }: UseWizardAgentOptions) {
  const locale = useLocale();
  const t = useTranslations("wizard");
  const language = locale === "en" ? "en" : "fr";
  const { data, updateData } = useInfluencerWizard();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [lastTurn, setLastTurn] = useState<AgentTurnOutput | null>(null);
  const [bioOptions, setBioOptions] = useState<string[]>([]);

  const chatMutation = trpc.agent.chatTurn.useMutation();
  const lookMutation = trpc.agent.wizardSuggestLook.useMutation();

  const context = useMemo(
    () => ({
      step,
      locale: language,
      ...getWizardContext(step, data),
    }),
    [step, language, data]
  );

  const quickReplies = useMemo(
    () => lastTurn?.quickReplies ?? [],
    [lastTurn?.quickReplies]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatMutation.isPending) return;

      const userMessage: AgentMessage = {
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);

      try {
        console.log("[wizard-agent] context sent:", JSON.stringify(context));

        const result = await chatMutation.mutateAsync({
          domain: "wizard",
          messages: toAgentChatHistory(nextMessages),
          context,
        });

        console.log("[wizard-agent] raw result:", JSON.stringify(result));

        setLastTurn(result);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.message,
            timestamp: Date.now(),
            choices: result.choices,
          },
        ]);

        if (step === 1) {
          applyStep1Suggestions(
            result.wizardStep1Suggestions,
            updateData,
            setValue
          );
        }
        if (step === 2 && result.wizardStep2Look) {
          applyStep2Suggestions(result.wizardStep2Look, updateData);
        }
        if (step === 4 && result.bioOptions?.length) {
          setBioOptions(result.bioOptions);
        }
      } catch (err) {
        const errorMessage: AgentMessage = {
          role: "assistant",
          content: t("agentError"),
          timestamp: Date.now(),
        };
        setMessages([...nextMessages, errorMessage]);
        console.error("[wizard-agent] sendMessage failed:", err);
      }
    },
    [chatMutation, context, messages, setValue, step, t, updateData]
  );

  const suggestLook = useCallback(async () => {
    const profile = {
      ...getWizardLookProfile(data),
      gender: data.gender,
    };

    try {
      const step2Context = getWizardContext(2, data);
      const result = await lookMutation.mutateAsync({
        profile,
        appearance:
          "appearance" in step2Context ? step2Context.appearance : undefined,
        locale: language,
      });
      applyStep2Suggestions(result, updateData);
      return result;
    } catch {
      return null;
    }
  }, [data, language, lookMutation, updateData]);

  const pickBioOption = useCallback(
    (bio: string) => {
      applyBio(bio, updateData, setValue);
    },
    [setValue, updateData]
  );

  const clearSession = useCallback(() => {
    setMessages([]);
    setLastTurn(null);
    setBioOptions([]);
  }, []);

  return {
    messages,
    sendMessage,
    suggestLook,
    pickBioOption,
    applyStep1Suggestions: (suggestions?: WizardStep1SuggestionsOutput) =>
      applyStep1Suggestions(suggestions, updateData, setValue),
    applyStep2Suggestions: (suggestions?: WizardStep2LookResult) =>
      applyStep2Suggestions(suggestions, updateData),
    applyBio: (bio: string) => applyBio(bio, updateData, setValue),
    isLoading: chatMutation.isPending,
    isSuggestingLook: lookMutation.isPending,
    quickReplies,
    lastTurn,
    bioOptions,
    clearSession,
  };
}
