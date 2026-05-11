"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Video,
  RefreshCw,
  Download,
  Trash2,
  Sparkles,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Brain,
  Film,
  Clapperboard,
  Music,
  Save,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useReelCreator } from "@/hooks/use-reel-creator";
import { trpc } from "@/lib/trpc";
import { CREDIT_COSTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUpgradeOnLimitError } from "@/hooks/use-upgrade-on-limit-error";

const generationSteps = [
  { key: "analyze", icon: Brain, label: "Analyse du scénario...", pct: 5 },
  { key: "frames", icon: Film, label: "Génération des frames...", pct: 35 },
  { key: "assemble", icon: Clapperboard, label: "Assemblage de la vidéo...", pct: 70 },
  { key: "audio", icon: Music, label: "Ajout audio...", pct: 85 },
  { key: "render", icon: Save, label: "Rendu final...", pct: 95 },
  { key: "done", icon: CheckCircle2, label: "Terminé !", pct: 100 },
];

function VideoPlayer({ url, format }: { url: string; format: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play();
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    setProgress((vid.currentTime / vid.duration) * 100);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    vid.currentTime = pct * vid.duration;
  };

  const handleFullscreen = () => {
    videoRef.current?.requestFullscreen?.();
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-black">
      {/* Video element */}
      <video
        ref={videoRef}
        src={url}
        className={cn(
          "w-full cursor-pointer",
          format === "VERTICAL" ? "aspect-[9/16]" : "aspect-square"
        )}
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        loop
        playsInline
      />

      {/* Play overlay when paused */}
      {!isPlaying && (
        <div
          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30"
          onClick={togglePlay}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Play className="ml-1 h-8 w-8 text-white" />
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        {/* Progress bar */}
        <div
          className="mb-2 h-1 cursor-pointer rounded-full bg-slate-700"
          onClick={handleSeek}
        >
          <div
            className="h-full rounded-full bg-violet-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="text-white hover:text-violet-300">
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={toggleMute} className="text-white hover:text-violet-300">
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
          <button onClick={handleFullscreen} className="text-white hover:text-violet-300">
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReelPreview() {
  const {
    params,
    contentId,
    isGenerating,
    generationStep,
    generationProgress,
    videoUrl,
    setContentId,
    setIsGenerating,
    setGenerationStep,
    setGenerationProgress,
    setVideoUrl,
    setThumbnailUrl,
  } = useReelCreator();

  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleUpgrade = useUpgradeOnLimitError();

  const generateMutation = trpc.content.generateReel.useMutation({
    onSuccess: (data) => {
      setContentId(data.contentId);
      startProgressSimulation();
    },
    onError: (err) => {
      if (!handleUpgrade(err.message)) {
        toast.error(err.message);
      }
      setIsGenerating(false);
      setGenerationStep("");
    },
  });

  // Poll for status
  const { data: statusData } = trpc.content.getGenerationStatus.useQuery(
    { contentId: contentId! },
    { enabled: !!contentId && isGenerating, refetchInterval: 5000 }
  );

  useEffect(() => {
    if (!statusData || !isGenerating) return;
    if (statusData.status === "READY" && statusData.mediaUrls.length > 0) {
      setVideoUrl(statusData.mediaUrls[0]);
      setThumbnailUrl(statusData.thumbnailUrl ?? null);
      setGenerationStep("done");
      setGenerationProgress(100);
      if (simulationRef.current) clearInterval(simulationRef.current);
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationStep("");
      }, 1500);
    } else if (statusData.status === "FAILED") {
      toast.error("La génération a échoué. Réessayez.");
      setIsGenerating(false);
      setGenerationStep("");
      if (simulationRef.current) clearInterval(simulationRef.current);
    }
  }, [statusData, isGenerating, setVideoUrl, setThumbnailUrl, setGenerationStep, setGenerationProgress, setIsGenerating]);

  const startProgressSimulation = useCallback(() => {
    let step = 0;
    setGenerationStep(generationSteps[0].key);
    setGenerationProgress(generationSteps[0].pct);

    simulationRef.current = setInterval(() => {
      step++;
      if (step < generationSteps.length - 1) {
        setGenerationStep(generationSteps[step].key);
        setGenerationProgress(generationSteps[step].pct);
      }
    }, 25_000); // Advance every 25s (video takes ~2-5 min)
  }, [setGenerationStep, setGenerationProgress]);

  const handleGenerate = useCallback(() => {
    if (!params.influencerId || !params.script) {
      toast.error("Sélectionne une influenceuse et écris un scénario");
      return;
    }
    setIsGenerating(true);
    setVideoUrl(null);
    setGenerationProgress(0);
    setGenerationStep("analyze");

    generateMutation.mutate({
      influencerId: params.influencerId,
      duration: params.duration,
      format: params.format,
      videoType: params.videoType,
      script: params.script,
      music: params.music || undefined,
      effects: params.effects.length > 0 ? params.effects : undefined,
      textOverlay: params.textOverlay || undefined,
      contentMode: params.contentMode,
      nsfwLevel: params.contentMode === "NSFW" ? params.nsfwLevel : undefined,
      reelStylePreset: params.reelStylePreset,
    });
  }, [params, setIsGenerating, setVideoUrl, setGenerationProgress, setGenerationStep, generateMutation]);

  useEffect(() => {
    return () => {
      if (simulationRef.current) clearInterval(simulationRef.current);
    };
  }, []);

  const cost = CREDIT_COSTS.REEL;
  const canGenerate = !!params.influencerId && !!params.script && !isGenerating;

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-6">
      {/* Credit badge */}
      <div className="mb-4 self-end">
        <Badge className="border-slate-700 bg-slate-800/50 text-xs text-slate-400">
          🪙 Coût : {cost} crédits
        </Badge>
      </div>

      <div className={cn("w-full", params.format === "VERTICAL" ? "max-w-xs" : "max-w-md")}>
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className={cn(
                "relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-800/30",
                params.format === "VERTICAL" ? "aspect-[9/16]" : "aspect-square"
              )}>
                <Skeleton className="h-full w-full bg-slate-700/30" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                  <Video className="h-10 w-10 animate-pulse text-violet-400" />

                  {/* Step indicators */}
                  <div className="w-full max-w-[200px] space-y-2">
                    {generationSteps.map((step) => {
                      const Icon = step.icon;
                      const isActive = generationStep === step.key;
                      const stepIdx = generationSteps.findIndex((s) => s.key === step.key);
                      const currentIdx = generationSteps.findIndex((s) => s.key === generationStep);
                      const isPast = currentIdx > stepIdx;
                      return (
                        <div
                          key={step.key}
                          className={cn(
                            "flex items-center gap-2 text-xs transition-all",
                            isActive && "text-violet-400 font-medium",
                            isPast && "text-emerald-400",
                            !isActive && !isPast && "text-slate-600"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{step.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full max-w-[200px]">
                    <Progress value={generationProgress} className="h-1.5 bg-slate-700" />
                  </div>

                  <p className="text-xs text-slate-500">Estimation : ~2-5 minutes</p>
                  <p className="text-xs text-slate-600">
                    Tu peux quitter cette page, tu seras notifié
                  </p>
                </div>
              </div>
            </motion.div>
          ) : videoUrl ? (
            <motion.div
              key="generated"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <VideoPlayer url={videoUrl} format={params.format} />

              {/* Action bar */}
              <div className="flex items-center justify-center gap-2">
                <ActionBtn icon={RefreshCw} label="Regénérer" onClick={handleGenerate} />
                <ActionBtn icon={Download} label="Télécharger" onClick={() => {
                  if (videoUrl) window.open(videoUrl, "_blank");
                }} />
                <ActionBtn icon={Trash2} label="Supprimer" onClick={() => {
                  setVideoUrl(null);
                  toast.info("Vidéo supprimée");
                }} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                "rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800/10",
                params.format === "VERTICAL" ? "aspect-[9/16]" : "aspect-square"
              )}
            >
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
                <Video className="h-16 w-16 text-slate-700" />
                <p className="text-center text-sm text-slate-500">
                  Configure les paramètres pour générer un reel
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generate button */}
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 disabled:opacity-40 disabled:shadow-none"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Générer le reel ({cost} crédits)
              </>
            )}
          </button>

          {/* Free plan warning */}
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <p className="text-xs text-amber-300">
              La génération de vidéo nécessite le plan Pro.{" "}
              <Link href="/billing" className="underline hover:text-amber-200">
                Upgrade →
              </Link>
            </p>
          </div>
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

