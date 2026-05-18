"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, ChevronDown } from "lucide-react";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import {
  diversifyTemplate,
  filterTemplates,
  type InfluencerTemplate,
} from "@/lib/templates/influencer-templates";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

/**
 * Template gallery rendered at the top of wizard step 1 (Sprint 7).
 *
 * One click pre-fills every wizard field (name stays empty so the user
 * still chooses a name). NSFW templates are hidden unless the current
 * plan allows it.
 */
export function TemplatePicker() {
  const t = useTranslations("wizard.templates");
  const tNiche = useTranslations("influencer");
  const { updateData } = useInfluencerWizard();
  const [expanded, setExpanded] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: plan } = trpc.billing.getCurrentPlan.useQuery();
  const allowNsfw = plan?.features.hasNsfw ?? false;

  const templates = filterTemplates({ allowNsfw });

  const apply = (tpl: InfluencerTemplate) => {
    // Sprint 14 — diversify ethnicity + hair color on every pick so two
    // users clicking the same template don't end up with identical-looking
    // influencers. Always keeps a 35% chance of returning the original
    // (curated) defaults so intentional looks like "Streetwear Girl"
    // staying asian are preserved often enough.
    const diversified = diversifyTemplate(tpl);
    updateData(diversified.defaults);
    setSelectedId(tpl.id);
    requestAnimationFrame(() => {
      window.scrollTo({ top: window.scrollY + 240, behavior: "smooth" });
    });
  };

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/5 via-slate-900/40 to-indigo-500/5 p-4">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">{t("title")}</span>
          <span className="text-xs text-slate-400">{t("subtitle")}</span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {templates.map((tpl) => {
            const isSelected = selectedId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => apply(tpl)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border p-3 text-left transition-all",
                  isSelected
                    ? "border-violet-500 ring-2 ring-violet-500/40"
                    : "border-slate-800 hover:border-violet-500/50"
                )}
              >
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-25 transition-opacity group-hover:opacity-40",
                    tpl.gradient
                  )}
                />
                <div className="relative">
                  <p className="text-sm font-semibold text-white">
                    {t(`${tpl.labelKey}.label`)}
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                    {tNiche(`niche${capitalize(tpl.niche.toLowerCase())}`)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-300">
                    {t(`${tpl.descriptionKey}`)}
                  </p>
                </div>
                {isSelected && (
                  <span className="absolute right-2 top-2 rounded-full bg-violet-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    {t("applied")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
