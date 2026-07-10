import type { ReactNode } from "react";
import { formatFollowers } from "@/lib/influencer-utils";

export const placeholderGradients = [
  "from-violet-600 to-indigo-600",
  "from-pink-600 to-rose-600",
  "from-blue-600 to-cyan-600",
  "from-emerald-600 to-teal-600",
];

export function WizardSummaryStat({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-base font-bold text-white">
        {format ? formatFollowers(value) : value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
    </div>
  );
}

export function WizardSummaryPlatformPill({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-slate-800/50 px-3 py-1.5">
      {icon}
      <span className="text-[11px] text-slate-300">{label}</span>
    </div>
  );
}
