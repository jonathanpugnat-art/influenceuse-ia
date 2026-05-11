"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AlertTriangle, X, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const SESSION_KEY = "low_balance_dismissed_v1";

/**
 * Low credit-balance banner (Phase 6).
 *
 * Shown above the dashboard content when remaining credits drop below the
 * warning threshold. Dismissible per-session so we don't nag the user, but
 * comes back next session if they still haven't upgraded.
 */
export function LowBalanceBanner() {
  const t = useTranslations("layout.lowBalance");
  const { data } = trpc.billing.getCurrentPlan.useQuery();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_KEY) === "1";
  });

  if (!data || dismissed) return null;
  if (data.creditsLimit === 0 || data.creditsLimit > 1e6) return null; // unlimited plans

  const remaining = data.creditsRemaining;
  const limit = data.creditsLimit;
  const pct = limit > 0 ? remaining / limit : 1;
  const critical = remaining <= 0;
  const low = pct <= 0.15 && !critical;

  if (!low && !critical) return null;

  return (
    <div
      className={cn(
        "relative flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
        critical
          ? "border-red-500/40 bg-red-500/10 text-red-200"
          : "border-amber-500/40 bg-amber-500/10 text-amber-200"
      )}
    >
      <div className="flex items-center gap-2">
        {critical ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <Zap className="h-4 w-4 shrink-0" />
        )}
        <span>
          {critical
            ? t("creditsExhausted")
            : t("creditsLow", { remaining: Math.round(remaining) })}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/billing"
          className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium hover:bg-white/20"
        >
          {t("upgradeCta")}
        </Link>
        <button
          type="button"
          aria-label={t("dismiss")}
          onClick={() => {
            sessionStorage.setItem(SESSION_KEY, "1");
            setDismissed(true);
          }}
          className="rounded p-1 hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
