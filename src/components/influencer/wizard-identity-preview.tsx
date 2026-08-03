"use client";

import { useTranslations } from "next-intl";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import {
  Eyebrow,
  nicheDotClass,
  wizardCardClass,
} from "@/components/influencer/wizard-ui";
import { cn } from "@/lib/utils";

/** Live mini-card while the user fills step 1 identity fields. */
export function WizardIdentityPreview() {
  const t = useTranslations("wizard");
  const tInfluencer = useTranslations("influencer");
  const { data } = useInfluencerWizard();

  const hasContent =
    data.name.trim().length > 0 ||
    data.bio.trim().length > 0 ||
    data.personality.trim().length > 0 ||
    Boolean(data.niche);

  if (!hasContent) return null;

  const nicheLabel = data.niche
    ? tInfluencer(
        `niche${data.niche.charAt(0)}${data.niche.slice(1).toLowerCase()}` as "nicheFashion"
      )
    : null;

  return (
    <div className={cn(wizardCardClass, "p-4")} aria-live="polite">
      <Eyebrow>{t("identityPreviewLabel")}</Eyebrow>
      <div className="mt-3 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-base font-medium text-white">
          {(data.name.trim()[0] ?? "?").toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {data.name.trim() || t("noName")}
          </p>
          {nicheLabel && data.niche ? (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-slate-400">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  nicheDotClass[data.niche] ?? "bg-violet-400"
                )}
              />
              {nicheLabel}
            </span>
          ) : null}
          {data.bio.trim() ? (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
              {data.bio.trim()}
            </p>
          ) : null}
          {data.personality.trim() ? (
            <p className="mt-1 line-clamp-1 text-[11px] italic text-slate-600">
              {data.personality.trim()}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
