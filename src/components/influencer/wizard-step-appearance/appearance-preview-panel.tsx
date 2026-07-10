"use client";

import Image from "next/image";
import { RefreshCw, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { WizardAppearanceGenerationProgress } from "@/components/influencer/wizard-appearance-generation-progress";
import { WizardPortraitComparison } from "@/components/influencer/wizard-portrait-comparison";
import { cn } from "@/lib/utils";
import { AppearanceVisualSignature } from "./appearance-visual-signature";
import type { AppearanceGenerationState } from "./use-appearance-generation";

export function AppearancePreviewPanel({
  generation,
}: {
  generation: AppearanceGenerationState;
}) {
  const t = useTranslations("wizard");

  const {
    data,
    generatedImages,
    selectedImageIndex,
    isGenerating,
    hasEnoughCredits,
    cost,
    showGenerationProgress,
    canvasImageUrl,
    handleSelectImage,
    handleGenerate,
    handleSurpriseMe,
  } = generation;

  return (
    <div className="order-1 space-y-3 lg:order-2 lg:sticky lg:top-20 lg:self-start">
      <div
        className={cn(
          "relative aspect-[3/4] overflow-hidden rounded-2xl border bg-neutral-950/80 transition-all",
          canvasImageUrl
            ? "border-violet-500/40 shadow-lg shadow-violet-500/10"
            : "border-slate-800/50"
        )}
      >
        {canvasImageUrl ? (
          <div
            className={cn(
              "relative h-full w-full transition-opacity duration-300",
              showGenerationProgress && "opacity-60"
            )}
          >
            <Image
              src={canvasImageUrl}
              alt={t("previewAlt")}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
            <User className="h-16 w-16 text-slate-600" />
            <p className="text-center text-sm text-slate-500">
              {showGenerationProgress ? t("generatingAppearance") : t("previewHint")}
            </p>
          </div>
        )}
      </div>

      <WizardAppearanceGenerationProgress active={showGenerationProgress} />

      {generatedImages.length > 0 && (
        <>
          <WizardPortraitComparison
            urls={generatedImages}
            selectedIndex={selectedImageIndex}
            onSelect={handleSelectImage}
          />
          <p className="text-xs text-slate-500 lg:hidden">{t("selectVariant")}</p>
          <div className="grid grid-cols-4 gap-2 lg:hidden">
            {generatedImages.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectImage(i)}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-xl border-2 transition-all",
                  selectedImageIndex === i
                    ? "border-violet-500 shadow-lg shadow-violet-500/20"
                    : "border-transparent opacity-60 hover:opacity-90"
                )}
              >
                <Image
                  src={url}
                  alt={t("variantAlt", { index: i + 1 })}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </button>
            ))}
          </div>

          <AppearanceVisualSignature
            data={data}
            onReroll={handleSurpriseMe}
            disabled={isGenerating || !hasEnoughCredits}
          />

          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={isGenerating || !hasEnoughCredits}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 py-2 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className="h-3 w-3" />
            {t("regenerate")} ({t("creditsCount", { count: cost })})
          </button>
        </>
      )}
    </div>
  );
}
