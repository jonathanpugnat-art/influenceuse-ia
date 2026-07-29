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
    { label: t("traitFace"), value: traits.faceShape },
    { label: t("traitEyes"), value: traits.eyeShape },
    { label: t("traitEyeColor"), value: traits.eyeColor },
    { label: t("traitNose"), value: traits.nose },
    { label: t("traitDetail"), value: traits.distinctiveFeature },
    { label: t("traitExpression"), value: traits.expression },
  ];

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">
          {t("visualSignature")}
        </p>
        <button
          type="button"
          onClick={onReroll}
          disabled={disabled}
          className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:opacity-40"
          title={t("surpriseMeRerollTitle")}
        >
          <Dice5 className="h-3 w-3" />
          {t("surpriseMe")}
        </button>
      </div>
      <ul className="grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-foreground/80 sm:grid-cols-2">
        {items
          .filter((item) => item.value)
          .map((item) => (
            <li key={item.label} className="flex gap-1.5">
              <span className="shrink-0 text-muted-foreground">{item.label}</span>
              <span>· {item.value}</span>
            </li>
          ))}
      </ul>
      <p className="text-[10px] text-muted-foreground">{t("traitsInjectedHint")}</p>
    </div>
  );
}
