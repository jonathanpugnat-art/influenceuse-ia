"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Calendar,
  Clock,
  Download,
  Expand,
  Loader2,
  Play,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InstagramIcon, TikTokIcon } from "@/components/ui/social-icons";
import { MediaViewerDialog } from "@/components/media/media-viewer-dialog";
import { downloadMediaUrl } from "@/lib/download-media";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusLabels: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Brouillon", className: "bg-slate-600 text-slate-200" },
  GENERATING: { label: "En cours…", className: "bg-amber-600 text-amber-100" },
  READY: { label: "Prêt", className: "bg-emerald-600 text-emerald-100" },
  SCHEDULED: { label: "Programmé", className: "bg-blue-600 text-blue-100" },
  PUBLISHED: { label: "Publié", className: "bg-violet-600 text-violet-100" },
  FAILED: { label: "Échoué", className: "bg-red-600 text-red-100" },
};

export function ContentLibraryDetailModal({
  contentId,
  open,
  onClose,
  onDeleted,
}: {
  contentId: string | null;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const utils = trpc.useUtils();

  const { data: content, isLoading } = trpc.content.getById.useQuery(
    { contentId: contentId! },
    { enabled: open && !!contentId }
  );

  const deleteMutation = trpc.content.deleteContent.useMutation({
    onSuccess: () => {
      toast.success("Contenu supprimé");
      utils.content.getAll.invalidate();
      onDeleted?.();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const mediaUrls =
    content?.mediaUrls?.length
      ? content.mediaUrls
      : content?.thumbnailUrl
        ? [content.thumbnailUrl]
        : [];

  const previewUrl = content?.thumbnailUrl ?? mediaUrls[0];
  const isVideo = content?.type === "REEL";
  const status = content
    ? (statusLabels[content.status] ?? statusLabels.DRAFT)
    : null;

  const handleDownloadAll = async () => {
    if (mediaUrls.length === 0) return;
    setIsDownloading(true);
    try {
      for (let i = 0; i < mediaUrls.length; i++) {
        await downloadMediaUrl(mediaUrls[i]!, {
          kind: isVideo ? "video" : "image",
          filename: `aura-${content?.type?.toLowerCase() ?? "media"}-${i + 1}`,
        });
        if (mediaUrls.length > 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      toast.success(
        mediaUrls.length > 1
          ? `${mediaUrls.length} fichiers téléchargés`
          : "Téléchargement lancé"
      );
    } catch {
      toast.error("Téléchargement impossible");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-slate-800 bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-white">Détail du contenu</DialogTitle>
          </DialogHeader>

          {isLoading || !content ? (
            <div className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-xl bg-slate-800" />
              <Skeleton className="h-4 w-2/3 bg-slate-800" />
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => mediaUrls.length > 0 && setViewerOpen(true)}
                disabled={mediaUrls.length === 0}
                className="group relative aspect-square w-full overflow-hidden rounded-xl bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed"
              >
                {previewUrl ? (
                  isVideo ? (
                    <video
                      src={mediaUrls[0]}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-600">
                    Aucun média
                  </div>
                )}
                {mediaUrls.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                    <span className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
                      <Expand className="h-4 w-4" />
                      Plein écran
                    </span>
                  </div>
                )}
                {isVideo && (
                  <div className="absolute left-3 top-3 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1">
                    <Play className="h-3 w-3 text-white" />
                    <span className="text-xs text-white">Reel</span>
                  </div>
                )}
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {content.influencer.name}
                </span>
                {status && (
                  <Badge className={cn("border-0 text-xs", status.className)}>
                    {status.label}
                  </Badge>
                )}
              </div>

              {content.scheduledAt && (
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(content.scheduledAt), "d MMM yyyy", {
                      locale: fr,
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {format(new Date(content.scheduledAt), "HH:mm")}
                  </span>
                </div>
              )}

              <div className="flex gap-1">
                {content.platforms.includes("INSTAGRAM") && (
                  <InstagramIcon className="h-4 w-4 text-pink-400" />
                )}
                {content.platforms.includes("TIKTOK") && (
                  <TikTokIcon className="h-4 w-4 text-white" />
                )}
              </div>

              {content.caption && (
                <p className="rounded-xl bg-slate-800/40 p-3 text-xs text-slate-300">
                  {content.caption}
                </p>
              )}

              {content.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {content.hashtags.map((h) => (
                    <span
                      key={h}
                      className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-xs text-violet-400"
                    >
                      #{h}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setViewerOpen(true)}
                  disabled={mediaUrls.length === 0}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-500/20 px-3 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/30 disabled:opacity-40"
                >
                  <Expand className="h-4 w-4" />
                  Agrandir
                </button>
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={mediaUrls.length === 0 || isDownloading}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Télécharger
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm("Supprimer ce contenu définitivement ?")
                    ) {
                      deleteMutation.mutate({ contentId: content.id });
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {content && mediaUrls.length > 0 && (
        <MediaViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          urls={mediaUrls}
          kind={isVideo ? "video" : "image"}
          title={`${content.influencer.name} — ${content.type}`}
        />
      )}
    </>
  );
}
