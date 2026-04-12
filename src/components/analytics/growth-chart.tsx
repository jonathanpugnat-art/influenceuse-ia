"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const METRIC_OPTIONS = [
  { value: "followers" as const, label: "Followers" },
  { value: "engagement" as const, label: "Engagement" },
  { value: "views" as const, label: "Vues" },
  { value: "likes" as const, label: "Likes" },
] as const;

const PLATFORM_COLORS = {
  TIKTOK: "#22d3ee",
  INSTAGRAM: "#f472b6",
  ONLYFANS: "#3b82f6",
} as const;

const PLATFORM_LABELS: Record<string, string> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  ONLYFANS: "OnlyFans",
};

type DataPoint = {
  date: string;
  TIKTOK: number;
  INSTAGRAM: number;
  ONLYFANS: number;
};

interface GrowthChartProps {
  data: DataPoint[];
  metric: "followers" | "engagement" | "views" | "likes";
  onMetricChange: (metric: "followers" | "engagement" | "views" | "likes") => void;
  visiblePlatforms?: Record<string, boolean>;
  onTogglePlatform?: (platform: string) => void;
}

function formatTick(value: number, metric: string): string {
  if (metric === "engagement") return `${value.toFixed(1)}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

export function GrowthChart({
  data,
  metric,
  onMetricChange,
  visiblePlatforms = { TIKTOK: true, INSTAGRAM: true, ONLYFANS: true },
  onTogglePlatform,
}: GrowthChartProps) {
  const displayData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        dateShort: new Date(d.date).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
        }),
      })),
    [data]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Évolution</h2>
        <div className="flex flex-wrap gap-2">
          {METRIC_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onMetricChange(opt.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                metric === opt.value
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={displayData}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148, 163, 184, 0.08)"
              vertical={false}
            />
            <XAxis
              dataKey="dateShort"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "rgba(148, 163, 184, 0.15)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatTick(v, metric)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgb(15 23 42 / 0.98)",
                border: "1px solid rgb(51 65 85)",
                borderRadius: "12px",
                color: "white",
                fontSize: "12px",
              }}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.date
                  ? new Date(payload[0].payload.date).toLocaleDateString("fr-FR", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })
                  : ""
              }
              formatter={(value: number) => [
                metric === "engagement" ? `${value.toFixed(2)}%` : value.toLocaleString("fr-FR"),
                null,
              ]}
              labelStyle={{ color: "#94a3b8" }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
              formatter={(value) => (
                <span
                  className={cn(
                    "cursor-pointer transition-opacity",
                    visiblePlatforms[value] !== false ? "text-white" : "text-slate-500"
                  )}
                  onClick={() => onTogglePlatform?.(value)}
                >
                  {PLATFORM_LABELS[value] ?? value}
                </span>
              )}
              iconType="line"
              iconSize={10}
            />
            {(["TIKTOK", "INSTAGRAM", "ONLYFANS"] as const).map((platform) => (
              <Line
                key={platform}
                type="monotone"
                dataKey={platform}
                name={platform}
                stroke={PLATFORM_COLORS[platform]}
                strokeWidth={2}
                dot={false}
                strokeOpacity={visiblePlatforms[platform] !== false ? 1 : 0.25}
                hide={visiblePlatforms[platform] === false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
