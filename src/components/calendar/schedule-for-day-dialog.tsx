"use client";

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  Clock,
  ImagePlus,
  Video,
  CheckCircle2,
  Loader2,
  Plus,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  InstagramIcon,
  TikTokIcon,
  OnlyFansIcon,
} from "@/components/ui/social-icons";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Platforms we currently surface in the picker. Keep INSTAGRAM as the
// sensible default (it's the only one beta users have generally connected).
const PLATFORMS = ["INSTAGRAM", "TIKTOK", "ONLYFANS"] as const;
type Platform = (typeof PLATFORMS)[number];

interface ScheduleForDayDialogProps {
  open: boolean;
  onClose: () => void;
  /** The calendar day that was clicked. Time-of-day defaults to 09:00. */
  day: Date | null;
  /** Called after a successful schedule so the parent can refetch events. */
  onScheduled?: () => void;
}

export function ScheduleForDayDialog({
  open,
  onClose,
  day,
  onScheduled,
}: ScheduleForDayDialogProps) {
  const t = useTranslations("calendar.schedule");
  const locale = useLocale();
  const dfnLocale = locale === "fr" ? fr : enUS;
  const router = useRouter();

  const [selectedContentId, setSelectedContentId] = useState<string | null>(
    null
  );
  const [time, setTime] = useState("09:00");
  // Default to Instagram only — most beta users only have IG connected.
  const [platforms, setPlatforms] = useState<Platform[]>(["INSTAGRAM"]);

  // Reset state every time the dialog is reopened for a new day.
  useEffect(() => {
    if (open) {
      setSelectedContentId(null);
      setTime("09:00");
      setPlatforms(["INSTAGRAM"]);
    }
  }, [open]);

  const readyQuery = trpc.publish.listReadyForScheduling.useQuery(
    { limit: 30 },
    {
      enabled: open,
      // Stale-while-revalidate so reopening the dialog feels instant.
      staleTime: 30_000,
    }
  );

  const utils = trpc.useUtils();
  const scheduleMutation = trpc.publish.scheduleContent.useMutation({
    onSuccess: () => {
      toast.success(t("toastSuccess"));
      utils.publish.getCalendarEvents.invalidate();
      utils.publish.listReadyForScheduling.invalidate();
      utils.publish.getUpcoming.invalidate();
      onScheduled?.();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  // The full scheduled-at = picked day + picked time, in user local TZ.
  // We never let the user pick a past datetime — the server also rejects it.
  const scheduledAt = useMemo(() => {
    if (!day) return null;
    const [h, m] = time.split(":").map((n) => parseInt(n, 10));
    const d = new Date(day);
    d.setHours(h ?? 9, m ?? 0, 0, 0);
    return d;
  }, [day, time]);

  const isPast = scheduledAt !== null && scheduledAt.getTime() <= Date.now();

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleSchedule = () => {
    if (!selectedContentId) {
      toast.error(t("errorNoContent"));
      return;
    }
    if (!scheduledAt) return;
    if (isPast) {
      toast.error(t("errorPast"));
      return;
    }
    if (platforms.length === 0) {
      toast.error(t("errorNoPlatform"));
      return;
    }
    scheduleMutation.mutate({
      contentId: selectedContentId,
      platforms,
      scheduledAt: scheduledAt.toISOString(),
    });
  };

  if (!day) return null;

  const dateLabel = format(day, "EEEE d MMMM yyyy", { locale: dfnLocale });
  const readyContents = readyQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border-slate-800 bg-slate-900 sm:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <CalendarIcon className="h-5 w-5 text-violet-400" />
            {t("title")}
          </DialogTitle>
          <DialogDescription className="capitalize text-slate-400">
            {dateLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Content picker ──────────────────────────────────── */}
          <div>
            <Label className="mb-2 block text-xs text-slate-400">
              {t("pickContent")}
            </Label>

            {readyQuery.isLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : readyContents.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-800/20 py-8 text-center">
                <ImagePlus className="h-10 w-10 text-slate-600" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-white">
                    {t("emptyTitle")}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {t("emptyDescription")}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => router.push("/content")}
                  className="bg-violet-500 hover:bg-violet-600"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {t("createContentCta")}
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[280px] rounded-xl border border-slate-800 bg-slate-950/40">
                <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
                  {readyContents.map((content) => {
                    const isSelected = selectedContentId === content.id;
                    const preview =
                      content.thumbnailUrl ?? content.mediaUrls[0] ?? null;
                    return (
                      <button
                        key={content.id}
                        type="button"
                        onClick={() => setSelectedContentId(content.id)}
                        className={cn(
                          "group relative flex flex-col overflow-hidden rounded-lg border bg-slate-900 text-left transition-all",
                          isSelected
                            ? "border-violet-500 ring-2 ring-violet-500/40"
                            : "border-slate-800 hover:border-slate-600"
                        )}
                      >
                        <div className="relative aspect-square w-full overflow-hidden bg-slate-800">
                          {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={preview}
                              alt=""
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              onError={(e) => {
                                (
                                  e.target as HTMLImageElement
                                ).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600/30 to-indigo-600/30">
                              {content.type === "REEL" ? (
                                <Video className="h-6 w-6 text-white/40" />
                              ) : (
                                <ImagePlus className="h-6 w-6 text-white/40" />
                              )}
                            </div>
                          )}
                          {/* Selection checkmark */}
                          {isSelected && (
                            <div className="absolute right-1.5 top-1.5 rounded-full bg-violet-500 p-0.5">
                              <CheckCircle2 className="h-4 w-4 text-white" />
                            </div>
                          )}
                          {/* Type badge */}
                          <div className="absolute left-1.5 top-1.5">
                            <Badge className="border-slate-700 bg-slate-900/80 px-1.5 py-0 text-[10px] text-slate-300 backdrop-blur">
                              {content.type === "REEL" ? "Reel" : "Photo"}
                            </Badge>
                          </div>
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="truncate text-[11px] font-medium text-white">
                            {content.influencer.name}
                          </p>
                          {content.caption && (
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">
                              {content.caption}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* ── Time picker ─────────────────────────────────────── */}
          <div>
            <Label className="mb-2 block text-xs text-slate-400">
              {t("pickTime")}
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-9 w-32 border-slate-700 bg-slate-800/50 pl-8 text-sm text-white"
                />
              </div>
              {/* Quick presets */}
              {(["09:00", "12:00", "18:00", "21:00"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTime(preset)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs transition-colors",
                    time === preset
                      ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                      : "border-slate-700 bg-slate-800/30 text-slate-400 hover:bg-slate-800"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            {isPast && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" />
                {t("warnPast")}
              </p>
            )}
          </div>

          {/* ── Platform picker ─────────────────────────────────── */}
          <div>
            <Label className="mb-2 block text-xs text-slate-400">
              {t("pickPlatforms")}
            </Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const active = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors",
                      active
                        ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                        : "border-slate-700 bg-slate-800/30 text-slate-400 hover:bg-slate-800"
                    )}
                  >
                    {p === "INSTAGRAM" && (
                      <InstagramIcon className="h-3.5 w-3.5" />
                    )}
                    {p === "TIKTOK" && <TikTokIcon className="h-3.5 w-3.5" />}
                    {p === "ONLYFANS" && (
                      <OnlyFansIcon className="h-3.5 w-3.5" />
                    )}
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Submit ──────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={scheduleMutation.isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={
                scheduleMutation.isPending ||
                !selectedContentId ||
                isPast ||
                platforms.length === 0
              }
              className="bg-violet-500 hover:bg-violet-600"
            >
              {scheduleMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {t("scheduling")}
                </>
              ) : (
                <>
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {t("confirmAt", { time })}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
