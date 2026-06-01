"use client";

import { useTranslations } from "next-intl";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { nicheConfig } from "@/lib/influencer-utils";
import { cn } from "@/lib/utils";

/** Live mini-card while the user fills step 1 identity fields. */
export function WizardIdentityPreview() {
  const t = useTranslations("wizard");
  const { data } = useInfluencerWizard();

  const hasContent =
    data.name.trim().length > 0 ||
    data.bio.trim().length > 0 ||
    data.personality.trim().length > 0 ||
    Boolean(data.niche);

  if (!hasContent) return null;

  const niche = data.niche
    ? (nicheConfig[data.niche] ?? {
        label: data.niche,
        text: "text-slate-400",
        bg: "bg-slate-800",
      })
    : null;

  return (
    <div
      className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-slate-900/60 to-slate-900/40 p-4"
      aria-live="polite"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
        {t("identityPreviewLabel")}
      </p>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-lg font-bold text-white">
          {(data.name.trim()[0] ?? "?").toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {data.name.trim() || t("noName")}
          </p>
          {niche && (
            <span
              className={cn(
                "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                niche.bg,
                niche.text
              )}
            >
              {niche.label}
            </span>
          )}
          {data.bio.trim() && (
            <p className="mt-2 line-clamp-2 text-xs text-slate-400">
              {data.bio.trim()}
            </p>
          )}
          {data.personality.trim() && (
            <p className="mt-1 line-clamp-1 text-[11px] italic text-slate-500">
              {data.personality.trim()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
