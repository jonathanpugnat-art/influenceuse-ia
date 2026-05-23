"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadMediaUrl } from "@/lib/download-media";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type MediaViewerKind = "image" | "video";

export interface MediaViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  urls: string[];
  kind?: MediaViewerKind;
  initialIndex?: number;
  title?: string;
  downloadLabel?: string;
  openInNewTabLabel?: string;
}

export function MediaViewerDialog({
  open,
  onOpenChange,
  urls,
  kind = "image",
  initialIndex = 0,
  title,
  downloadLabel = "Télécharger",
  openInNewTabLabel = "Ouvrir",
}: MediaViewerDialogProps) {
  const [index, setIndex] = useState(initialIndex);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  const safeUrls = urls.filter(Boolean);
  const currentUrl = safeUrls[index] ?? safeUrls[0];
  const hasMultiple = safeUrls.length > 1;

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? safeUrls.length - 1 : i - 1));
  }, [safeUrls.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i >= safeUrls.length - 1 ? 0 : i + 1));
  }, [safeUrls.length]);

  useEffect(() => {
    if (!open || !hasMultiple) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hasMultiple, goPrev, goNext, onOpenChange]);

  const handleDownload = async () => {
    if (!currentUrl) return;
    setIsDownloading(true);
    try {
      await downloadMediaUrl(currentUrl, {
        kind: kind === "video" ? "video" : "image",
        filename: `aura-${kind}-${index + 1}`,
      });
      toast.success("Téléchargement lancé");
    } catch {
      toast.error("Impossible de télécharger ce fichier");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!currentUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[95vh] max-w-5xl flex-col gap-0 overflow-hidden border-slate-800 bg-slate-950 p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {title ?? "Aperçu média"}
        </DialogTitle>

        {/* Toolbar */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <p className="truncate text-sm font-medium text-white">
            {title}
            {hasMultiple && (
              <span className="ml-2 text-slate-500">
                {index + 1} / {safeUrls.length}
              </span>
            )}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-1.5 rounded-lg bg-violet-500/20 px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/30 disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {downloadLabel}
            </button>
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {openInNewTabLabel}
            </a>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Media */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/80 p-4">
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                aria-label="Précédent"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                aria-label="Suivant"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div
            className={cn(
              "max-h-[75vh] w-full",
              kind === "video" ? "max-w-md" : "max-w-3xl"
            )}
          >
            {kind === "video" ? (
              <video
                key={currentUrl}
                src={currentUrl}
                controls
                autoPlay
                playsInline
                className="mx-auto max-h-[75vh] w-full rounded-lg"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={currentUrl}
                src={currentUrl}
                alt=""
                className="mx-auto max-h-[75vh] w-full cursor-zoom-out object-contain"
                onClick={() => onOpenChange(false)}
              />
            )}
          </div>
        </div>

        {hasMultiple && kind === "image" && (
          <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-slate-800 p-3">
            {safeUrls.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setIndex(i)}
                className={cn(
                  "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                  i === index
                    ? "border-violet-500"
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
