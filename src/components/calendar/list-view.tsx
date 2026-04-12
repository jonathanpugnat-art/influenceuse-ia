"use client";

import Link from "next/link";
import { format, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
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

const statusBadge: Record<string, { label: string; className: string }> = {
  SCHEDULED: { label: "Programmé", className: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  PUBLISHED: { label: "Publié", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  FAILED: { label: "Échoué", className: "bg-red-500/10 text-red-400 border-red-500/20" },
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
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/50 bg-slate-900/50 py-16 text-center">
        <Calendar className="mb-4 h-16 w-16 text-slate-400/30" aria-hidden />
        <h3 className="text-lg font-semibold text-white">Aucun événement</h3>
        <p className="mt-1 max-w-sm text-sm text-slate-400">
          Programmez du contenu pour le voir apparaître ici.
        </p>
        <Button asChild className="mt-4">
          <Link href="/content">Créer du contenu</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <div key={group.date.toISOString()}>
          {/* Day header */}
          <h3 className="mb-2 text-sm font-semibold text-slate-400">
            {format(group.date, "EEEE d MMMM", { locale: fr })}
          </h3>

          <div className="space-y-2">
            {group.events.map((event) => {
              const status = statusBadge[event.status] ?? statusBadge.SCHEDULED;
              return (
                <div
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-slate-800/50 bg-slate-900/50 p-4 backdrop-blur-xl transition-all hover:border-slate-700 hover:shadow-lg hover:shadow-violet-500/5"
                >
                  {/* Thumbnail */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-800">
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
                          <Video className="h-5 w-5 text-slate-600" />
                        ) : (
                          <ImagePlus className="h-5 w-5 text-slate-600" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {event.influencer.name}
                      </span>
                      <Badge className={cn("border px-1.5 py-0 text-[9px]", status.className)}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{format(new Date(event.date), "HH:mm")}</span>
                      <span>•</span>
                      <span>{event.type === "REEL" ? "Reel" : "Photo"}</span>
                      <span>•</span>
                      <div className="flex gap-1">
                        {event.platforms.map((p) => (
                          <PlatformIcon key={p} platform={p} />
                        ))}
                      </div>
                    </div>
                    {event.caption && (
                      <p className="mt-1 truncate text-xs text-slate-500">
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
                        aria-label="Publier maintenant"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCancel(event); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                        aria-label="Annuler"
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

