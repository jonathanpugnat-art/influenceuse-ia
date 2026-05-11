"use client";

import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface HeatmapCell {
  day: number;
  hour: number;
  engagement: number;
  count: number;
}

interface BestHoursPayload {
  cells: HeatmapCell[];
  top: HeatmapCell[];
}

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/**
 * Sprint 8 — Heatmap of engagement by day-of-week × hour-of-day.
 * Helps the user pick the best slots in the planner. We bucket
 * 24 columns into 8 (each = 3h) for readability on small screens.
 */
export function BestHoursHeatmap({
  data,
  isLoading,
}: {
  data: BestHoursPayload | undefined;
  isLoading: boolean;
}) {
  const t = useTranslations("analytics.bestHours");

  if (isLoading) {
    return (
      <Skeleton className="h-[280px] rounded-2xl border border-slate-800/50 bg-slate-900/50" />
    );
  }
  if (!data?.cells?.length) return null;

  // Collapse 24 hours into 8 slots of 3h each.
  const slots = Array.from({ length: 8 }, (_, i) => ({
    label: `${i * 3}h`,
    range: [i * 3, i * 3 + 3] as [number, number],
  }));

  // Compute aggregated grid[day][slot]
  const grid: { value: number; count: number }[][] = Array.from(
    { length: 7 },
    () => Array.from({ length: 8 }, () => ({ value: 0, count: 0 }))
  );
  for (const cell of data.cells) {
    const slotIdx = Math.floor(cell.hour / 3);
    if (slotIdx >= 0 && slotIdx < 8) {
      grid[cell.day][slotIdx].value += cell.engagement * cell.count;
      grid[cell.day][slotIdx].count += cell.count;
    }
  }

  const max = Math.max(
    ...grid.flat().map((c) => (c.count > 0 ? c.value / c.count : 0)),
    0.0001
  );

  return (
    <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-cyan-400" />
        <h2 className="text-lg font-semibold text-white">{t("title")}</h2>
      </div>
      <p className="mb-4 text-xs text-slate-400">{t("subtitle")}</p>

      <div className="overflow-x-auto">
        <div className="min-w-[480px]">
          {/* Header: hour slots */}
          <div className="ml-9 grid grid-cols-8 gap-1 text-center text-[10px] text-slate-500">
            {slots.map((s) => (
              <div key={s.label}>{s.label}</div>
            ))}
          </div>

          {/* Rows: days */}
          {DAYS.map((day, di) => (
            <div key={day} className="mt-1 flex items-center gap-1">
              <div className="w-8 text-right text-xs text-slate-500">{day}</div>
              <div className="grid flex-1 grid-cols-8 gap-1">
                {grid[di].map((cell, si) => {
                  const avg = cell.count > 0 ? cell.value / cell.count : 0;
                  const intensity = Math.min(1, avg / max);
                  return (
                    <div
                      key={`${di}-${si}`}
                      className={cn(
                        "aspect-square rounded transition-colors",
                        cell.count === 0 ? "bg-slate-800/40" : ""
                      )}
                      style={
                        cell.count > 0
                          ? {
                              backgroundColor: `rgba(139, 92, 246, ${0.15 + intensity * 0.75})`,
                            }
                          : undefined
                      }
                      title={
                        cell.count > 0
                          ? `${day} ${si * 3}-${si * 3 + 3}h · ${(avg * 100).toFixed(1)}% · ${cell.count} posts`
                          : t("noData")
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top slots */}
      {data.top.length > 0 && (
        <div className="mt-4 space-y-1 border-t border-slate-800/50 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("topSlots")}
          </p>
          <ul className="space-y-1 text-xs text-slate-300">
            {data.top.slice(0, 3).map((cell, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>
                  {DAYS[cell.day]} · {cell.hour}h–{cell.hour + 1}h
                </span>
                <span className="font-mono text-violet-400">
                  {(cell.engagement * 100).toFixed(1)}% · {cell.count} {t("posts")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
