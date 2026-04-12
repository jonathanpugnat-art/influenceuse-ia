"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImagePlus,
  RefreshCw,
  Download,
  Trash2,
  Sparkles,
  Coins,
  Brain,
  Palette,
  Save,
  CheckCircle2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { trpc } from "@/lib/trpc";
import { CREDIT_COSTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function PhotoPreview() {
  const t = useTranslations("content");

  const generationSteps = [
    { key: "prompt", icon: Brain, label: t("stepPrompt") },
    { key: "generate", icon: Palette, label: t("stepGenerate") },
    { key: "save", icon: Save, label: t("stepSave") },
    { key: "done", icon: CheckCircle2, label: t("stepDone") },
  ];

  const {
    params,
    contentId,
    isGenerating,
    generationStep,
    generatedUrls,
    selectedImageIndex,
    setContentId,
    setIsGenerating,
    setGenerationStep,
    setGeneratedUrls,
    setSelectedImageIndex,
  } = usePhotoCreator();

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateMutation = trpc.content.generatePhoto.useMutation({
    onSuccess: (data) => {
      setContentId(data.contentId);
      setGenerationStep("generate");
    },
    onError: (err) => {
      toast.error(err.message);
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

    if (statusData.status === "READY" && statusData.mediaUrls.length > 0) {
      setGeneratedUrls(statusData.mediaUrls);
      setGenerationStep("done");
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationStep("");
      }, 1000);
    } else if (statusData.status === "FAILED") {
      toast.error("La génération a échoué. Réessayez.");
      setIsGenerating(false);
      setGenerationStep("");
    }
  }, [statusData, isGenerating, setGeneratedUrls, setGenerationStep, setIsGenerating]);

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
      pose: params.pose,
      outfit: params.outfit,
      expression: params.expression,
      photoStyle: params.photoStyle,
      timeOfDay: params.timeOfDay,
      customPrompt: params.customPrompt || undefined,
      numberOfImages: params.numberOfImages,
      contentMode: params.contentMode,
      nsfwLevel: params.contentMode === "NSFW" ? params.nsfwLevel : undefined,
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
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <RefreshCw className="h-8 w-8 animate-spin text-violet-400" />
                  <div className="space-y-2">
                    {generationSteps.map((step) => {
                      const Icon = step.icon;
                      const isActive = generationStep === step.key;
                      const isPast =
                        generationSteps.findIndex((s) => s.key === generationStep) >
                        generationSteps.findIndex((s) => s.key === step.key);
                      return (
                        <div
                          key={step.key}
                          className={cn(
                            "flex items-center gap-2 text-sm transition-all",
                            isActive && "text-violet-400 font-medium",
                            isPast && "text-emerald-400",
                            !isActive && !isPast && "text-slate-600"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {step.label}
                        </div>
                      );
                    })}
                  </div>
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
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-slate-800/50">
                {/* Fallback gradient — sits behind the image */}
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600">
                  <span className="text-6xl font-bold text-white/20">
                    {selectedImageIndex + 1}
                  </span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentImage}
                  alt="Generated content"
                  className="relative z-10 h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>

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
                <ActionBtn icon={Download} label={t("download")} onClick={() => {
                  if (currentImage) window.open(currentImage, "_blank");
                }} />
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
                  {t("placeholderHint")}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-white"
    >
      <Icon className="h-4 w-4" />
      <span className="text-xs">{label}</span>
    </button>
  );
}

