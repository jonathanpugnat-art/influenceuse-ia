"use client";

import { useTranslations } from "next-intl";
import { AgentPanel } from "@/components/shared/agent-panel";
import {
  useWizardAgent,
  type WizardAgentStep,
} from "@/hooks/use-wizard-agent";
import { cn } from "@/lib/utils";

type SetValueFn = (
  field: "name" | "gender" | "bio" | "personality" | "niche" | "age",
  value: unknown,
  options?: { shouldValidate?: boolean }
) => void;

export type WizardAiHelperProps = {
  step: WizardAgentStep;
  setValue?: SetValueFn;
  className?: string;
  showBioCards?: boolean;
};

export function WizardAiHelper({
  step,
  setValue,
  className,
  showBioCards = false,
}: WizardAiHelperProps) {
  const t = useTranslations("wizard");
  const {
    messages,
    sendMessage,
    isLoading,
    quickReplies,
    bioOptions,
    pickBioOption,
  } = useWizardAgent({ step, setValue });

  return (
    <div className={cn("space-y-3", className)}>
      <AgentPanel
        domain="wizard"
        messages={messages}
        onSend={sendMessage}
        isLoading={isLoading}
        quickReplies={quickReplies}
        emptyTitle={t("agentEmptyTitle")}
        emptyHint={t("agentEmptyHint")}
        inputPlaceholder={t("agentInputPlaceholder")}
        thinkingLabel={t("agentThinking")}
      />

      {showBioCards && bioOptions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-300/80">
            {t("agentBioOptionsTitle")}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {bioOptions.map((bio, index) => (
              <button
                key={`${index}-${bio.slice(0, 24)}`}
                type="button"
                onClick={() => pickBioOption(bio)}
                className="rounded-xl border border-slate-700 bg-slate-800/40 p-3 text-left text-xs leading-relaxed text-slate-200 transition-colors hover:border-violet-500 hover:bg-violet-500/10"
              >
                {bio}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
