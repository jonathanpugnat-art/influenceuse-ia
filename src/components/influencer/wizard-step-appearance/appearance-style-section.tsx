"use client";

import { Shirt } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { WizardAppearanceExpert } from "@/components/influencer/wizard-appearance-expert";
import type { WizardData } from "@/hooks/use-influencer-wizard";
import { AppearanceAccordionSection, AppearanceChip } from "./appearance-ui";
import type { AppearanceFormState } from "./use-appearance-form";

export function AppearanceStyleSection({
  form,
  data,
  updateData,
}: {
  form: AppearanceFormState;
  data: WizardData;
  updateData: (patch: Partial<WizardData>) => void;
}) {
  const t = useTranslations("wizard");

  return (
    <AppearanceAccordionSection
      title={t("sectionStyle")}
      icon={Shirt}
      open={form.openSections.style}
      onToggle={() => form.toggleSection("style")}
      summary={form.styleSummary}
    >
      <div className="space-y-2">
        <Label className="text-foreground/90">
          {t("fashionStyle")}{" "}
          <span className="text-muted-foreground">{t("multiSelect")}</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {form.fashionStylesList.map((s) => (
            <AppearanceChip
              key={s.value}
              label={s.label}
              selected={form.fashionStyles.includes(s.value)}
              onClick={() => form.toggleFashion(s.value)}
            />
          ))}
        </div>
      </div>

      <WizardAppearanceExpert data={data} updateData={updateData} />
    </AppearanceAccordionSection>
  );
}
