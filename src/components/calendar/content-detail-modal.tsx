"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Play,
  X,
  Calendar,
  Clock,
  ImagePlus,
  Video,
  Download,
  Expand,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InstagramIcon, TikTokIcon, OnlyFansIcon } from "@/components/ui/social-icons";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MediaViewerDialog } from "@/components/media/media-viewer-dialog";
import { downloadMediaUrl } from "@/lib/download-media";
import type { CalendarEvent } from "./types";

const statusBadge: Record<string, { label: string; className: string }> = {
  SCHEDULED: { label: "Programmé", className: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  PUBLISHED: { label: "Publié", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  FAILED: { label: "Échoué", className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export function ContentDetailModal({
  event,
  open,
  onClose,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
}) {
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const utils = trpc.useUtils();

  const publishMutation = trpc.publish.publishNow.useMutation({
    onSuccess: () => {
      toast.success("Contenu publié !");
      utils.publish.getCalendarEvents.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelMutation = trpc.publish.cancelSchedule.useMutation({
    onSuccess: () => {
      toast.success("Programmation annulée");
      utils.publish.getCalendarEvents.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const rescheduleMutation = trpc.publish.scheduleContent.useMutation({
    onSuccess: () => {
      toast.success("Contenu reprogrammé !");
      utils.publish.getCalendarEvents.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!event) return null;

  const mediaUrls =
    event.mediaUrls?.length > 0
      ? event.mediaUrls
      : event.thumbnailUrl
        ? [event.thumbnailUrl]
        : [];
  const previewUrl = event.thumbnailUrl ?? mediaUrls[0];
  const isVideo = event.type === "REEL";

  const status = statusBadge[event.status] ?? statusBadge.SCHEDULED;

  const handleReschedule = () => {
    if (!rescheduleDate) {
      toast.error("Choisis une date");
      return;
    }
    rescheduleMutation.mutate({
      contentId: event.id,
      platforms: event.platforms as ["INSTAGRAM"],
      scheduledAt: new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-slate-800 bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-white">Détail du contenu</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <button
            type="button"
            onClick={() => mediaUrls.length > 0 && setViewerOpen(true)}
            disabled={mediaUrls.length === 0}
            className="group relative aspect-video w-full overflow-hidden rounded-xl bg-slate-800 disabled:cursor-not-allowed"
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
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-600/50 to-indigo-600/50">
                {event.type === "REEL" ? (
                  <Video className="h-8 w-8 text-white/50" />
                ) : (
                  <ImagePlus className="h-8 w-8 text-white/50" />
                )}
              </div>
            )}
            {mediaUrls.length > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white">
                  <Expand className="h-3.5 w-3.5" />
                  Agrandir
                </span>
              </div>
            )}
          </button>

          {/* Info */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {event.influencer.name}
            </span>
            <Badge className={cn("border px-2 py-0 text-xs", status.className)}>
              {status.label}
            </Badge>
            <Badge className="border-slate-700 bg-slate-800/50 px-2 py-0 text-xs text-slate-400">
              {event.type === "REEL" ? "Reel" : "Photo"}
            </Badge>
          </div>

          {/* Date / Platforms */}
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(event.date), "d MMM yyyy", { locale: fr })}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(event.date), "HH:mm")}
            </div>
            <div className="flex items-center gap-1">
              {event.platforms.map((p) => (
                <span key={p}>
                  {p === "INSTAGRAM" && <InstagramIcon className="h-3.5 w-3.5 text-pink-400" />}
                  {p === "TIKTOK" && <TikTokIcon className="h-3.5 w-3.5 text-white" />}
                  {p === "ONLYFANS" && <OnlyFansIcon className="h-3.5 w-3.5 text-blue-400" />}
                </span>
              ))}
            </div>
          </div>

          {/* Caption */}
          {event.caption && (
            <div className="rounded-xl bg-slate-800/30 p-3">
              <p className="text-xs text-slate-300">{event.caption}</p>
            </div>
          )}

          {/* Hashtags */}
          {event.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {event.hashtags.map((h) => (
                <span
                  key={h}
                  className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-xs text-violet-400"
                >
                  #{h}
                </span>
              ))}
            </div>
          )}

          {/* Reschedule (only for SCHEDULED) */}
          {event.status === "SCHEDULED" && (
            <div className="space-y-2 rounded-xl border border-slate-800/50 bg-slate-800/20 p-3">
              <Label className="text-xs text-slate-400">Reprogrammer</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="h-8 flex-1 border-slate-700 bg-slate-800/50 text-xs text-white"
                />
                <Input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="h-8 w-24 border-slate-700 bg-slate-800/50 text-xs text-white"
                />
                <button
                  onClick={handleReschedule}
                  disabled={rescheduleMutation.isPending}
                  className="rounded-lg bg-violet-500/20 px-3 py-1 text-xs text-violet-400 hover:bg-violet-500/30"
                >
                  OK
                </button>
              </div>
            </div>
          )}

          {/* Media actions */}
          {mediaUrls.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                <Expand className="h-4 w-4" />
                Plein écran
              </button>
              <button
                type="button"
                disabled={isDownloading}
                onClick={async () => {
                  setIsDownloading(true);
                  try {
                    await downloadMediaUrl(mediaUrls[0]!, {
                      kind: isVideo ? "video" : "image",
                    });
                    toast.success("Téléchargement lancé");
                  } catch {
                    toast.error("Téléchargement impossible");
                  } finally {
                    setIsDownloading(false);
                  }
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-500/20 px-3 py-2 text-sm text-violet-300 hover:bg-violet-500/30 disabled:opacity-50"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Télécharger
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {event.status === "SCHEDULED" && (
              <>
                <button
                  onClick={() =>
                    publishMutation.mutate({
                      contentId: event.id,
                      platforms: event.platforms as ["INSTAGRAM"],
                    })
                  }
                  disabled={publishMutation.isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30"
                >
                  <Play className="h-4 w-4" />
                  Publier maintenant
                </button>
                <button
                  onClick={() => cancelMutation.mutate({ contentId: event.id })}
                  disabled={cancelMutation.isPending}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                  Annuler
                </button>
              </>
            )}
          </div>
        </div>
      </DialogContent>

      {mediaUrls.length > 0 && (
        <MediaViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          urls={mediaUrls}
          kind={isVideo ? "video" : "image"}
          title={event.influencer.name}
        />
      )}
    </Dialog>
  );
}

