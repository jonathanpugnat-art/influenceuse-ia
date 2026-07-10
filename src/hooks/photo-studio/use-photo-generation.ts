"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { trpc } from "@/lib/trpc";
import { CREDIT_COSTS } from "@/lib/constants";
import { SCENE_FIRST_PLATE_CREDIT } from "@/lib/prompts/scene-first-photo";
import { useUpgradeOnLimitError } from "@/hooks/use-upgrade-on-limit-error";
import { toast } from "sonner";
import { useInvalidateCurrentPlan } from "@/hooks/use-current-plan";
import { buildPhotoPayload } from "@/lib/photo-payload";
import {
  hasUserSceneDescription,
  stripScenePropsSuffix,
} from "@/lib/photo-scene-user";
import {
  formatGenerationErrorForUser,
  formatPhotoSceneErrorForUser,
} from "@/lib/generation-errors";
import {
  validatePhotoIntent,
  type PhotoIntentIssue,
} from "@/lib/photo-intent-validation";

export function usePhotoGeneration(locale: "fr" | "en") {
  const t = useTranslations("content");

  const {
    params,
    contentId,
    scenePlateUrl,
    isGenerating,
    generatedUrls,
    selectedImageIndex,
    setContentId,
    setScenePlateUrl,
    setIsGenerating,
    setGenerationStep,
    setGeneratedUrls,
    setSelectedImageIndex,
    generationStep,
    generateNonce,
  } = usePhotoCreator();

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleUpgrade = useUpgradeOnLimitError();
  const invalidatePlan = useInvalidateCurrentPlan();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [promptWasSoftened, setPromptWasSoftened] = useState(false);

  const useSceneFirst =
    params.sceneFirst &&
    params.contentMode === "SFW" &&
    params.useFaceReference;

  useEffect(() => {
    setScenePlateUrl(null);
    setContentId(null);
    setGeneratedUrls([]);
    setPromptWasSoftened(false);
  }, [
    params.influencerId,
    params.sceneDescription,
    setScenePlateUrl,
    setContentId,
    setGeneratedUrls,
  ]);

  const generateMutation = trpc.content.generatePhoto.useMutation({
    onSuccess: (data) => {
      setContentId(data.contentId);
      setGenerationStep("compose");
    },
    onError: (err) => {
      if (!handleUpgrade(err.message)) toast.error(err.message);
      setIsGenerating(false);
      setGenerationStep("");
    },
  });

  const scenePlateMutation = trpc.content.generatePhotoScenePlate.useMutation({
    onSuccess: (data) => {
      setContentId(data.contentId);
      setGenerationStep("scene");
    },
    onError: (err) => {
      if (!handleUpgrade(err.message)) {
        toast.error(formatPhotoSceneErrorForUser(err.message), {
          duration: 9000,
        });
      }
      setIsGenerating(false);
      setGenerationStep("");
    },
  });

  const composeMutation = trpc.content.composePhotoOnScene.useMutation({
    onSuccess: () => {
      setGenerationStep("compose");
    },
    onError: (err) => {
      if (!handleUpgrade(err.message)) toast.error(err.message);
      setIsGenerating(false);
      setGenerationStep("");
    },
  });

  const { data: statusData } = trpc.content.getGenerationStatus.useQuery(
    { contentId: contentId! },
    {
      enabled: !!contentId && isGenerating,
      refetchInterval: 2000,
    }
  );

  useEffect(() => {
    if (!statusData || !isGenerating) return;

    const phase = statusData.photoPhase;

    if (phase === "scene_ready" && statusData.scenePlateUrl) {
      setScenePlateUrl(statusData.scenePlateUrl);
      setIsGenerating(false);
      setGenerationStep("");
      invalidatePlan();
      toast.success(t("sceneReadyToast"));
      return;
    }

    if (statusData.status === "READY" && statusData.mediaUrls.length > 0) {
      setGeneratedUrls(statusData.mediaUrls);
      setGenerationStep("done");
      invalidatePlan();
      if (statusData.promptWasSoftened) {
        setPromptWasSoftened(true);
        toast.warning(t("promptSoftenedToast"), { duration: 8000 });
      }
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationStep("");
      }, 800);
      return;
    }

    if (statusData.status === "FAILED") {
      const errMsg =
        statusData.errorMessage ??
        (phase === "scene_generating" || generationStep === "scene"
          ? formatPhotoSceneErrorForUser(null)
          : formatGenerationErrorForUser(null));
      toast.error(errMsg, { duration: 8000 });
      setIsGenerating(false);
      setGenerationStep("");
    }
  }, [
    statusData,
    isGenerating,
    generationStep,
    setGeneratedUrls,
    setGenerationStep,
    setIsGenerating,
    setScenePlateUrl,
    invalidatePlan,
    t,
  ]);

  useEffect(() => {
    if (!isGenerating || !contentId) return;
    const timeoutMs = 8 * 60 * 1000;
    const timer = setTimeout(() => {
      toast.error(t("generationTimeout"), { duration: 10000 });
      setIsGenerating(false);
      setGenerationStep("");
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [isGenerating, contentId, setIsGenerating, setGenerationStep, t]);

  const resetForNewRun = () => {
    setGeneratedUrls([]);
    setSelectedImageIndex(0);
  };

  const sceneRecap = stripScenePropsSuffix(params.sceneDescription);
  const hasScene = hasUserSceneDescription(params.sceneDescription);
  const hasOutfit = Boolean(params.outfit.trim());

  const intentWarnings: PhotoIntentIssue[] = validatePhotoIntent({
    contentMode: params.contentMode ?? "SFW",
    sceneDescription: params.sceneDescription,
    outfit: params.outfit,
    scene: params.scene,
    locale,
  }).filter((issue) => issue.code === "suggestive_in_social");

  const handleGenerateScene = () => {
    if (!params.influencerId) {
      toast.error(t("selectInfluencerFirst"));
      return;
    }
    if (!params.outfit.trim()) {
      toast.error(t("studioOutfitEmpty"), { duration: 5000 });
      return;
    }
    if (!hasScene) {
      toast.error(t("studioSceneEmpty"), { duration: 5000 });
      return;
    }
    resetForNewRun();
    setScenePlateUrl(null);
    setContentId(null);
    setIsGenerating(true);
    setGenerationStep("scene");
    scenePlateMutation.mutate(buildPhotoPayload(params));
  };

  const handleCompose = () => {
    if (!contentId) {
      toast.error(t("generateSceneFirst"));
      return;
    }
    setIsGenerating(true);
    setGenerationStep("compose");
    composeMutation.mutate({
      contentId,
      numberOfImages: params.numberOfImages,
    });
  };

  const handleClassicGenerate = () => {
    if (!params.influencerId) {
      toast.error(t("selectInfluencerFirst"));
      return;
    }
    if (!params.outfit.trim()) {
      toast.error(t("studioOutfitEmpty"), { duration: 5000 });
      return;
    }
    if (!hasScene) {
      toast.error(t("studioSceneEmpty"), { duration: 5000 });
      return;
    }
    resetForNewRun();
    setScenePlateUrl(null);
    setContentId(null);
    setIsGenerating(true);
    setGenerationStep("compose");
    generateMutation.mutate(buildPhotoPayload(params));
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const generateNonceRef = useRef(0);
  useEffect(() => {
    if (generateNonce <= generateNonceRef.current) return;
    generateNonceRef.current = generateNonce;
    if (
      params.sceneFirst &&
      params.contentMode === "SFW" &&
      params.useFaceReference
    ) {
      handleGenerateScene();
    } else {
      handleClassicGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generateNonce]);

  const composeCost = params.numberOfImages * CREDIT_COSTS.PHOTO;
  const canGenerate =
    !!params.influencerId && hasOutfit && hasScene && !isGenerating;
  const hasFinalImages = generatedUrls.length > 0 && !isGenerating;
  const awaitingSceneApproval =
    useSceneFirst && Boolean(scenePlateUrl) && !hasFinalImages;
  const currentImage = generatedUrls[selectedImageIndex];
  const displaySceneUrl = scenePlateUrl;

  const workflowStepIndex = hasFinalImages
    ? 2
    : awaitingSceneApproval
      ? 1
      : 0;

  const loadingLabel =
    generationStep === "scene"
      ? t("generatingScene")
      : generationStep === "compose"
        ? t("generatingInfluencer")
        : t("estimatedTime");

  const showPrimaryActions =
    !hasFinalImages && !isGenerating && !awaitingSceneApproval;

  const creditSuffix =
    composeCost > 1
      ? `${composeCost} ${t("creditUnit")}s`
      : `${composeCost} ${t("creditUnit")}`;

  const primaryLabel = useSceneFirst
    ? awaitingSceneApproval
      ? t("composeInfluencerBtn", { cost: String(composeCost) })
      : `${t("generatePostBtn")} — ${t("generatePostBtnScene", { cost: String(SCENE_FIRST_PLATE_CREDIT) })}`
    : `${t("generatePostBtn")} (${creditSuffix})`;

  const onPrimaryAction = () => {
    if (useSceneFirst && awaitingSceneApproval) {
      handleCompose();
      return;
    }
    if (useSceneFirst) {
      handleGenerateScene();
      return;
    }
    handleClassicGenerate();
  };

  const handleRegenerate = () => {
    if (useSceneFirst) handleGenerateScene();
    else handleClassicGenerate();
  };

  const handleDeleteCurrent = () => {
    const newUrls = generatedUrls.filter((_, i) => i !== selectedImageIndex);
    setGeneratedUrls(newUrls);
    setScenePlateUrl(null);
    setContentId(null);
  };

  return {
    params,
    contentId,
    scenePlateUrl,
    isGenerating,
    generatedUrls,
    selectedImageIndex,
    setSelectedImageIndex,
    setGeneratedUrls,
    setScenePlateUrl,
    setContentId,
    generationStep,
    viewerOpen,
    setViewerOpen,
    isDownloading,
    setIsDownloading,
    promptWasSoftened,
    useSceneFirst,
    sceneRecap,
    hasScene,
    hasOutfit,
    intentWarnings,
    handleGenerateScene,
    handleCompose,
    handleClassicGenerate,
    handleRegenerate,
    handleDeleteCurrent,
    composeCost,
    canGenerate,
    hasFinalImages,
    awaitingSceneApproval,
    currentImage,
    displaySceneUrl,
    workflowStepIndex,
    loadingLabel,
    showPrimaryActions,
    primaryLabel,
    onPrimaryAction,
  };
}

export type PhotoGenerationState = ReturnType<typeof usePhotoGeneration>;
