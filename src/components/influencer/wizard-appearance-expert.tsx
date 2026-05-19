"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Dice5, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  APPEARANCE_EXPERT_SECTIONS,
  fingerprintFromWizard,
  normalizeAppearanceVariation,
  randomAppearanceVariation,
  type AppearanceTraitKey,
} from "@/lib/prompts/appearance-variation-ui";
import type { WizardData } from "@/hooks/use-influencer-wizard";
import { cn } from "@/lib/utils";

function TraitChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all",
        selected
          ? "border-violet-500 bg-violet-500/20 text-violet-200"
          : "border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600"
      )}
    >
      {label}
    </button>
  );
}

type Props = {
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
};

/**
 * Collapsed-by-default expert panel — 5 trait rows (face, eyes, color,
 * signature, expression) + nose. Updates appearanceVariations + fingerprint
 * in the wizard store without spending credits until the user hits Generate.
 */
export function WizardAppearanceExpert({ data, updateData }: Props) {
  const t = useTranslations("wizard.appearanceExpert");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!data.appearanceVariations) {
      const variations = randomAppearanceVariation();
      updateData({
        appearanceVariations: variations,
        appearanceFingerprint: fingerprintFromWizard(
          data.age || 24,
          data,
          variations
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const variations = normalizeAppearanceVariation(data.appearanceVariations);

  const setTrait = (key: AppearanceTraitKey, index: number) => {
    const next = { ...variations, [key]: index };
    updateData({
      appearanceVariations: next,
      appearanceFingerprint: fingerprintFromWizard(data.age || 24, data, next),
    });
  };

  const randomize = () => {
    const next = randomAppearanceVariation();
    updateData({
      appearanceVariations: next,
      appearanceFingerprint: fingerprintFromWizard(data.age || 24, data, next),
    });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-slate-800/20 px-3 py-2.5 text-left transition-colors hover:bg-slate-800/40">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <SlidersHorizontal className="h-4 w-4 text-violet-400" />
          {t("title")}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-500 transition-transform",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4 rounded-xl border border-violet-500/15 bg-violet-500/5 p-3">
        <p className="text-xs leading-relaxed text-slate-400">{t("hint")}</p>

        {APPEARANCE_EXPERT_SECTIONS.map((section) => (
          <div key={section.key} className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {t(section.labelKey)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {section.options.map((opt) => (
                <TraitChip
                  key={opt.index}
                  label={opt.label}
                  selected={variations[section.key] === opt.index}
                  onClick={() => setTrait(section.key, opt.index)}
                />
              ))}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={randomize}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/20"
        >
          <Dice5 className="h-3.5 w-3.5" />
          {t("randomizeTraits")}
        </button>
      </CollapsibleContent>
    </Collapsible>
  );
}
