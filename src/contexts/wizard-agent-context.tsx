"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useWizardAgent, type WizardAgentStep } from "@/hooks/use-wizard-agent";

type WizardAgentContextValue = ReturnType<typeof useWizardAgent>;

const WizardAgentContext = createContext<WizardAgentContextValue | null>(null);

export function WizardAgentProvider({
  step,
  children,
}: {
  step: WizardAgentStep;
  children: ReactNode;
}) {
  const value = useWizardAgent({ step });
  return (
    <WizardAgentContext.Provider value={value}>
      {children}
    </WizardAgentContext.Provider>
  );
}

export function useWizardAgentContext(): WizardAgentContextValue {
  const ctx = useContext(WizardAgentContext);
  if (!ctx) {
    throw new Error("useWizardAgentContext must be used within WizardAgentProvider");
  }
  return ctx;
}

/** Map linear wizard step (1–4) to the agent context step. */
export function wizardStepToAgentStep(step: number): WizardAgentStep {
  if (step === 2) return 2;
  if (step >= 4) return 4;
  return 1;
}
