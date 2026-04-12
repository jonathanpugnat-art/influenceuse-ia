"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function WizardProgress({ currentStep }: { currentStep: number }) {
  const t = useTranslations("wizard");
  const steps = [
    { label: t("identity") },
    { label: t("appearance") },
    { label: t("social") },
    { label: t("confirmation") },
  ];
  return (
    <div className="flex items-center justify-center">
      <div className="flex w-full max-w-lg items-center">
        {steps.map((step, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          const isFuture = stepNum > currentStep;

          return (
            <div key={stepNum} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                {/* Circle */}
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all",
                    isCompleted &&
                      "bg-emerald-500 text-white",
                    isActive &&
                      "bg-violet-500 text-white shadow-lg shadow-violet-500/30 ring-4 ring-violet-500/20",
                    isFuture &&
                      "border-2 border-slate-700 bg-transparent text-slate-500"
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
                </div>
                {/* Label — hidden on mobile */}
                <span
                  className={cn(
                    "hidden text-[11px] font-medium sm:block",
                    isCompleted && "text-emerald-400",
                    isActive && "text-violet-400",
                    isFuture && "text-slate-500"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="relative mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-slate-800 sm:mx-3">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

