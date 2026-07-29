"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
  AlertTriangle,
  Sparkles,
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
import {
  InstagramIcon,
  TikTokIcon,
  OnlyFansIcon,
} from "@/components/ui/social-icons";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PLATFORMS = ["INSTAGRAM", "TIKTOK", "ONLYFANS"] as const;
type Platform = (typeof PLATFORMS)[number];

function toTimeInputValue(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

interface ScheduleForDayDialogProps {
  open: boolean;
  onClose: () => void;
  day: Date | null;
  influencerId?: string;
  onScheduled?: () => void;
}

export function ScheduleForDayDialog({
  open,
  onClose,
  day,
  influencerId,
  onScheduled,
}: ScheduleForDayDialogProps) {
  const t = useTranslations("calendar.schedule");
  const tConfirm = useTranslations("publish.confirm");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dfnLocale = locale === "fr" ? fr : enUS;
  const router = useRouter();
  const appliedSlotRef = useRef(false);

  const [selectedContentId, setSelectedContentId] = useState<string | null>(
    null
  );
  const [time, setTime] = useState("09:00");
  const [platforms, setPlatforms] = useState<Platform[]>(["INSTAGRAM"]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form when dialog reopens
      setSelectedContentId(null);
      setTime("09:00");
      setPlatforms(["INSTAGRAM"]);
      appliedSlotRef.current = false;
    }
  }, [open]);

  const readyQuery = trpc.publish.listReadyForScheduling.useQuery(
    { limit: 30, influencerId },
    {
      enabled: open,
      staleTime: 30_000,
    }
  );

  const slotsQuery = trpc.analytics.suggestSlots.useQuery(
    { influencerId: influencerId!, count: 1 },
    {
      enabled: open && Boolean(influencerId),
      staleTime: 60_000,
    }
  );

  useEffect(() => {
    if (!open || appliedSlotRef.current) return;
    const slot = slotsQuery.data?.[0];
    if (!slot) return;
    appliedSlotRef.current = true;
    const at = new Date(slot.at);
    setTime(toTimeInputValue(at));
  }, [open, slotsQuery.data]);

  const readinessQuery = trpc.publish.checkPublishReadiness.useQuery(
    {
      influencerId: influencerId ?? "",
      platforms,
    },
    {
      enabled:
        open &&
        Boolean(influencerId) &&
        platforms.length > 0 &&
        Boolean(selectedContentId),
      staleTime: 15_000,
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

  const scheduledAt = useMemo(() => {
    if (!day) return null;
    const [h, m] = time.split(":").map((n) => parseInt(n, 10));
    const d = new Date(day);
    d.setHours(h ?? 9, m ?? 0, 0, 0);
    return d;
  }, [day, time]);

  const selectedContent = useMemo(
    () => readyQuery.data?.find((c) => c.id === selectedContentId) ?? null,
    [readyQuery.data, selectedContentId]
  );

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const readinessOk = readinessQuery.data?.ready ?? false;
  const igBlocked =
    platforms.includes("INSTAGRAM") &&
    Boolean(readinessQuery.data) &&
    !readinessOk;

  const handleSchedule = () => {
    if (!selectedContentId) {
      toast.error(t("errorNoContent"));
      return;
    }
    if (!scheduledAt) return;
    if (scheduledAt.getTime() <= Date.now()) {
      toast.error(t("errorPast"));
      return;
    }
    if (platforms.length === 0) {
      toast.error(t("errorNoPlatform"));
      return;
    }
    if (igBlocked) {
      toast.error(t("errorNotReady"));
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
  const suggestedTime = slotsQuery.data?.[0]
    ? toTimeInputValue(new Date(slotsQuery.data[0].at))
    : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border-slate-800 bg-slate-900 sm:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            {t("title")}
          </DialogTitle>
          <DialogDescription className="capitalize">
            {dateLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">
              {t("pickContent")}
            </Label>

            {readyQuery.isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : readyContents.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 py-8 text-center">
                <ImagePlus className="h-10 w-10 text-muted-foreground/50" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("emptyTitle")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("emptyDescription")}
                  </p>
                </div>
                <Button size="sm" onClick={() => router.push("/content")}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {t("createContentCta")}
                </Button>
              </div>
            ) : (
              <div className="h-[280px] overflow-y-auto rounded-xl border border-border bg-background/40">
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
                          "group relative flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors",
                          isSelected
                            ? "border-rose-400 ring-2 ring-rose-400/30"
                            : "border-border hover:border-foreground/30"
                        )}
                      >
                        <div className="relative aspect-square w-full overflow-hidden bg-muted">
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
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-muted/60 to-background">
                              {content.type === "REEL" ? (
                                <Video className="h-6 w-6 text-muted-foreground/50" />
                              ) : (
                                <ImagePlus className="h-6 w-6 text-muted-foreground/50" />
                              )}
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute right-1.5 top-1.5 rounded-full bg-rose-500 p-0.5">
                              <CheckCircle2 className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <div className="absolute left-1.5 top-1.5">
                            <Badge className="border-white/20 bg-black/60 px-1.5 py-0 text-[10px] text-white/90 backdrop-blur">
                              {content.type === "REEL"
                                ? tCommon("reel")
                                : tCommon("photo")}
                            </Badge>
                          </div>
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="truncate text-[11px] font-medium text-foreground">
                            {content.influencer.name}
                          </p>
                          {content.caption && (
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/70">
                              {content.caption}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {selectedContent?.caption ? (
            <div className="rounded-lg border border-border bg-background/50 p-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("captionPreview")}
              </p>
              <p className="line-clamp-3 text-xs text-foreground/80">
                {selectedContent.caption}
              </p>
            </div>
          ) : null}

          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">
              {t("pickTime")}
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-9 w-32 pl-8 text-sm"
                />
              </div>
              {(["09:00", "12:00", "18:00", "21:00"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTime(preset)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs transition-colors",
                    time === preset
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-accent/60"
                  )}
                >
                  {preset}
                </button>
              ))}
              {suggestedTime ? (
                <button
                  type="button"
                  onClick={() => setTime(suggestedTime)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                    time === suggestedTime
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300/80 hover:bg-emerald-500/20"
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  {t("suggestedSlot", { time: suggestedTime })}
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">
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
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-accent/60"
                    )}
                  >
                    {p === "INSTAGRAM" && (
                      <InstagramIcon className="h-3.5 w-3.5" />
                    )}
                    {p === "TIKTOK" && <TikTokIcon className="h-3.5 w-3.5" />}
                    {p === "ONLYFANS" && (
                      <OnlyFansIcon className="h-3.5 w-3.5" />
                    )}
                    {p === "INSTAGRAM"
                      ? "Instagram"
                      : p === "TIKTOK"
                        ? "TikTok"
                        : "OnlyFans"}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedContentId && influencerId && platforms.length > 0 ? (
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-[11px] font-medium text-muted-foreground">
                {tConfirm("checklistTitle")}
              </p>
              {readinessQuery.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {tConfirm("checking")}
                </div>
              ) : (
                <ul className="space-y-1">
                  {(readinessQuery.data?.checks ?? []).map((check) => (
                    <li
                      key={check.platform}
                      className="flex items-start gap-2 text-xs"
                    >
                      {check.ok ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      )}
                      <span
                        className={
                          check.ok ? "text-foreground/80" : "text-amber-200"
                        }
                      >
                        <span className="font-medium">{check.platform}</span>
                        {check.reason
                          ? ` — ${check.reason}`
                          : ` — ${tConfirm("checkOk")}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
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
                platforms.length === 0 ||
                igBlocked
              }
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
