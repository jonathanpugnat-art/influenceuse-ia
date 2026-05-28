"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImagePlus,
  RefreshCw,
  Download,
  Trash2,
  Sparkles,
  Coins,
  MapPin,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePhotoCreator, type PhotoParams } from "@/hooks/use-photo-creator";
import { PhotoGenerationPreview } from "@/components/content/photo-generation-preview";
import { trpc } from "@/lib/trpc";
import { CREDIT_COSTS } from "@/lib/constants";
import { SCENE_FIRST_PLATE_CREDIT } from "@/lib/prompts/scene-first-photo";
import { cn } from "@/lib/utils";
import { useUpgradeOnLimitError } from "@/hooks/use-upgrade-on-limit-error";
import { toast } from "sonner";
import { MediaViewerDialog } from "@/components/media/media-viewer-dialog";
import { downloadMediaUrl } from "@/lib/download-media";
import { WorkflowSteps } from "@/components/content/workflow-steps";
import { PhotoInstagramFeedMock } from "@/components/content/photo-instagram-feed-mock";
import {
  formatGenerationErrorForUser,
  formatPhotoSceneErrorForUser,
} from "@/lib/generation-errors";

function photoPayload(params: PhotoParams) {
  return {
    influencerId: params.influencerId,
    scene: params.scene,
    sceneDescription: params.sceneDescription.trim() || undefined,
    pose: params.pose,
    outfit: params.outfit,
    expression: params.expression,
    photoStyle: params.photoStyle,
    timeOfDay: params.timeOfDay,
    location: params.location || undefined,
    customPrompt: params.customPrompt || undefined,
    numberOfImages: params.numberOfImages,
    contentMode: params.contentMode,
    nsfwLevel: params.contentMode === "NSFW" ? params.nsfwLevel : undefined,
    useFaceReference: params.useFaceReference,
  };
}

