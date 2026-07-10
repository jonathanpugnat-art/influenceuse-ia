"use client";

import { Calendar } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toTimeInputValue } from "./photo-publish-utils";
import type { PhotoPublishFlowState } from "@/hooks/photo-studio";

export function PhotoPublishScheduleSection({
  flow,
}: {
  flow: PhotoPublishFlowState;
}) {
  const t = useTranslations("content");
  const {
    scheduleMode,
    setScheduleMode,
    scheduleDate,
    setScheduleDate,
    scheduleTime,
    setScheduleTime,
    slotsQuery,
  } = flow;

  return (
    <div className="space-y-2">
      <Label className="text-xs text-slate-400">Programmation</Label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setScheduleMode("now")}
          className={cn(
            "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
            scheduleMode === "now"
              ? "border-violet-500 bg-violet-500/20 text-violet-300"
              : "border-slate-700 bg-slate-800/30 text-slate-400"
          )}
        >
          Maintenant
        </button>
        <button
          type="button"
          onClick={() => setScheduleMode("schedule")}
          className={cn(
            "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
            scheduleMode === "schedule"
              ? "border-violet-500 bg-violet-500/20 text-violet-300"
              : "border-slate-700 bg-slate-800/30 text-slate-400"
          )}
        >
          <Calendar className="mr-1 inline h-3 w-3" />
          Programmer
        </button>
      </div>
      {scheduleMode === "schedule" && (
        <div className="space-y-2">
          {slotsQuery.data?.[0] && (
            <p className="text-[10px] text-violet-400/90">
              {t("publishSlotSuggested", {
                time: toTimeInputValue(new Date(slotsQuery.data[0].at)),
              })}
            </p>
          )}
          <div className="flex gap-2">
            <Input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="h-8 flex-1 border-slate-700 bg-slate-800/50 text-xs text-white"
            />
            <Input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="h-8 w-24 border-slate-700 bg-slate-800/50 text-xs text-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
