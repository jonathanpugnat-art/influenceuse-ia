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
                    "relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all",
                    isCompleted && "border border-white/20 bg-white/10 text-white",
                    isActive &&
                      "border border-white bg-white text-neutral-950 shadow-lg shadow-white/5",
                    isFuture &&
                      isReachable &&
                      "border border-white/15 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:bg-white/[0.06]",
                    isFuture &&
                      !isReachable &&
                      "cursor-not-allowed border border-white/10 bg-transparent text-slate-600",
                    canClick && "cursor-pointer",
                    !canClick && !isActive && !isCompleted && "cursor-default"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    stepNum
                  )}
                </button>
                <span
                  className={cn(
                    "hidden text-[11px] font-medium sm:block",
                    isCompleted && "text-slate-400",
                    isActive && "text-white",
                    isFuture && isReachable && "text-slate-400",
                    isFuture && !isReachable && "text-slate-600"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {i < steps.length - 1 && (
                <div
                  className="relative mx-2 h-px flex-1 overflow-hidden bg-white/10 sm:mx-3"
                  aria-hidden
                >
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 transition-all duration-500",
                      isCompleted && "w-full bg-white/30",
                      isActive && "w-1/2 bg-white/20",
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
