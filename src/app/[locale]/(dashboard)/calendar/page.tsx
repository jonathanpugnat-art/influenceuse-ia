"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
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
  Columns,
  List,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { ListView } from "@/components/calendar/list-view";
import { ContentDetailModal } from "@/components/calendar/content-detail-modal";
import { ContentPlanDialog } from "@/components/calendar/content-plan-dialog";
import { ScheduleForDayDialog } from "@/components/calendar/schedule-for-day-dialog";
import { BatchProgressPanel } from "@/components/calendar/batch-progress-panel";
import { RecyclePanel } from "@/components/calendar/recycle-panel";
import { trpc } from "@/lib/trpc";
import { filterCalendarEventsByInfluencer } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CalendarEvent, CalendarView } from "@/components/calendar/types";

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, bounce: 0.12, duration: 0.6 },
  },
};

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const filterInfluencerId = searchParams.get("influencer") ?? undefined;
  const openScheduleFromUrl = searchParams.get("schedule") === "1";
  const fromTrend = searchParams.get("fromTrend") === "1";

  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const tDashboard = useTranslations("dashboard");
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  // Sprint 14 — schedule-for-day flow: clicking an empty day opens a picker
  // that lets the user assign one of their READY contents to that day.
  const [scheduleDay, setScheduleDay] = useState<Date | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const openedScheduleFromUrl = useRef(false);

  const suggestedSlotQuery = trpc.analytics.suggestSlots.useQuery(
    { influencerId: filterInfluencerId!, count: 1 },
    { enabled: Boolean(filterInfluencerId) && openScheduleFromUrl }
  );

  const hasSetMobileView = useRef(false);
  useEffect(() => {
    if (isMobile && !hasSetMobileView.current) {
      hasSetMobileView.current = true;
      queueMicrotask(() => setView("list"));
    }
  }, [isMobile]);

  useEffect(() => {
    if (!openScheduleFromUrl || !filterInfluencerId || openedScheduleFromUrl.current) {
      return;
    }
    if (suggestedSlotQuery.isLoading) return;

    openedScheduleFromUrl.current = true;
    const slot = suggestedSlotQuery.data?.[0];
    const day = slot
      ? new Date(slot.at)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(19, 0, 0, 0);
          return d;
        })();

    setCurrentDate(day);
    setScheduleDay(day);
    setScheduleOpen(true);
    if (fromTrend) {
      toast.info(t("fromTrendScheduleHint"));
    }
  }, [
    openScheduleFromUrl,
    filterInfluencerId,
    suggestedSlotQuery.isLoading,
    suggestedSlotQuery.data,
    fromTrend,
    t,
  ]);

  // Compute date range based on view
  const dateRange = useMemo(() => {
    if (view === "week") {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      };
    }
    // Month view — include partial weeks
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    return {
      start: startOfWeek(ms, { weekStartsOn: 1 }),
      end: endOfWeek(me, { weekStartsOn: 1 }),
    };
  }, [currentDate, view]);

  const { data: events, isLoading } = trpc.publish.getCalendarEvents.useQuery(
    {
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      influencerId: filterInfluencerId,
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

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const raw = (events ?? []) as CalendarEvent[];
    return filterInfluencerId
      ? filterCalendarEventsByInfluencer(raw, filterInfluencerId)
      : raw;
  }, [events, filterInfluencerId]);

  // Navigation
  const goNext = () => {
    setCurrentDate((d) => (view === "week" ? addWeeks(d, 1) : addMonths(d, 1)));
  };
  const goPrev = () => {
    setCurrentDate((d) => (view === "week" ? subWeeks(d, 1) : subMonths(d, 1)));
  };
  const goToday = () => setCurrentDate(new Date());

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setModalOpen(true);
  };

  // Sprint 14 — open the schedule picker instead of jumping to the creator.
  // The user can then assign an existing READY content to that day, OR
  // bail out and click "Create content" from inside the modal (which DOES
  // route to /content). This keeps the calendar focused on scheduling.
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

  const title =
    view === "week"
      ? `Semaine du ${format(dateRange.start, "d MMM", { locale: fr })} au ${format(dateRange.end, "d MMM yyyy", { locale: fr })}`
      : format(currentDate, "MMMM yyyy", { locale: fr });

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-6"
    >
      {/* Header */}
      <motion.div
        variants={sectionVariants}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 text-violet-400" />
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPlanOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-500/20"
          >
            <Sparkles className="h-4 w-4" />
            {t("generatePlan")}
          </button>
          <Link
            href="/content"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {tDashboard("createContent")}
          </Link>
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        variants={sectionVariants}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800/50 bg-slate-900/50 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Période précédente"
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
            aria-label="Période suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-2 text-lg font-semibold capitalize text-white">
            {title}
          </h2>
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl border border-slate-800/50 bg-slate-900/50 p-1">
          {([
            { value: "month", icon: LayoutGrid, label: t("month") },
            { value: "week", icon: Columns, label: t("week") },
            { value: "list", icon: List, label: t("list") },
          ] as const).map((v) => (
            <button
              key={v.value}
              onClick={() => setView(v.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                view === v.value
                  ? "bg-violet-500/20 text-violet-400"
                  : "text-slate-500 hover:text-white"
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Batch progress (Phase 4) */}
      <motion.div variants={sectionVariants}>
        <BatchProgressPanel />
      </motion.div>

      {/* Sprint 8 — recycle top performers */}
      <motion.div variants={sectionVariants}>
        <RecyclePanel />
      </motion.div>

      {/* Calendar content */}
      <motion.div variants={sectionVariants}>
        {isLoading ? (
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-8">
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg bg-slate-800/50" />
              ))}
            </div>
          </div>
        ) : calendarEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/50 bg-slate-900/50 py-16 text-center">
            <CalendarIcon className="mb-4 h-16 w-16 text-slate-400/30" aria-hidden />
            <h3 className="text-lg font-semibold text-white">{t("noEvents")}</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-400">
              Programmez du contenu pour le voir sur le calendrier.
            </p>
            <Button asChild className="mt-4">
              <Link href="/content">{tDashboard("createContent")}</Link>
            </Button>
          </div>
        ) : view === "month" ? (
          <MonthView
            currentDate={currentDate}
            events={calendarEvents}
            onEventClick={handleEventClick}
            onDayClick={handleDayClick}
          />
        ) : view === "week" ? (
          <WeekView
            currentDate={currentDate}
            events={calendarEvents}
            onEventClick={handleEventClick}
          />
        ) : (
          <ListView
            events={calendarEvents}
            onEventClick={handleEventClick}
            onPublishNow={handlePublishNow}
            onCancel={handleCancel}
          />
        )}
      </motion.div>

      {/* Detail modal */}
      <ContentDetailModal
        event={selectedEvent}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedEvent(null);
        }}
      />

      {/* Content plan dialog (Phase 3 — agent contenu) */}
      <ContentPlanDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        defaultInfluencerId={filterInfluencerId}
      />

      {/* Sprint 14 — schedule existing READY content for the clicked day */}
      <ScheduleForDayDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        day={scheduleDay}
        influencerId={filterInfluencerId}
        onScheduled={() => utils.publish.getCalendarEvents.invalidate()}
      />
    </motion.div>
  );
}
