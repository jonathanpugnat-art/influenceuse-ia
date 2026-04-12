"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";

const PLATFORM_COLORS: Record<string, string> = {
  TIKTOK: "#22d3ee",
  INSTAGRAM: "#f472b6",
  ONLYFANS: "#3b82f6",
};

const PLATFORM_LABELS: Record<string, string> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  ONLYFANS: "OnlyFans",
};

type BreakdownItem = {
  platform: string;
  followers: number;
  views: number;
  percentage: number;
};

interface PlatformBreakdownProps {
  data: BreakdownItem[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("fr-FR");
}

export function PlatformBreakdown({ data }: PlatformBreakdownProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        name: PLATFORM_LABELS[d.platform] ?? d.platform,
        platform: d.platform,
        value: d.percentage,
        followers: d.followers,
        views: d.views,
      })),
    [data]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Répartition par plateforme
        </h2>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                stroke="rgb(15 23 42)"
                strokeWidth={2}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.platform}
                    fill={PLATFORM_COLORS[entry.platform] ?? "#64748b"}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgb(15 23 42 / 0.98)",
                  border: "1px solid rgb(51 65 85)",
                  borderRadius: "12px",
                  color: "white",
                  fontSize: "12px",
                }}
                formatter={(value: number, name, props) => [
                  `${value}% · ${formatNumber(props.payload.followers)} followers · ${formatNumber(props.payload.views)} vues`,
                  name,
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px" }}
                formatter={(value, entry) => {
                  const item = chartData.find((d) => d.name === value);
                  const pct = item?.value ?? 0;
                  const followers = item?.followers ?? 0;
                  return (
                    <span className="text-slate-300">
                      {value} — {pct}% ({formatNumber(followers)})
                    </span>
                  );
                }}
                iconType="circle"
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
