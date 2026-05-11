"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, ArrowRight, Rocket, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const LS_KEY = "onboarding_dismissed_v1";

/**
 * Activation checklist (Phase 6 — onboarding).
 *
 * Renders a compact panel on the dashboard showing the user's progress
 * through the 4 mandatory activation steps. Hidden once completed (or once
 * the user explicitly dismisses it). Each step links directly to the
 * relevant flow so the user never has to hunt for the next CTA.
 */
export function OnboardingChecklist() {
  const t = useTranslations("dashboard.onboarding");
  const { data, isLoading } = trpc.onboarding.getState.useQuery();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_KEY) === "1";
  });

  if (isLoading || !data) return null;
  if (data.completed) return null;
  if (dismissed) return null;

  const required = data.steps.slice(0, 4);
  const doneCount = required.filter((s) => s.done).length;
  const pct = Math.round((doneCount / required.length) * 100);

  const handleDismiss = () => {
    localStorage.setItem(LS_KEY, "1");
    setDismissed(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-slate-900/50 to-indigo-500/10 p-6 backdrop-blur-xl"
    >
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/20 blur-[80px]" />
      <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-indigo-500/20 blur-[80px]" />

      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-white"
        aria-label={t("dismiss")}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Rocket className="h-5 w-5 text-violet-400" />
              <span className="text-xs font-medium uppercase tracking-wide text-violet-300">
                {t("badge")}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">{t("title")}</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-400">{t("subtitle")}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{pct}%</div>
            <p className="text-xs text-slate-400">
              {doneCount}/{required.length}
            </p>
          </div>
        </div>

        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-800/60">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
          />
        </div>

        <ul className="space-y-2">
          {required.map((step) => (
            <li
              key={step.id}
              className={cn(
                "group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors",
                step.done
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-slate-700/50 bg-slate-900/40 hover:border-violet-500/50 hover:bg-slate-900/60"
              )}
            >
              <div className="flex items-center gap-3">
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-slate-500" />
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
                    step.done ? "text-slate-300 line-through" : "text-white"
                  )}
                >
                  {t(`steps.${step.titleKey}`)}
                </span>
              </div>
              {!step.done && step.cta && (
                <Link
                  href={step.cta}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/25"
                >
                  {t("doIt")}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
