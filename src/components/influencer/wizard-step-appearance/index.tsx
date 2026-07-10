"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { WizardBaseGallery } from "@/components/influencer/wizard-base-gallery";
import { WizardCollisionBanner } from "@/components/influencer/wizard-collision-banner";
import { WizardTrendsInspire } from "@/components/influencer/wizard-trends-inspire";
import {
  wizardPrimaryButtonClass,
  wizardSecondaryButtonClass,
} from "@/components/influencer/wizard-ui";
import { AppearanceControlsColumn } from "./appearance-controls-column";
import { AppearanceCreditsPanel } from "./appearance-credits-panel";
import { AppearanceNsfwBanner } from "./appearance-nsfw-banner";
import { AppearancePreviewPanel } from "./appearance-preview-panel";
import { AppearanceTabBar } from "./appearance-tab-bar";
import { useAppearanceForm } from "./use-appearance-form";
import { useAppearanceGeneration } from "./use-appearance-generation";

export function WizardStepAppearance({
  onNext,
  onPrev,
}: {
  onNext: () => void;
  onPrev: () => void;
}) {
  const t = useTranslations("wizard");
  const generation = useAppearanceGeneration();
  const form = useAppearanceForm({
    data: generation.data,
    updateData: generation.updateData,
  });

  const {
    data,
    updateData,
    appearanceTab,
    setAppearanceTab,
    creditsRemaining,
    cost,
    hasEnoughCredits,
    handleSurpriseMe,
    handleSelectBase,
    selectedPortraitUrl,
  } = generation;

  const handleNext = () => {
    if (!selectedPortraitUrl) {
      toast.error(t("portraitRequired"));
      return;
    }
    updateData({ baseImageUrl: selectedPortraitUrl });
    onNext();
  };

  return (
    <div className="space-y-6 max-md:pb-[var(--mobile-nav-height)]">
      {data.isNsfw && <AppearanceNsfwBanner />}

      <AppearanceTabBar
        appearanceTab={appearanceTab}
        onTabChange={setAppearanceTab}
      />

      {appearanceTab === "gallery" ? (
        <WizardBaseGallery
          niche={data.niche}
          gender={data.gender}
          includeNsfw={data.isNsfw}
          brief={data.brief}
          selectedUrl={selectedPortraitUrl || undefined}
          onSelect={handleSelectBase}
        />
      ) : (
        <>
          <WizardTrendsInspire />
          <AppearanceCreditsPanel
            cost={cost}
            creditsRemaining={creditsRemaining}
            hasEnoughCredits={hasEnoughCredits}
          />

          {data.appearanceFingerprint && (
            <WizardCollisionBanner
              fingerprint={data.appearanceFingerprint}
              onReroll={handleSurpriseMe}
              compact
            />
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <AppearanceControlsColumn form={form} generation={generation} />
            <AppearancePreviewPanel generation={generation} />
          </div>
        </>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className={wizardSecondaryButtonClass}
        >
          ← {t("back")}
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!selectedPortraitUrl}
          className={wizardPrimaryButtonClass}
        >
          {t("next")} →
        </button>
      </div>
    </div>
  );
}
