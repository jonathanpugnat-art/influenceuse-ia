"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { WizardProgress } from "@/components/influencer/wizard-progress";
import { WizardNicheBrainPanel } from "@/components/influencer/wizard-niche-brain-panel";
import {
  WizardAgentProvider,
  wizardStepToAgentStep,
} from "@/contexts/wizard-agent-context";
import { WizardStepAppearance } from "@/components/influencer/wizard-step-appearance";
import { WizardStepIdentity } from "@/components/influencer/wizard-step-identity";
import { WizardStepSocial } from "@/components/influencer/wizard-step-social";
import { WizardStepSummary } from "@/components/influencer/wizard-step-summary";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import {
  canNavigateToWizardStep,
  getMaxReachableWizardStep,
} from "@/lib/wizard-validation";

export function WizardGuidedFlow() {
  const locale = useLocale();
  const {
    step,
    setStep,
    data,
    generatedImages,
    selectedImageIndex,
    createdInfluencerId,
  } = useInfluencerWizard();

  const maxReachableStep = useMemo(
    () => getMaxReachableWizardStep(data, generatedImages, selectedImageIndex),
    [data, generatedImages, selectedImageIndex]
  );

  const handleStepClick = (target: number) => {
    if (
      canNavigateToWizardStep(
        target,
        data,
        generatedImages,
        selectedImageIndex
      )
    ) {
      setStep(target);
    }
  };

  return (
    <WizardAgentProvider step={wizardStepToAgentStep(step)}>
      <div className="space-y-8">
        <WizardProgress
          currentStep={step}
          maxReachableStep={maxReachableStep}
          onStepClick={handleStepClick}
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
          <div className="min-w-0 space-y-8">
            {step === 1 && (
              <WizardStepIdentity onNext={() => setStep(2)} />
            )}
            {step === 2 && (
              <WizardStepAppearance
                onNext={() => setStep(3)}
                onPrev={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <WizardStepSocial
                onNext={() => setStep(4)}
                onPrev={() => setStep(2)}
                influencerId={createdInfluencerId}
                locale={locale}
              />
            )}
            {step === 4 && (
              <WizardStepSummary onPrev={() => setStep(3)} />
            )}
          </div>

          <WizardNicheBrainPanel className="lg:sticky lg:top-20" />
        </div>
      </div>
    </WizardAgentProvider>
  );
}
