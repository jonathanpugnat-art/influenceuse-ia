"use client";

import { RefreshCw, Download, Sparkles, Coins, AlertTriangle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { SCENE_FIRST_PLATE_CREDIT } from "@/lib/prompts/scene-first-photo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MediaViewerDialog } from "@/components/media/media-viewer-dialog";
import { downloadMediaUrl } from "@/lib/download-media";
import { WorkflowSteps } from "@/components/content/workflow-steps";
import { PhotoInstagramFeedMock } from "@/components/content/photo-instagram-feed-mock";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { useInfluencers } from "@/hooks/use-influencers";
import type { PhotoGenerationState } from "@/hooks/photo-studio";
import { PhotoIntentNotice } from "./photo-intent-notice";
import { PhotoPreviewActionBtn } from "./photo-preview-actions";

export function PhotoPreviewStudioLayout({
  gen,
  locale,
}: {
  gen: PhotoGenerationState;
  locale: "fr" | "en";
}) {
  const t = useTranslations("content");
  const { caption, hashtags } = usePhotoCreator();

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
    hasOutfit,
    intentWarnings,
    handleGenerateScene,
    handleCompose,
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
    handleRegenerate,
    generationError,
    dismissGenerationError,
  } = gen;

  const influencersQuery = useInfluencers();
  const selectedInf = influencersQuery.data?.influencers?.find(
    (i) => i.id === params.influencerId
  );
  const igUsername =
    selectedInf?.name?.replace(/\s+/g, "_").toLowerCase() || "aura.influence";
  const avatarUrl =
    selectedInf?.avatarUrl?.trim() || selectedInf?.baseImageUrl?.trim() || null;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6 lg:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {t("studioCanvasTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("studioCanvasSubtitle")}</p>
        </div>
        <Badge variant="outline" className="text-xs text-muted-foreground">
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
        <div className="w-full max-w-md space-y-2">
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
          {params.outfit.trim() ? (
            <p className="px-3 text-center text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{t("outfit")}:</span>{" "}
              {params.outfit}
            </p>
          ) : (
            <p className="text-center text-[11px] text-amber-500/90">
              {t("studioOutfitEmpty")}
            </p>
          )}
          {params.sceneDescription.trim() ? (
            <p className="px-3 text-center text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">
                {t("promptStudioLabel")}:
              </span>{" "}
              {params.sceneDescription}
            </p>
          ) : null}
          <PhotoIntentNotice
            warnings={intentWarnings}
            softened={promptWasSoftened}
            locale={locale}
          />
          {generationError && !isGenerating ? (
            <div
              role="alert"
              className="relative flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-left text-[11px] leading-snug text-rose-100"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
              <p className="flex-1 whitespace-pre-line">{generationError}</p>
              <button
                type="button"
                onClick={dismissGenerationError}
                aria-label={t("dismissError")}
                className="shrink-0 rounded-md p-0.5 text-rose-300 transition-colors hover:text-rose-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>

        {hasFinalImages && generatedUrls.length > 1 && (
          <div className="flex gap-2">
            {generatedUrls.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setSelectedImageIndex(i)}
                className={cn(
                  "relative h-14 w-14 overflow-hidden rounded-lg border-2 transition-opacity",
                  selectedImageIndex === i
                    ? "border-rose-400"
                    : "border-transparent opacity-60 hover:opacity-90"
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
          </div>
        )}

        {(showPrimaryActions || awaitingSceneApproval) && (
          <div className="flex w-full max-w-md flex-col gap-2">
            {!params.influencerId && (
              <p className="text-center text-xs text-amber-400/90">
                {t("selectInfluencerFirst")}
              </p>
            )}
            {params.influencerId && !hasOutfit && (
              <p className="text-center text-xs text-amber-400/90">
                {t("studioOutfitEmpty")}
              </p>
            )}
            {params.influencerId && hasOutfit && !hasScene && (
              <p className="text-center text-xs text-amber-400/90">
                {t("studioSceneEmpty")}
              </p>
            )}
            {awaitingSceneApproval ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerateScene}
                  disabled={!canGenerate}
                  className="min-h-10 flex-1 rounded-full border border-border py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("regenerateSceneBtn")}
                </button>
                <button
                  type="button"
                  onClick={handleCompose}
                  disabled={isGenerating}
                  className="min-h-10 flex-1 rounded-full bg-foreground py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
                >
                  {t("composeInfluencerBtn", { cost: String(composeCost) })}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onPrimaryAction}
                disabled={!canGenerate}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
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
