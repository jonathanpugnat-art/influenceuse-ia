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
import { fr } from "date-fns/locale";
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
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  function getEventsForDay(day: Date) {
    return events.filter((e) => isSameDay(new Date(e.date), day));
  }

  return (
    <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-xl overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-800/50">
        <div />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "px-2 py-2.5 text-center",
              isToday(day) && "bg-violet-500/10"
            )}
          >
            <p className="text-xs text-slate-500">
              {format(day, "EEE", { locale: fr })}
            </p>
            <p
              className={cn(
                "text-sm font-semibold",
                isToday(day) ? "text-violet-400" : "text-white"
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
              <div className="flex h-12 items-start justify-end border-r border-slate-800/30 pr-2 pt-0.5 text-xs text-slate-600">
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
                      "h-12 border-b border-r border-slate-800/20 px-0.5",
                      isToday(day) && "bg-violet-500/5"
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
                              : "bg-violet-500/20 border-violet-500/40 text-violet-300"
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

