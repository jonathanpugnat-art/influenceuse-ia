"use client";

import { Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AppearanceAccordionSection, AppearanceChip } from "./appearance-ui";
import type { AppearanceFormState } from "./use-appearance-form";

export function AppearanceHairSection({ form }: { form: AppearanceFormState }) {
  const t = useTranslations("wizard");

  return (
    <AppearanceAccordionSection
      title={t("sectionHair")}
      icon={Scissors}
      open={form.openSections.hair}
      onToggle={() => form.toggleSection("hair")}
      summary={form.hairSummary}
    >
      <div className="space-y-2">
        <Label className="text-foreground/90">{t("hairColor")}</Label>
        <div className="flex flex-wrap gap-2">
          {form.hairColors.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => form.setHairColor(c.value)}
              aria-pressed={form.hairColor === c.value}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                form.hairColor === c.value
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <span>{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-foreground/90">{t("hairLength")}</Label>
        <div className="flex flex-wrap gap-2">
          {form.hairLengths.map((l) => (
            <AppearanceChip
              key={l.value}
              label={l.label}
              selected={form.hairLength === l.value}
              onClick={() => form.setHairLength(l.value)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-foreground/90">{t("hairTexture")}</Label>
        <div className="flex flex-wrap gap-2">
          {form.hairTextures.map((ht) => (
            <AppearanceChip
              key={ht.value}
              label={ht.label}
              selected={form.hairTexture === ht.value}
              onClick={() => form.setHairTexture(ht.value)}
            />
          ))}
        </div>
      </div>
    </AppearanceAccordionSection>
  );
}
