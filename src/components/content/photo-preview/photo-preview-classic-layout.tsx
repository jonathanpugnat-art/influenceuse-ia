"use client";

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
import { SCENE_FIRST_PLATE_CREDIT } from "@/lib/prompts/scene-first-photo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MediaViewerDialog } from "@/components/media/media-viewer-dialog";
import { downloadMediaUrl } from "@/lib/download-media";
import { WorkflowSteps } from "@/components/content/workflow-steps";
import { PhotoGenerationPreview } from "@/components/content/photo-generation-preview";
import type { PhotoGenerationState } from "@/hooks/photo-studio";
import { PhotoIntentNotice } from "./photo-intent-notice";
import { PhotoPreviewActionBtn } from "./photo-preview-actions";

export function PhotoPreviewClassicLayout({
  gen,
  locale,
  isWelcomeFlow = false,
}: {
  gen: PhotoGenerationState;
  locale: "fr" | "en";
  isWelcomeFlow?: boolean;
}) {
  const t = useTranslations("content");

  const {
    params,
    isGenerating,
    generatedUrls,
    selectedImageIndex,
    setSelectedImageIndex,
    viewerOpen,
    setViewerOpen,
    isDownloading,
    setIsDownloading,
    promptWasSoftened,
    useSceneFirst,
    hasScene,
    intentWarnings,
    handleGenerateScene,
    handleCompose,
    handleClassicGenerate,
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
    handleRegenerate,
  } = gen;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center p-4 md:p-6">
      <div className="mb-4 flex w-full max-w-lg flex-wrap items-center justify-end gap-2">
        {useSceneFirst && !hasFinalImages && (
          <Badge
            variant="outline"
            className="border-emerald-500/40 text-[10px] text-emerald-400"
          >
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
                <PhotoPreviewActionBtn
                  icon={RefreshCw}
                  label={t("regenerate")}
                  onClick={handleRegenerate}
                />
                <PhotoPreviewActionBtn
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
                <PhotoPreviewActionBtn
                  icon={Trash2}
                  label={t("deleteAction")}
                  onClick={handleDeleteCurrent}
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
              <p className="text-center text-sm text-emerald-300/90">
                {t("sceneReadyHint")}
              </p>
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
                  disabled={!canGenerate}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 disabled:opacity-40"
                >
                  <MapPin className="h-4 w-4" />
                  {t("regenerateSceneBtn")}
                </button>
                <button
                  type="button"
                  onClick={handleCompose}
                  disabled={!canGenerate}
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

        {!hasFinalImages &&
          !isGenerating &&
          !awaitingSceneApproval &&
          params.sceneDescription?.trim() && (
            <div className="mt-3">
              <PhotoGenerationPreview params={params} />
            </div>
          )}

        {showPrimaryActions && (
          <div className="sticky bottom-0 z-10 mt-4 space-y-2 border-t border-slate-800/60 bg-slate-950/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
            <PhotoIntentNotice
              warnings={intentWarnings}
              softened={promptWasSoftened}
              locale={locale}
            />
            {!params.influencerId && (
              <p className="text-center text-xs text-amber-400/90">
                {t("selectInfluencerFirst")}
              </p>
            )}
            {useSceneFirst ? (
              <button
                type="button"
                onClick={handleGenerateScene}
                disabled={!canGenerate}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-40"
              >
                <MapPin className="h-4 w-4" />
                {t("generateSceneBtn", { cost: String(SCENE_FIRST_PLATE_CREDIT) })}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClassicGenerate}
                disabled={!canGenerate}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                {t("generateBtn")} ({composeCost} {t("creditUnit")}
                {composeCost > 1 ? "s" : ""})
              </button>
            )}
            {useSceneFirst && (
              <p className="text-center text-[11px] text-slate-500">
                {t("photoSceneFirstPlaceholder")}
              </p>
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
