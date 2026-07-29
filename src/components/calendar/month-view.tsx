"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { ImagePlus, Video } from "lucide-react";
import { InstagramIcon, TikTokIcon, OnlyFansIcon } from "@/components/ui/social-icons";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./types";

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-foreground/10 border-foreground/20 text-foreground/80",
  PUBLISHED: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
  FAILED: "bg-red-500/20 border-red-500/40 text-red-300",
};

function PlatformMiniIcon({ platform }: { platform: string }) {
  switch (platform) {
    case "INSTAGRAM":
      return <InstagramIcon className="h-2.5 w-2.5 text-pink-400" />;
    case "TIKTOK":
      return <TikTokIcon className="h-2.5 w-2.5 text-white" />;
    case "ONLYFANS":
      return <OnlyFansIcon className="h-2.5 w-2.5 text-blue-400" />;
    default:
      return null;
  }
}

export function MonthView({
  currentDate,
  events,
  onEventClick,
  onDayClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("calendar");
  const dfnLocale = locale === "fr" ? fr : enUS;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const dayNames = days
    .slice(0, 7)
    .map((d) => format(d, "EEE", { locale: dfnLocale }));

  function getEventsForDay(day: Date) {
    return events.filter((e) => isSameDay(new Date(e.date), day));
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border/50">
        {dayNames.map((d) => (
          <div
            key={d}
            className="px-2 py-2.5 text-center text-xs font-medium capitalize text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const maxVisible = 3;
          const overflowCount = dayEvents.length - maxVisible;

          return (
            <div
              key={day.toISOString()}
              onClick={() => dayEvents.length === 0 && onDayClick(day)}
              className={cn(
                "min-h-[100px] border-b border-r border-border/30 p-1.5 transition-colors",
                !inMonth && "opacity-30",
                today && "bg-rose-500/5",
                dayEvents.length === 0 && "cursor-pointer hover:bg-accent/20"
              )}
            >
              {/* Day number */}
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    today
                      ? "bg-rose-500 text-white"
                      : inMonth
                        ? "text-foreground/80"
                        : "text-muted-foreground/60"
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, maxVisible).map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className={cn(
                      "flex w-full items-center gap-1 rounded border px-1 py-0.5 text-left transition-all hover:brightness-125",
                      statusColors[event.status] ?? statusColors.SCHEDULED
                    )}
                  >
                    {event.type === "REEL" ? (
                      <Video className="h-2.5 w-2.5 shrink-0" />
                    ) : (
                      <ImagePlus className="h-2.5 w-2.5 shrink-0" />
                    )}
                    {event.platforms[0] && (
                      <PlatformMiniIcon platform={event.platforms[0]} />
                    )}
                    <span className="truncate text-[9px] leading-tight">
                      {format(new Date(event.date), "HH:mm")} {event.influencer.name}
                    </span>
                  </button>
                ))}
                {overflowCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(dayEvents[maxVisible]);
                    }}
                    className="w-full text-center text-[9px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("moreEvents", { count: overflowCount })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

