"use client";

import { Dice5 } from "lucide-react";
import { useTranslations } from "next-intl";
import { explodeAppearanceVariations } from "@/lib/prompts/image-prompts";
import type { WizardData } from "@/hooks/use-influencer-wizard";

export function AppearanceVisualSignature({
  data,
  onReroll,
  disabled,
}: {
  data: WizardData;
  onReroll: () => void;
  disabled: boolean;
}) {
  const t = useTranslations("wizard");

  if (!data.appearanceVariations) return null;

  const traits = explodeAppearanceVariations(data.appearanceVariations);
  const items: Array<{ label: string; value: string }> = [
    { label: "Visage", value: traits.faceShape },
    { label: "Yeux", value: traits.eyeShape },
    { label: "Couleur", value: traits.eyeColor },
    { label: "Nez", value: traits.nose },
    { label: "Détail", value: traits.distinctiveFeature },
    { label: "Expression", value: traits.expression },
  ];

  return (
    <div className="space-y-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-violet-300">
          {t("visualSignature")}
        </p>
        <button
          type="button"
          onClick={onReroll}
          disabled={disabled}
          className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-200 transition-colors hover:bg-violet-500/20 disabled:opacity-40"
          title={t("surpriseMeRerollTitle")}
        >
          <Dice5 className="h-3 w-3" />
          {t("surpriseMe")}
        </button>
      </div>
      <ul className="grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-slate-300 sm:grid-cols-2">
        {items
          .filter((item) => item.value)
          .map((item) => (
            <li key={item.label} className="flex gap-1.5">
              <span className="shrink-0 text-slate-500">{item.label}</span>
              <span className="text-slate-300">· {item.value}</span>
            </li>
          ))}
      </ul>
      <p className="text-[10px] text-slate-500">{t("traitsInjectedHint")}</p>
    </div>
  );
}
