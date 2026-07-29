"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, PenLine, Check } from "lucide-react";
import { toast } from "sonner";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import {
  diversifyTemplate,
  filterTemplates,
  type InfluencerTemplate,
} from "@/lib/templates/influencer-templates";
import {
  Eyebrow,
  nicheDotClass,
  wizardCardClass,
  wizardCardHoverClass,
  wizardChipActiveClass,
  wizardChipIdleClass,
} from "@/components/influencer/wizard-ui";
import { trpc } from "@/lib/trpc";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { cn } from "@/lib/utils";

/**
 * Template gallery at the top of wizard step 1.
 * Styled to match the editorial/luxe wizard — hairline borders, niche dots,
 * no loud gradient tiles. One click pre-fills persona fields (name stays empty).
 */
export function TemplatePicker() {
  const t = useTranslations("wizard.templates");
  const tNiche = useTranslations("influencer");
  const { data, updateData } = useInfluencerWizard();
  const [expanded, setExpanded] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: plan } = useCurrentPlan();
  const allowNsfw = plan?.features.hasNsfw ?? false;

  const templates = filterTemplates({ allowNsfw });

  const startWithoutTemplate = () => {
    setSelectedId(null);
    updateData({
      bio: "",
      personality: "",
      niche: "",
      gender: "female",
      age: 24,
      isNsfw: false,
      ethnicity: "",
      hairColor: "",
      hairLength: "",
      hairTexture: "",
      bodyType: "",
      fashionStyles: [],
    });
    toast.info(t("customPathHint"));
    requestAnimationFrame(() => {
      document.getElementById("wizard-identity-name")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  const apply = (tpl: InfluencerTemplate) => {
    const diversified = diversifyTemplate(tpl);
    updateData(diversified.defaults);
    setSelectedId(tpl.id);
    requestAnimationFrame(() => {
      window.scrollTo({ top: window.scrollY + 240, behavior: "smooth" });
    });
  };

  const onCustomPath =
    selectedId === null && data.niche === "" && !data.bio && !data.personality;

  return (
    <div className="space-y-2.5">
      {/* Custom path — default, agent-first */}
      <button
        type="button"
        onClick={startWithoutTemplate}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all",
          onCustomPath
            ? wizardChipActiveClass
            : cn(wizardChipIdleClass, wizardCardHoverClass)
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            onCustomPath
              ? "border-primary/30 bg-primary/10"
              : "border-border bg-card"
          )}
        >
          <PenLine
            className={cn(
              "h-4 w-4",
              onCustomPath ? "text-foreground" : "text-muted-foreground"
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">{t("customTitle")}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {t("customSubtitle")}
          </p>
        </div>
        {onCustomPath ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-foreground">
            <Check className="h-3 w-3" />
            {t("customActive")}
          </span>
        ) : null}
      </button>

      {/* Template gallery — collapsed by default, sober cards */}
      <div className={cn(wizardCardClass, "p-4")}>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <Eyebrow>{t("title")}</Eyebrow>
            <p className="mt-1 text-xs text-slate-500">{t("subtitle")}</p>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-500 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>

        {expanded ? (
          <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {templates.map((tpl) => {
              const isSelected = selectedId === tpl.id;
              const nicheLabel = tNiche(
                `niche${capitalize(tpl.niche.toLowerCase())}` as "nicheFashion"
              );
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => apply(tpl)}
                  className={cn(
                    "relative rounded-xl border p-3 text-left transition-all",
                    isSelected
                      ? wizardChipActiveClass
                      : cn(wizardChipIdleClass, "hover:bg-white/[0.04]")
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        nicheDotClass[tpl.niche] ?? "bg-violet-400"
                      )}
                    />
                    <span className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {nicheLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-snug text-white">
                    {t(`${tpl.labelKey}.label`)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                    {t(`${tpl.descriptionKey}`)}
                  </p>
                  {isSelected ? (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-background/80 px-1.5 py-0.5 text-[9px] font-medium text-foreground">
                      <Check className="h-2.5 w-2.5" />
                      {t("applied")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
