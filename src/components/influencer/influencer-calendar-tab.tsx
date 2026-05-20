"use client";

import { useState, useMemo } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "@/i18n/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  LayoutGrid,
  List,
  ExternalLink,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthView } from "@/components/calendar/month-view";
import { ListView } from "@/components/calendar/list-view";
import { ContentDetailModal } from "@/components/calendar/content-detail-modal";
import { ScheduleForDayDialog } from "@/components/calendar/schedule-for-day-dialog";
import { trpc } from "@/lib/trpc";
import { filterCalendarEventsByInfluencer } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CalendarEvent, CalendarView } from "@/components/calendar/types";

interface InfluencerCalendarTabProps {
  influencerId: string;
}

export function InfluencerCalendarTab({ influencerId }: InfluencerCalendarTabProps) {
  const t = useTranslations("influencer.profileTabs");
  const tCal = useTranslations("calendar");
  const tCommon = useTranslations("common");

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [scheduleDay, setScheduleDay] = useState<Date | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const dateRange = useMemo(() => {
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    return {
      start: startOfWeek(ms, { weekStartsOn: 1 }),
      end: endOfWeek(me, { weekStartsOn: 1 }),
    };
  }, [currentDate]);

  const { data: events, isLoading } = trpc.publish.getCalendarEvents.useQuery(
    {
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      influencerId,
    },
    { placeholderData: (prev) => prev }
  );

  const utils = trpc.useUtils();

  const publishMutation = trpc.publish.publishNow.useMutation({
    onSuccess: () => {
      toast.success("Contenu publié !");
      utils.publish.getCalendarEvents.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelMutation = trpc.publish.cancelSchedule.useMutation({
    onSuccess: () => {
      toast.success("Programmation annulée");
      utils.publish.getCalendarEvents.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const calendarEvents = useMemo(
    () => filterCalendarEventsByInfluencer((events ?? []) as CalendarEvent[], influencerId),
    [events, influencerId]
  );

  const goNext = () => setCurrentDate((d) => addMonths(d, 1));
  const goPrev = () => setCurrentDate((d) => subMonths(d, 1));
  const goToday = () => setCurrentDate(new Date());

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setModalOpen(true);
  };

  const handleDayClick = (date: Date) => {
    setScheduleDay(date);
    setScheduleOpen(true);
  };

  const handlePublishNow = (event: CalendarEvent) => {
    publishMutation.mutate({
      contentId: event.id,
      platforms: event.platforms as ["INSTAGRAM"],
    });
  };

  const handleCancel = (event: CalendarEvent) => {
    cancelMutation.mutate({ contentId: event.id });
  };

  const title = format(currentDate, "MMMM yyyy", { locale: fr });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">{t("calendarSubtitle")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/content/photo?influencer=${influencerId}`}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {t("createContent")}
          </Link>
          <Button
            asChild
            variant="outline"
            className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Link href={`/calendar?influencer=${influencerId}`}>
              {t("viewFullCalendar")}
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800/50 bg-slate-900/50 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            {tCommon("today")}
          </button>
          <button
            type="button"
            onClick={goNext}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800/50 bg-slate-900/50 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-2 text-lg font-semibold capitalize text-white">{title}</h2>
        </div>

        <div className="flex rounded-xl border border-slate-800/50 bg-slate-900/50 p-1">
          {(
            [
              { value: "month" as const, icon: LayoutGrid, label: tCal("month") },
              { value: "list" as const, icon: List, label: tCal("list") },
            ] as const
          ).map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setView(v.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                view === v.value
                  ? "bg-violet-500/20 text-violet-400"
                  : "text-slate-500 hover:text-white"
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-8">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg bg-slate-800/50" />
            ))}
          </div>
        </div>
      ) : calendarEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/50 bg-slate-900/50 py-12 text-center">
          <CalendarIcon className="mb-4 h-12 w-12 text-slate-600" aria-hidden />
          <h3 className="text-lg font-semibold text-white">{t("calendarEmptyTitle")}</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-400">{t("calendarEmptyHint")}</p>
          <Button asChild className="mt-4">
            <Link href={`/content/photo?influencer=${influencerId}`}>
              {t("createContent")}
            </Link>
          </Button>
        </div>
      ) : view === "month" ? (
        <MonthView
          currentDate={currentDate}
          events={calendarEvents}
          onEventClick={handleEventClick}
          onDayClick={handleDayClick}
        />
      ) : (
        <ListView
          events={calendarEvents}
          onEventClick={handleEventClick}
          onPublishNow={handlePublishNow}
          onCancel={handleCancel}
        />
      )}

      <ContentDetailModal
        event={selectedEvent}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedEvent(null);
        }}
      />

      <ScheduleForDayDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        day={scheduleDay}
        influencerId={influencerId}
        onScheduled={() => utils.publish.getCalendarEvents.invalidate()}
      />
    </div>
  );
}
