"use client";

import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  format,
  getHours,
} from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import { ImagePlus, Video } from "lucide-react";
import { InstagramIcon, TikTokIcon } from "@/components/ui/social-icons";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./types";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function WeekView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const locale = useLocale();
  const dfnLocale = locale === "fr" ? fr : enUS;
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  function getEventsForDay(day: Date) {
    return events.filter((e) => isSameDay(new Date(e.date), day));
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50">
        <div />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "px-2 py-2.5 text-center",
              isToday(day) && "bg-rose-500/10"
            )}
          >
            <p className="text-xs capitalize text-muted-foreground">
              {format(day, "EEE", { locale: dfnLocale })}
            </p>
            <p
              className={cn(
                "text-sm font-semibold",
                isToday(day) ? "text-rose-400" : "text-foreground"
              )}
            >
              {format(day, "d")}
            </p>
          </div>
        ))}
      </div>

      {/* Hour grid */}
      <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              {/* Hour label */}
              <div className="flex h-12 items-start justify-end border-r border-border/30 pr-2 pt-0.5 text-xs text-muted-foreground/70">
                {hour.toString().padStart(2, "0")}:00
              </div>

              {/* Day cells */}
              {days.map((day) => {
                const dayEvents = getEventsForDay(day).filter(
                  (e) => getHours(new Date(e.date)) === hour
                );

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={cn(
                      "h-12 border-b border-r border-border/20 px-0.5",
                      isToday(day) && "bg-rose-500/5"
                    )}
                  >
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className={cn(
                          "flex w-full items-center gap-1 rounded border px-1 py-0.5 text-left transition-all hover:brightness-125",
                          event.status === "PUBLISHED"
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                            : event.status === "FAILED"
                              ? "bg-red-500/20 border-red-500/40 text-red-300"
                              : "bg-foreground/10 border-foreground/20 text-foreground/80"
                        )}
                      >
                        {event.type === "REEL" ? (
                          <Video className="h-2.5 w-2.5 shrink-0" />
                        ) : (
                          <ImagePlus className="h-2.5 w-2.5 shrink-0" />
                        )}
                        {event.platforms.includes("INSTAGRAM") && (
                          <InstagramIcon className="h-2.5 w-2.5" />
                        )}
                        {event.platforms.includes("TIKTOK") && (
                          <TikTokIcon className="h-2.5 w-2.5" />
                        )}
                        <span className="truncate text-[9px]">
                          {event.influencer.name}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

