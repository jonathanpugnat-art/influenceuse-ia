"use client";

import { cn } from "@/lib/utils";

export type WorkflowStep = {
  label: string;
};

/**
 * Compact step indicator for multi-step creation flows (photo scene, reel talking, etc.).
 */
export function WorkflowSteps({
  steps,
  currentIndex,
  className,
}: {
  steps: WorkflowStep[];
  currentIndex: number;
  className?: string;
}) {
  return (
    <ol
      className={cn("flex items-center gap-2", className)}
      aria-label="Progression"
    >
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step.label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                done && "bg-emerald-500/20 text-emerald-400",
                active && "bg-violet-500/25 text-violet-300 ring-1 ring-violet-500/40",
                !done && !active && "bg-slate-800 text-slate-500"
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "truncate text-[11px] font-medium",
                active ? "text-violet-200" : "text-slate-500"
              )}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1 hidden h-px flex-1 bg-slate-800 sm:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
