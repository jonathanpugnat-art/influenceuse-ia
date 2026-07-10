"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { trpc } from "@/lib/trpc";
import { CREDIT_COSTS } from "@/lib/constants";
import {
  fingerprintFromWizard,
  normalizeAppearanceVariation,
  randomAppearanceVariation,
} from "@/lib/prompts/appearance-variation-ui";
import { ensureOfSocialDefaults } from "@/lib/wizard-of-flow";
import {
  useCurrentPlan,
  useInvalidateCurrentPlan,
} from "@/hooks/use-current-plan";

export function useAppearanceGeneration() {
  const t = useTranslations("wizard");

  const {
    data,
    updateData,
    generatedImages,
    setGeneratedImages,
    selectedImageIndex,
    setSelectedImageIndex,
    isGenerating,
    setIsGenerating,
  } = useInfluencerWizard();

  const previewRequestId = useRef(0);
  const previewCooldownUntil = useRef(0);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isPreviewGenerating, setIsPreviewGenerating] = useState(false);
  const [appearanceTab, setAppearanceTab] = useState<"gallery" | "customize">(
    "gallery"
  );

  useEffect(() => {
    const patch = ensureOfSocialDefaults(data);
    if (patch) updateData(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync OF defaults once on mount
  }, []);

  const invalidatePlan = useInvalidateCurrentPlan();
  const { data: creditsData } = useCurrentPlan();
  const creditsRemaining = creditsData?.creditsRemaining ?? 0;
  const cost = CREDIT_COSTS.BASE_IMAGE;
  const previewCost = CREDIT_COSTS.WIZARD_PREVIEW;
  const hasEnoughCredits = creditsRemaining >= cost;
  const hasEnoughForPreview = creditsRemaining >= previewCost;

  const generateMutation = trpc.content.generateBaseImage.useMutation({
    onSuccess: (result) => {
      setGeneratedImages(result.imageUrls);
      setSelectedImageIndex(0);
      const updates: Parameters<typeof updateData>[0] = {
        appearanceVariations: result.appearanceVariations,
        appearanceFingerprint: result.appearanceFingerprint,
      };
      if (result.imageUrls[0]) {
        updates.baseImageUrl = result.imageUrls[0];
      }
      updateData(updates);
      setIsGenerating(false);
      invalidatePlan();
      toast.success(t("variantsGeneratedToast"));
    },
    onError: (err) => {
      setIsGenerating(false);
      toast.error(err.message);
    },
  });

  const previewMutation =
    trpc.content.generateWizardAppearancePreview.useMutation();

  const buildAppearancePayload = useCallback(() => {
    const hairStyle =
      [data.hairLength, data.hairTexture].filter(Boolean).join(", ") ||
      undefined;
    const fashionStyle = data.fashionStyles?.length
      ? data.fashionStyles.join(", ")
      : undefined;
    const variations = data.appearanceVariations
      ? normalizeAppearanceVariation(data.appearanceVariations)
      : undefined;
    return {
      age: data.age || 24,
      gender: data.gender ?? ("female" as const),
      style: {
        ethnicity: data.ethnicity || undefined,
        hairColor: data.hairColor || undefined,
        hairStyle,
        bodyType: data.bodyType || undefined,
        fashionStyle,
        skinTone: data.skinTone || undefined,
        height: data.height || undefined,
        bustLevel: data.bustLevel,
        hipsLevel: data.hipsLevel,
        shouldersLevel: data.shouldersLevel,
        tattoos: data.tattoos?.length ? data.tattoos : undefined,
        makeupLevel: data.makeupLevel || undefined,
        bodyGenerationMode: data.bodyGenerationMode,
        morphologyNotes: data.morphologyNotes?.trim() || undefined,
      },
      appearanceVariations: variations,
    };
  }, [data]);

  const runAppearancePreview = useCallback(() => {
    if (isGenerating || generatedImages.length > 0) return;
    if (Date.now() < previewCooldownUntil.current) return;
    if (previewMutation.isPending) return;

    const requestId = ++previewRequestId.current;
    setIsPreviewGenerating(true);

    previewMutation.mutate(buildAppearancePayload(), {
      onSuccess: (result) => {
        if (requestId !== previewRequestId.current) return;
        setPreviewImageUrl(result.imageUrl);
        setIsPreviewGenerating(false);
        updateData({
          appearanceVariations: result.appearanceVariations,
          appearanceFingerprint: result.appearanceFingerprint,
          baseImageUrl: result.imageUrl,
        });
        invalidatePlan();
      },
      onError: (err) => {
        if (requestId !== previewRequestId.current) return;
        setIsPreviewGenerating(false);
        previewCooldownUntil.current = Date.now() + 60_000;
        toast.error(err.message || t("previewFailedToast"));
      },
    });
  }, [
    buildAppearancePayload,
    generatedImages.length,
    isGenerating,
    previewMutation,
    updateData,
    t,
    invalidatePlan,
  ]);

  const handleGenerate = () => {
    if (!hasEnoughCredits) return;
    previewRequestId.current += 1;
    setIsPreviewGenerating(false);
    setIsGenerating(true);
    generateMutation.mutate(buildAppearancePayload());
  };

  const handleSurpriseMe = () => {
    const next = randomAppearanceVariation();
    updateData({
      appearanceVariations: next,
      appearanceFingerprint: fingerprintFromWizard(data.age || 24, data, next),
    });
    handleGenerate();
  };

  const handleSelectImage = (index: number) => {
    setSelectedImageIndex(index);
    const url = generatedImages[index];
    if (url) updateData({ baseImageUrl: url });
  };

  const handleSelectBase = (url: string) => {
    updateData({ baseImageUrl: url });
  };

  const selectedPortraitUrl =
    generatedImages[selectedImageIndex] ?? data.baseImageUrl?.trim() ?? "";

  const showGenerationProgress = isPreviewGenerating || isGenerating;
  const canvasImageUrl =
    generatedImages.length > 0
      ? (generatedImages[selectedImageIndex] ?? generatedImages[0] ?? "")
      : (previewImageUrl ?? data.baseImageUrl?.trim() ?? "");

  return {
    data,
    updateData,
    generatedImages,
    selectedImageIndex,
    isGenerating,
    appearanceTab,
    setAppearanceTab,
    creditsRemaining,
    cost,
    previewCost,
    hasEnoughCredits,
    hasEnoughForPreview,
    runAppearancePreview,
    handleGenerate,
    handleSurpriseMe,
    handleSelectImage,
    handleSelectBase,
    selectedPortraitUrl,
    isPreviewGenerating,
    showGenerationProgress,
    canvasImageUrl,
    previewImageUrl,
  };
}

export type AppearanceGenerationState = ReturnType<
  typeof useAppearanceGeneration
>;
