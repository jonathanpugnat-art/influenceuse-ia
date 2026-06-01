"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function WizardProgress({
  currentStep,
  maxReachableStep,
  onStepClick,
}: {
  currentStep: number;
  maxReachableStep: number;
  onStepClick: (step: number) => void;
}) {
  const t = useTranslations("wizard");
  const steps = [
    { label: t("identity") },
    { label: t("appearance") },
    { label: t("social") },
    { label: t("confirmation") },
  ];

  return (
    <nav aria-label={t("progressNavLabel")} className="flex items-center justify-center">
      <ol className="flex w-full max-w-lg items-center">
        {steps.map((step, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          const isFuture = stepNum > currentStep;
          const isReachable = stepNum <= maxReachableStep;
          const canClick = isReachable && stepNum !== currentStep;

          return (
            <li
              key={stepNum}
              className="flex flex-1 items-center last:flex-none"
              aria-current={isActive ? "step" : undefined}
            >
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  disabled={!canClick}
                  onClick={() => canClick && onStepClick(stepNum)}
                  aria-label={t("progressStepLabel", {
                    step: stepNum,
                    label: step.label,
                  })}
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all",
                    isCompleted && "bg-emerald-500 text-white",
                    isActive &&
                      "bg-violet-500 text-white shadow-lg shadow-violet-500/30 ring-4 ring-violet-500/20",
                    isFuture &&
                      isReachable &&
                      "border-2 border-violet-500/50 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20",
                    isFuture &&
                      !isReachable &&
                      "cursor-not-allowed border-2 border-slate-700 bg-transparent text-slate-500",
                    canClick && "cursor-pointer hover:scale-105",
                    !canClick && !isActive && !isCompleted && "cursor-default"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    stepNum
                  )}
                  {isActive && (
                    <span className="absolute h-9 w-9 animate-ping rounded-full bg-violet-500/20" />
                  )}
                </button>
                <span
                  className={cn(
                    "hidden text-[11px] font-medium sm:block",
                    isCompleted && "text-emerald-400",
                    isActive && "text-violet-400",
                    isFuture && isReachable && "text-violet-400/80",
                    isFuture && !isReachable && "text-slate-500"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {i < steps.length - 1 && (
                <div
                  className="relative mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-slate-800 sm:mx-3"
                  aria-hidden
                >
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                      isCompleted && "w-full bg-emerald-500",
                      isActive && "w-1/2 bg-gradient-to-r from-violet-500 to-transparent",
                      isFuture && "w-0"
                    )}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
