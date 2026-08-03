"use client";

import Link from "next/link";
import { format, isSameDay } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import {
  ImagePlus,
  Video,
  Play,
  X,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InstagramIcon, TikTokIcon, OnlyFansIcon } from "@/components/ui/social-icons";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./types";

const statusBadge: Record<string, { labelKey: string; className: string }> = {
  SCHEDULED: { labelKey: "statusScheduled", className: "bg-foreground/10 text-foreground/80 border-foreground/20" },
  PUBLISHED: { labelKey: "statusPublished", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  FAILED: { labelKey: "statusFailed", className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform) {
    case "INSTAGRAM": return <InstagramIcon className="h-3.5 w-3.5 text-pink-400" />;
    case "TIKTOK": return <TikTokIcon className="h-3.5 w-3.5 text-white" />;
    case "ONLYFANS": return <OnlyFansIcon className="h-3.5 w-3.5 text-blue-400" />;
    default: return null;
  }
}

export function ListView({
  events,
  onEventClick,
  onPublishNow,
  onCancel,
}: {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onPublishNow: (event: CalendarEvent) => void;
  onCancel: (event: CalendarEvent) => void;
}) {
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dateLocale = locale === "en" ? enUS : fr;

  // Group by date
  const grouped: { date: Date; events: CalendarEvent[] }[] = [];
  const sorted = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const event of sorted) {
    const eventDate = new Date(event.date);
    const existing = grouped.find((g) => isSameDay(g.date, eventDate));
    if (existing) {
      existing.events.push(event);
    } else {
      grouped.push({ date: eventDate, events: [event] });
    }
  }

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-card/50 py-16 text-center">
        <Calendar className="mb-4 h-16 w-16 text-muted-foreground/30" aria-hidden />
        <h3 className="text-lg font-semibold text-foreground">{t("noEvents")}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t("listEmptyHint")}
        </p>
        <Button asChild className="mt-4">
          <Link href="/content">{t("createContent")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <div key={group.date.toISOString()}>
          {/* Day header */}
          <h3 className="mb-2 text-sm font-semibold capitalize text-muted-foreground">
            {format(group.date, "EEEE d MMMM", { locale: dateLocale })}
          </h3>

          <div className="space-y-2">
            {group.events.map((event) => {
              const status = statusBadge[event.status] ?? statusBadge.SCHEDULED;
              const statusLabel = t(status.labelKey);
              return (
                <div
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-xl transition-colors hover:border-foreground/25"
                >
                  {/* Thumbnail */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {event.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        {event.type === "REEL" ? (
                          <Video className="h-5 w-5 text-muted-foreground/50" />
                        ) : (
                          <ImagePlus className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {event.influencer.name}
                      </span>
                      <Badge className={cn("border px-1.5 py-0 text-[9px]", status.className)}>
                        {statusLabel}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(event.date), "HH:mm")}</span>
                      <span>•</span>
                      <span>
                        {event.type === "REEL" ? tCommon("reel") : tCommon("photo")}
                      </span>
                      <span>•</span>
                      <div className="flex gap-1">
                        {event.platforms.map((p) => (
                          <PlatformIcon key={p} platform={p} />
                        ))}
                      </div>
                    </div>
                    {event.caption && (
                      <p className="mt-1 truncate text-xs text-muted-foreground/70">
                        {event.caption}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {event.status === "SCHEDULED" && (
                    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onPublishNow(event); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                        aria-label={t("publishNow")}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCancel(event); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                        aria-label={t("cancelSchedule")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

