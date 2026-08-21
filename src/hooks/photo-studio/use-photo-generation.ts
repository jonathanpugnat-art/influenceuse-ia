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
  // Persist the last generation error so the preview shows an inline French
  // message instead of silently reverting to an empty placeholder — the toast
  // alone is easy to miss (see face-lock QA report).
  const [generationError, setGenerationError] = useState<string | null>(null);

  const useSceneFirst =
    params.sceneFirst &&
    params.contentMode === "SFW" &&
    params.useFaceReference;

  useEffect(() => {
    setScenePlateUrl(null);
    setContentId(null);
    setGeneratedUrls([]);
    setPromptWasSoftened(false);
    setGenerationError(null);
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
      const message = formatGenerationErrorForUser(err.message, {
        contentMode: params.contentMode === "NSFW" ? "NSFW" : "SFW",
      });
      if (!handleUpgrade(err.message)) toast.error(message, { duration: 9000 });
      setGenerationError(message);
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
      const message = formatPhotoSceneErrorForUser(err.message);
      if (!handleUpgrade(err.message)) {
        toast.error(message, { duration: 9000 });
      }
      setGenerationError(message);
      setIsGenerating(false);
      setGenerationStep("");
    },
  });

  const composeMutation = trpc.content.composePhotoOnScene.useMutation({
    onSuccess: () => {
      setGenerationStep("compose");
    },
    onError: (err) => {
      const message = formatGenerationErrorForUser(err.message);
      if (!handleUpgrade(err.message)) toast.error(message, { duration: 9000 });
      setGenerationError(message);
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

    // Order matters: FAILED must be handled before scene_ready so a face-lock
    // failure during compose (backend keeps the scene plate around for a
    // retry, so phase stays "scene_ready") does not silently fire the
    // "sceneReadyToast" success path and swallow the real French error.
    if (statusData.status === "FAILED") {
      const errMsg =
        statusData.errorMessage ??
        (phase === "scene_generating" || generationStep === "scene"
          ? formatPhotoSceneErrorForUser(null)
          : formatGenerationErrorForUser(null));
      setGenerationError(errMsg);
      toast.error(errMsg, { duration: 9000 });
      if (statusData.scenePlateUrl) {
        setScenePlateUrl(statusData.scenePlateUrl);
      }
      setIsGenerating(false);
      setGenerationStep("");
      return;
    }

    if (phase === "scene_ready" && statusData.scenePlateUrl) {
      setScenePlateUrl(statusData.scenePlateUrl);
      // Only announce "décor prêt" when the running step is scene generation.
      // During a compose retry the phase stays scene_ready — we don't want
      // to prematurely celebrate success and stop polling for the compose
      // outcome.
      if (generationStep === "scene") {
        setIsGenerating(false);
        setGenerationStep("");
        invalidatePlan();
        toast.success(t("sceneReadyToast"));
      }
      return;
    }

    if (statusData.status === "READY" && statusData.mediaUrls.length > 0) {
      setGeneratedUrls(statusData.mediaUrls);
      setGenerationStep("done");
      setGenerationError(null);
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
      const message = t("generationTimeout");
      toast.error(message, { duration: 10000 });
      setGenerationError(message);
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
  const hasTrendSource = Boolean(
    params.recommendationId || params.trendItemId
  );

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
    if (!hasTrendSource && !params.outfit.trim()) {
      toast.error(t("studioOutfitEmpty"), { duration: 5000 });
      return;
    }
    if (!hasTrendSource && !hasScene) {
      toast.error(t("studioSceneEmpty"), { duration: 5000 });
      return;
    }
    resetForNewRun();
    setScenePlateUrl(null);
    setContentId(null);
    setGenerationError(null);
    setIsGenerating(true);
    setGenerationStep("scene");
    scenePlateMutation.mutate(buildPhotoPayload(params));
  };

  const handleCompose = () => {
    if (!contentId) {
      toast.error(t("generateSceneFirst"));
      return;
    }
    setGenerationError(null);
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
    if (!hasTrendSource && !params.outfit.trim()) {
      toast.error(t("studioOutfitEmpty"), { duration: 5000 });
      return;
    }
    if (!hasTrendSource && !hasScene) {
      toast.error(t("studioSceneEmpty"), { duration: 5000 });
      return;
    }
    resetForNewRun();
    setScenePlateUrl(null);
    setContentId(null);
    setGenerationError(null);
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
    !!params.influencerId &&
    !isGenerating &&
    (hasTrendSource || (hasOutfit && hasScene));
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
    generationError,
    dismissGenerationError: () => setGenerationError(null),
  };
}

export type PhotoGenerationState = ReturnType<typeof usePhotoGeneration>;