export function PhotoPreview({
  isWelcomeFlow = false,
  layout = "classic",
}: {
  isWelcomeFlow?: boolean;
  layout?: "classic" | "studio";
}) {
  const t = useTranslations("content");

  const {
    params,
    caption,
    hashtags,
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
  } = usePhotoCreator();

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleUpgrade = useUpgradeOnLimitError();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const useSceneFirst =
    params.sceneFirst &&
    params.contentMode === "SFW" &&
    params.useFaceReference;

  useEffect(() => {
    setScenePlateUrl(null);
    setContentId(null);
    setGeneratedUrls([]);
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
        toast.error(formatPhotoSceneErrorForUser(err.message), { duration: 9000 });
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
      toast.success(t("sceneReadyToast"));
      return;
    }

    if (statusData.status === "READY" && statusData.mediaUrls.length > 0) {
      setGeneratedUrls(statusData.mediaUrls);
      setGenerationStep("done");
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

  const handleGenerateScene = () => {
    if (!params.influencerId) {
      toast.error(t("selectInfluencerFirst"));
      return;
    }
    resetForNewRun();
    setScenePlateUrl(null);
    setContentId(null);
    setIsGenerating(true);
    setGenerationStep("scene");
    scenePlateMutation.mutate(photoPayload(params));
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
    resetForNewRun();
    setScenePlateUrl(null);
    setContentId(null);
    setIsGenerating(true);
    setGenerationStep("compose");
    generateMutation.mutate(photoPayload(params));
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const composeCost = params.numberOfImages * CREDIT_COSTS.PHOTO;
  const canAct = !!params.influencerId && !isGenerating;
  const hasFinalImages = generatedUrls.length > 0 && !isGenerating;
  const awaitingSceneApproval = useSceneFirst && Boolean(scenePlateUrl) && !hasFinalImages;
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

  const influencersQuery = trpc.influencer.getAll.useQuery({ limit: 50 });
  const selectedInf = influencersQuery.data?.influencers?.find(
    (i) => i.id === params.influencerId
  );
  const igUsername =
    selectedInf?.name?.replace(/\s+/g, "_").toLowerCase() || "aura.influence";
  const avatarUrl =
    selectedInf?.avatarUrl?.trim() || selectedInf?.baseImageUrl?.trim() || null;

  const creditSuffix =
    composeCost > 1 ? `${composeCost} ${t("creditUnit")}s` : `${composeCost} ${t("creditUnit")}`;

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

  if (layout === "studio") {
    return (
      <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6 lg:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">{t("studioCanvasTitle")}</h2>
            <p className="text-xs text-slate-500">{t("studioCanvasSubtitle")}</p>
          </div>
          <Badge className="border-slate-700 bg-slate-800/50 text-xs text-slate-400">
            <Coins className="mr-1 inline h-3 w-3" />
            {useSceneFirst && !hasFinalImages && !awaitingSceneApproval
              ? t("sceneCostLabel", { cost: String(SCENE_FIRST_PLATE_CREDIT) })
              : `${composeCost} ${t("creditUnit")}${composeCost > 1 ? "s" : ""}`}
          </Badge>
        </div>

        {useSceneFirst && !hasFinalImages && (
          <WorkflowSteps
            className="mb-4 max-w-md"
            currentIndex={workflowStepIndex}
            steps={[
              { label: t("photoWorkflowStepScene") },
              { label: t("photoWorkflowStepCompose") },
              { label: t("photoWorkflowStepDone") },
            ]}
          />
        )}

        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <PhotoInstagramFeedMock
            username={igUsername}
            avatarUrl={avatarUrl}
            imageUrl={hasFinalImages ? currentImage : null}
            scenePreviewUrl={awaitingSceneApproval ? displaySceneUrl : null}
            caption={caption}
            hashtags={hashtags}
            isLoading={isGenerating}
            loadingLabel={loadingLabel}
            aspect="square"
          />

          {hasFinalImages && generatedUrls.length > 1 && (
            <div className="flex gap-2">
              {generatedUrls.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setSelectedImageIndex(i)}
                  className={cn(
                    "relative h-14 w-14 overflow-hidden rounded-lg border-2",
                    selectedImageIndex === i ? "border-violet-500" : "border-transparent opacity-60"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {hasFinalImages && (
            <div className="flex flex-wrap justify-center gap-2">
              <ActionBtn
                icon={RefreshCw}
                label={t("regenerate")}
                onClick={useSceneFirst ? handleGenerateScene : handleClassicGenerate}
              />
              <ActionBtn
                icon={Download}
                label={t("download")}
                onClick={async () => {
                  if (!currentImage) return;
                  setIsDownloading(true);
                  try {
                    await downloadMediaUrl(currentImage, {
                      kind: "image",
                      filename: `aura-photo-${selectedImageIndex + 1}`,
                    });
                    toast.success(t("downloadStarted"));
                  } catch {
                    toast.error(t("downloadFailed"));
                  } finally {
                    setIsDownloading(false);
                  }
                }}
                disabled={isDownloading}
              />
            </div>
          )}

          {(showPrimaryActions || awaitingSceneApproval) && (
            <div className="flex w-full max-w-[380px] flex-col gap-2">
              {!params.influencerId && (
                <p className="text-center text-xs text-amber-400/90">{t("selectInfluencerFirst")}</p>
              )}
              {awaitingSceneApproval ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateScene}
                    disabled={!canAct}
                    className="flex-1 rounded-xl border border-slate-600 py-3 text-sm text-slate-300 hover:bg-slate-800/50 disabled:opacity-40"
                  >
                    {t("regenerateSceneBtn")}
                  </button>
                  <button
                    type="button"
                    onClick={handleCompose}
                    disabled={!canAct}
                    className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 py-3 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {t("composeInfluencerBtn", { cost: String(composeCost) })}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onPrimaryAction}
                  disabled={!canAct}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4" />
                  {primaryLabel}
                </button>
              )}
            </div>
          )}
        </div>

        {currentImage && (
          <MediaViewerDialog
            open={viewerOpen}
            onOpenChange={setViewerOpen}
            urls={generatedUrls}
            kind="image"
            initialIndex={selectedImageIndex}
            title={t("preview")}
            downloadLabel={t("download")}
            openInNewTabLabel={t("openInNewTab")}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center p-4 md:p-6">
      <div className="mb-4 flex w-full max-w-lg flex-wrap items-center justify-end gap-2">
        {useSceneFirst && !hasFinalImages && (
          <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-400">
            {awaitingSceneApproval ? t("photoStep2Badge") : t("photoStep1Badge")}
          </Badge>
        )}
        <Badge className="border-slate-700 bg-slate-800/50 text-xs text-slate-400">
          <Coins className="mr-1 inline h-3 w-3" />
          {useSceneFirst && !hasFinalImages
            ? awaitingSceneApproval
              ? t("composeCostLabel", { cost: String(composeCost) })
              : t("sceneCostLabel", { cost: String(SCENE_FIRST_PLATE_CREDIT) })
            : `${t("cost")} : ${composeCost} ${t("creditUnit")}${composeCost > 1 ? "s" : ""}`}
        </Badge>
      </div>

      <div className="w-full max-w-lg">
        {useSceneFirst && !hasFinalImages && (
          <WorkflowSteps
            className="mb-4"
            currentIndex={workflowStepIndex}
            steps={[
              { label: t("photoWorkflowStepScene") },
              { label: t("photoWorkflowStepCompose") },
              { label: t("photoWorkflowStepDone") },
            ]}
          />
        )}
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-800/30">
                <Skeleton className="h-full w-full bg-slate-700/30" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <RefreshCw className="h-10 w-10 animate-spin text-violet-400" />
                  <p className="text-xs text-slate-400">{loadingLabel}</p>
                </div>
              </div>
            </motion.div>
          ) : hasFinalImages ? (
            <motion.div
              key="generated"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-slate-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                aria-label={t("viewFullscreen")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentImage}
                  alt=""
                  className="h-full w-full cursor-zoom-in object-cover"
                />
              </button>

              {generatedUrls.length > 1 && (
                <div className="flex justify-center gap-2">
                  {generatedUrls.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setSelectedImageIndex(i)}
                      className={cn(
                        "relative h-16 w-16 overflow-hidden rounded-lg border-2 transition-all",
                        selectedImageIndex === i
                          ? "border-violet-500"
                          : "border-transparent opacity-60"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-center gap-2">
                <ActionBtn
                  icon={RefreshCw}
                  label={t("regenerate")}
                  onClick={useSceneFirst ? handleGenerateScene : handleClassicGenerate}
                />
                <ActionBtn
                  icon={Download}
                  label={t("download")}
                  onClick={async () => {
                    if (!currentImage) return;
                    setIsDownloading(true);
                    try {
                      await downloadMediaUrl(currentImage, {
                        kind: "image",
                        filename: `aura-photo-${selectedImageIndex + 1}`,
                      });
                      toast.success(t("downloadStarted"));
                    } catch {
                      toast.error(t("downloadFailed"));
                    } finally {
                      setIsDownloading(false);
                    }
                  }}
                  disabled={isDownloading}
                />
                <ActionBtn
                  icon={Trash2}
                  label={t("deleteAction")}
                  onClick={() => {
                    const newUrls = generatedUrls.filter((_, i) => i !== selectedImageIndex);
                    setGeneratedUrls(newUrls);
                    setScenePlateUrl(null);
                    setContentId(null);
                  }}
                />
              </div>
            </motion.div>
          ) : awaitingSceneApproval && displaySceneUrl ? (
            <motion.div
              key="scene-ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              <p className="text-center text-sm text-emerald-300/90">{t("sceneReadyHint")}</p>
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-emerald-500/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displaySceneUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleGenerateScene}
                  disabled={!canAct}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 disabled:opacity-40"
                >
                  <MapPin className="h-4 w-4" />
                  {t("regenerateSceneBtn")}
                </button>
                <button
                  type="button"
                  onClick={handleCompose}
                  disabled={!canAct}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  <User className="h-4 w-4" />
                  {t("composeInfluencerBtn", { cost: String(composeCost) })}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800/10"
            >
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
                <ImagePlus className="h-16 w-16 text-slate-700" />
                <p className="text-center text-sm text-slate-500">
                  {isWelcomeFlow && params.influencerId
                    ? t("welcomePlaceholderHint")
                    : useSceneFirst
                      ? t("photoSceneFirstPlaceholder")
                      : t("placeholderHint")}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!hasFinalImages && !isGenerating && !awaitingSceneApproval && params.sceneDescription?.trim() && (
          <div className="mt-3">
            <PhotoGenerationPreview params={params} />
          </div>
        )}

        {showPrimaryActions && (
          <div className="sticky bottom-0 z-10 mt-4 space-y-2 border-t border-slate-800/60 bg-slate-950/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
            {!params.influencerId && (
              <p className="text-center text-xs text-amber-400/90">{t("selectInfluencerFirst")}</p>
            )}
            {useSceneFirst ? (
              <button
                type="button"
                onClick={handleGenerateScene}
                disabled={!canAct}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-40"
              >
                <MapPin className="h-4 w-4" />
                {t("generateSceneBtn", { cost: String(SCENE_FIRST_PLATE_CREDIT) })}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClassicGenerate}
                disabled={!canAct}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                {t("generateBtn")} ({composeCost} {t("creditUnit")}
                {composeCost > 1 ? "s" : ""})
              </button>
            )}
            {useSceneFirst && (
              <p className="text-center text-[11px] text-slate-500">{t("photoSceneFirstPlaceholder")}</p>
            )}
          </div>
        )}
      </div>

      {currentImage && (
        <MediaViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          urls={generatedUrls}
          kind="image"
          initialIndex={selectedImageIndex}
          title={t("preview")}
          downloadLabel={t("download")}
          openInNewTabLabel={t("openInNewTab")}
        />
      )}
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-white disabled:opacity-40"
    >
      <Icon className="h-4 w-4" />
      <span className="text-xs">{label}</span>
    </button>
  );
}
