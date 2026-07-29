"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { wizardPrimaryButtonClass } from "@/components/influencer/wizard-ui";
import { cn } from "@/lib/utils";
import type { AppearanceFormState } from "./use-appearance-form";
import type { AppearanceGenerationState } from "./use-appearance-generation";

export function AppearanceGenerateActions({
  form,
  generation,
}: {
  form: AppearanceFormState;
  generation: AppearanceGenerationState;
}) {
  const t = useTranslations("wizard");

  const {
    isPreviewGenerating,
    isGenerating,
    hasEnoughForPreview,
    hasEnoughCredits,
    previewCost,
    cost,
    previewImageUrl,
    runAppearancePreview,
    handleGenerate,
  } = generation;

  return (
    <>
      <button
        type="button"
        onClick={() => runAppearancePreview()}
        disabled={isPreviewGenerating || isGenerating || !hasEnoughForPreview}
        className={cn(wizardPrimaryButtonClass, "w-full justify-center shadow-none")}
      >
        {isPreviewGenerating ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            {t("generatingPreview")}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {previewImageUrl ? t("regeneratePreview") : t("previewAppearance")}{" "}
            ({t("creditsCount", { count: previewCost })})
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => handleGenerate()}
        disabled={isGenerating || !hasEnoughCredits}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:opacity-40"
      >
        {isGenerating ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            {t("generatingAppearance")}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {t("generateVariants")} ({t("creditsCount", { count: cost })})
          </>
        )}
      </button>

      {!form.hasAnyChoice && (
        <p className="text-center text-xs text-muted-foreground">
          {t("surpriseMeDefault")}
        </p>
      )}
    </>
  );
}
