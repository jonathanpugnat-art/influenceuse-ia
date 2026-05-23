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
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { PhotoGenerationPreview } from "@/components/content/photo-generation-preview";
import { trpc } from "@/lib/trpc";
import { CREDIT_COSTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useUpgradeOnLimitError } from "@/hooks/use-upgrade-on-limit-error";
import { toast } from "sonner";
import { MediaViewerDialog } from "@/components/media/media-viewer-dialog";
import { downloadMediaUrl } from "@/lib/download-media";

export function PhotoPreview({
  isWelcomeFlow = false,
}: {
  isWelcomeFlow?: boolean;
}) {
  const t = useTranslations("content");

  const {
    params,
    contentId,
    isGenerating,
    generatedUrls,
    selectedImageIndex,
    setContentId,
    setIsGenerating,
    setGenerationStep,
    setGeneratedUrls,
    setSelectedImageIndex,
  } = usePhotoCreator();

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleUpgrade = useUpgradeOnLimitError();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const generateMutation = trpc.content.generatePhoto.useMutation({
    onSuccess: (data) => {
      setContentId(data.contentId);
      setGenerationStep("generate");
    },
    onError: (err) => {
      if (!handleUpgrade(err.message)) {
        toast.error(err.message);
      }
      setIsGenerating(false);
      setGenerationStep("");
    },
  });

  // Poll for generation status
  const { data: statusData } = trpc.content.getGenerationStatus.useQuery(
    { contentId: contentId! },
    {
      enabled: !!contentId && isGenerating,
      refetchInterval: 2000,
    }
  );

  useEffect(() => {
    if (!statusData || !isGenerating) return;

    if (statusData.status === "READY") {
      if (statusData.mediaUrls.length > 0) {
        setGeneratedUrls(statusData.mediaUrls);
        setGenerationStep("done");
        setTimeout(() => {
          setIsGenerating(false);
          setGenerationStep("");
        }, 1000);
      } else {
        toast.error(
          "Génération terminée sans image. Réessayez ou contactez le support.",
          { duration: 8000 }
        );
        setIsGenerating(false);
        setGenerationStep("");
      }
    } else if (statusData.status === "FAILED") {
      const errMsg =
        "errorMessage" in statusData && statusData.errorMessage
          ? String(statusData.errorMessage)
          : "La génération a échoué. Réessayez.";
      toast.error(errMsg, { duration: 8000 });
      setIsGenerating(false);
      setGenerationStep("");
    }
  }, [statusData, isGenerating, setGeneratedUrls, setGenerationStep, setIsGenerating]);

  // Stop infinite spinner if the server never updates GENERATING (Vercel timeout, etc.)
  useEffect(() => {
    if (!isGenerating || !contentId) return;
    const timeoutMs = 8 * 60 * 1000;
    const timer = setTimeout(() => {
      toast.error(
        "La génération prend trop de temps. Vérifiez vos crédits Replicate et réessayez.",
        { duration: 10000 }
      );
      setIsGenerating(false);
      setGenerationStep("");
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [isGenerating, contentId, setIsGenerating, setGenerationStep]);

  const handleGenerate = () => {
    if (!params.influencerId) {
      toast.error(t("selectInfluencerFirst"));
      return;
    }
    setIsGenerating(true);
    setGenerationStep("prompt");
    setGeneratedUrls([]);
    setSelectedImageIndex(0);
    setContentId(null);

    generateMutation.mutate({
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
    });
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const cost = params.numberOfImages * CREDIT_COSTS.PHOTO;
  const canGenerate = !!params.influencerId && !isGenerating;
  const hasImages = generatedUrls.length > 0 && !isGenerating;
  const currentImage = generatedUrls[selectedImageIndex];

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-6">
      {/* Credit badge */}
      <div className="mb-4 self-end">
        <Badge className="border-slate-700 bg-slate-800/50 text-xs text-slate-400">
          <Coins className="mr-1 inline h-3 w-3" />
          {t("cost")} : {cost} {t("creditUnit")}{cost > 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Main content area */}
      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {isGenerating ? (
            /* Loading state */
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-800/30">
                <Skeleton className="h-full w-full bg-slate-700/30" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-10 w-10 animate-spin text-violet-400" />
                  <p className="text-xs text-slate-500">
                    {t("estimatedTime")}
                  </p>
                </div>
              </div>
            </motion.div>
          ) : hasImages ? (
            /* Generated images */
            <motion.div
              key="generated"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* Main image */}
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-slate-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                aria-label={t("viewFullscreen")}
              >
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600">
                  <span className="text-6xl font-bold text-white/20">
                    {selectedImageIndex + 1}
                  </span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentImage}
                  alt="Generated content"
                  className="relative z-10 h-full w-full cursor-zoom-in object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </button>

              {/* Thumbnails (multiple images) */}
              {generatedUrls.length > 1 && (
                <div className="flex justify-center gap-2">
                  {generatedUrls.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedImageIndex(i)}
                      className={cn(
                        "relative h-16 w-16 overflow-hidden rounded-lg border-2 transition-all",
                        selectedImageIndex === i
                          ? "border-violet-500 shadow-lg shadow-violet-500/20"
                          : "border-transparent opacity-60 hover:opacity-90"
                      )}
                    >
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600">
                        <span className="text-xs font-bold text-white/40">
                          {i + 1}
                        </span>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Variation ${i + 1}`}
                        className="relative z-10 h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Action bar */}
              <div className="flex items-center justify-center gap-2">
                <ActionBtn
                  icon={RefreshCw}
                  label={t("regenerate")}
                  onClick={handleGenerate}
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
                <ActionBtn icon={Trash2} label={t("deleteAction")} onClick={() => {
                  const newUrls = generatedUrls.filter((_, i) => i !== selectedImageIndex);
                  setGeneratedUrls(newUrls);
                  if (selectedImageIndex >= newUrls.length) setSelectedImageIndex(Math.max(0, newUrls.length - 1));
                }} />
              </div>
            </motion.div>
          ) : (
            /* Placeholder state */
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800/10"
            >
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
                <ImagePlus className="h-16 w-16 text-slate-700" />
                <p className="text-center text-sm text-slate-500">
                  {isWelcomeFlow && params.influencerId
                    ? t("welcomePlaceholderHint")
                    : t("placeholderHint")}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!hasImages && !isGenerating && params.sceneDescription?.trim() && (
          <div className="mt-3">
            <PhotoGenerationPreview params={params} />
          </div>
        )}

        {/* Generate button */}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 disabled:opacity-40 disabled:shadow-none"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {t("generating")}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {t("generateBtn")} ({cost} {t("creditUnit")}{cost > 1 ? "s" : ""})
              </>
            )}
          </button>
        </div>
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

