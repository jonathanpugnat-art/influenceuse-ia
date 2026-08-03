"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { Skeleton } from "@/components/ui/skeleton";

// Mock 30-day usage data (will be replaced with real data later)
function generateMockData(limit: number) {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const day = date.getDate();
    const month = date.getMonth() + 1;

    data.push({
      date: `${day}/${month}`,
      Photos: Math.floor(Math.random() * 8),
      Reels: Math.floor(Math.random() * 3),
      Captions: Math.floor(Math.random() * 4) * 0.5,
    });
  }
  return data;
}

export function UsageChart() {
  const { data: planData, isLoading } = useCurrentPlan();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6">
        <Skeleton className="h-6 w-48 bg-slate-800/50" />
        <Skeleton className="mt-4 h-64 w-full bg-slate-800/50" />
      </div>
    );
  }

  const limit = planData?.creditsLimit ?? 50;
  const dailyLimit = limit === 999999 ? undefined : Math.round(limit / 30);
  const chartData = generateMockData(limit);

  return (
    <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl">
      <h2 className="text-lg font-semibold text-white">
        Utilisation des crédits (30 jours)
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Répartition par type de génération
      </p>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148, 163, 184, 0.1)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={{ stroke: "rgba(148, 163, 184, 0.1)" }}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgb(15 23 42 / 0.95)",
                border: "1px solid rgb(30 41 59 / 0.5)",
                borderRadius: "12px",
                color: "white",
                fontSize: "12px",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
            />
            {dailyLimit && (
              <ReferenceLine
                y={dailyLimit}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{
                  value: `Limite (~${dailyLimit}/jour)`,
                  position: "right",
                  fill: "#ef4444",
                  fontSize: 10,
                }}
              />
            )}
            <Bar
              dataKey="Photos"
              stackId="credits"
              fill="#8b5cf6"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="Reels"
              stackId="credits"
              fill="#3b82f6"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="Captions"
              stackId="credits"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

