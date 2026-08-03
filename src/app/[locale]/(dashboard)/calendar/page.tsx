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
import { fr, enUS } from "date-fns/locale";
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
import { useLocale, useTranslations } from "next-intl";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { ListView } from "@/components/calendar/list-view";
import { ContentDetailModal } from "@/components/calendar/content-detail-modal";
import { ScheduleForDayDialog } from "@/components/calendar/schedule-for-day-dialog";
import { BatchProgressPanel } from "@/components/calendar/batch-progress-panel";
import { PublishFailuresBanner } from "@/components/calendar/publish-failures-banner";
import { BatchReviewPanel } from "@/components/calendar/batch-review-panel";
import { RecyclePanel } from "@/components/calendar/recycle-panel";
import { trpc } from "@/lib/trpc";
import { filterCalendarEventsByInfluencer } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCalendarAgentStore } from "@/hooks/use-calendar-agent-store";
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
  /** YYYY-MM-DD from weekly formats (Mon / Wed / Fri slots). */
  const dateParam = searchParams.get("date");

  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const tDashboard = useTranslations("dashboard");
  const locale = useLocale();
  const dateLocale = locale === "en" ? enUS : fr;
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const {
    isOpen: agentOpen,
    toggleOpen: toggleAgentPanel,
    reviewBatchId,
    setReviewBatchId,
  } = useCalendarAgentStore();
  // Sprint 14 — schedule-for-day flow: clicking an empty day opens a picker
  // that lets the user assign one of their READY contents to that day.
  const [scheduleDay, setScheduleDay] = useState<Date | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const openedScheduleFromUrl = useRef(false);

  const suggestedSlotQuery = trpc.analytics.suggestSlots.useQuery(
    { influencerId: filterInfluencerId!, count: 1 },
    {
      enabled:
        Boolean(filterInfluencerId) &&
        openScheduleFromUrl &&
        !dateParam,
    }
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

    // Weekly formats deep-link: exact day from Trends (skip heatmap wait).
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      openedScheduleFromUrl.current = true;
      const day = new Date(`${dateParam}T19:00:00`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL-driven dialog bootstrap
      setCurrentDate(day);
      setScheduleDay(day);
      setScheduleOpen(true);
      if (fromTrend) {
        toast.info(t("fromTrendScheduleHintDated", { date: dateParam }));
      }
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

    // Deep-link from trends: open schedule dialog with suggested slot (one-shot).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL-driven dialog bootstrap
    setCurrentDate(day);
    setScheduleDay(day);
    setScheduleOpen(true);
    if (fromTrend) {
      toast.info(t("fromTrendScheduleHint"));
    }
  }, [
    openScheduleFromUrl,
    filterInfluencerId,
    dateParam,
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
      toast.success(t("publishedToast"));
      utils.publish.getCalendarEvents.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelMutation = trpc.publish.cancelSchedule.useMutation({
    onSuccess: () => {
      toast.success(t("cancelledToast"));
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
      ? t("weekOf", {
          start: format(dateRange.start, "d MMM", { locale: dateLocale }),
          end: format(dateRange.end, "d MMM yyyy", { locale: dateLocale }),
        })
      : format(currentDate, "MMMM yyyy", { locale: dateLocale });

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
          <CalendarIcon className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleAgentPanel}
            aria-expanded={agentOpen}
            className={cn(
              "flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              agentOpen
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <Sparkles className="h-4 w-4" />
            {t("generatePlan")}
          </button>
          <Link
            href="/content"
            className="flex min-h-10 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
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
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-card/50 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            aria-label={t("prevPeriod")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="min-h-10 rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            {tCommon("today")}
          </button>
          <button
            type="button"
            onClick={goNext}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-card/50 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            aria-label={t("nextPeriod")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-2 text-lg font-semibold capitalize text-foreground">
            {title}
          </h2>
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl border border-border/50 bg-card/50 p-1">
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
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* S5 — lot validation before image batch */}
      {reviewBatchId ? (
        <motion.div variants={sectionVariants}>
          <BatchReviewPanel
            batchId={reviewBatchId}
            onClose={() => setReviewBatchId(null)}
            onApproved={() => setReviewBatchId(null)}
          />
        </motion.div>
      ) : null}

      {/* Échecs de publication récents — anti silent-fail du cron publish */}
      <motion.div variants={sectionVariants}>
        <PublishFailuresBanner />
      </motion.div>

      {/* Batch progress (Phase 4) */}
      <motion.div variants={sectionVariants}>
        <BatchProgressPanel
          onReviewBatch={(batchId) => setReviewBatchId(batchId)}
        />
      </motion.div>

      {/* Sprint 8 — recycle top performers */}
      <motion.div variants={sectionVariants}>
        <RecyclePanel />
      </motion.div>

      {/* Calendar content */}
      <motion.div variants={sectionVariants}>
        {isLoading ? (
          <div className="rounded-2xl border border-border/50 bg-card/50 p-8">
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          </div>
        ) : calendarEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-card/50 py-16 text-center">
            <CalendarIcon className="mb-4 h-16 w-16 text-muted-foreground/30" aria-hidden />
            <h3 className="text-lg font-semibold text-foreground">{t("noEvents")}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t("noEventsHint")}
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
