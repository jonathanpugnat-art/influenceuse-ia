"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  type AgentMessage,
  type AgentTurnOutput,
  toAgentChatHistory,
} from "@/lib/agent-core";
import {
  type WizardData,
  useInfluencerWizard,
} from "@/hooks/use-influencer-wizard";
import { trpc } from "@/lib/trpc";

export type WizardAgentStep = 1 | 2 | 4;

export type WizardContextStep2 = {
  profile: WizardLookProfile & { gender: WizardData["gender"] };
  brief?: string;
  nicheProfile?: WizardData["nicheProfile"];
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
  nicheProfile?: WizardData["nicheProfile"];
};

export type WizardContextStep4 = {
  profile: {
    name: string;
    niche: string;
    personality: string;
  };
  brief?: string;
  nicheProfile?: WizardData["nicheProfile"];
  appearance: {
    ethnicity?: string;
    bodyType?: string;
    fashionStyles?: string[];
  };
  currentBio: string;
};

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
  const nicheProfile = wizardData.nicheProfile;

  if (step === 2) {
    return {
      profile: {
        ...getWizardLookProfile(wizardData),
        gender: wizardData.gender,
      },
      brief: wizardData.brief?.trim() || undefined,
      nicheProfile,
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
      brief: wizardData.brief?.trim() || undefined,
      nicheProfile,
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
    nicheProfile,
  };
}

export type UseWizardAgentOptions = {
  step: WizardAgentStep;
};

export function useWizardAgent({ step }: UseWizardAgentOptions) {
  const locale = useLocale();
  const t = useTranslations("wizard");
  const language = locale === "en" ? "en" : "fr";
  const { data, updateData } = useInfluencerWizard();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [lastTurn, setLastTurn] = useState<AgentTurnOutput | null>(null);

  const chatMutation = trpc.agent.chatTurn.useMutation();

  const context = useMemo(
    () => ({
      step,
      locale: language,
      isNsfw: data.isNsfw,
      niche: data.niche.trim() || undefined,
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
        const result = await chatMutation.mutateAsync({
          domain: "wizard",
          messages: toAgentChatHistory(nextMessages),
          context,
        });

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

        // The agent never writes identity fields (name, bio, personality).
        // Exception: the niche is a TECHNICAL category, not a creative field —
        // it powers presets, trends, prompts. Per the "demote niche" decision,
        // the agent owns it: it sets it from its understanding when the user
        // hasn't picked one yet, leaving the user free to confirm/override.
        if (result.nicheProfile) {
          const patch: Partial<WizardData> = {
            nicheProfile: result.nicheProfile,
          };
          const detected = result.nicheProfile.nicheCategory;
          const currentNiche = useInfluencerWizard.getState().data.niche.trim();
          if (detected && !currentNiche) {
            patch.niche = detected;
          }
          updateData(patch);
        }
        const brief = result.wizardStep1Suggestions?.brief?.trim();
        if (brief) updateData({ brief });
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
    [chatMutation, context, messages, t, updateData]
  );

  const clearSession = useCallback(() => {
    setMessages([]);
    setLastTurn(null);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading: chatMutation.isPending,
    quickReplies,
    lastTurn,
    nicheProfile: data.nicheProfile,
    updateNicheProfile: (profile: WizardData["nicheProfile"]) =>
      updateData({ nicheProfile: profile }),
    clearSession,
    wizardData: data,
  };
}
