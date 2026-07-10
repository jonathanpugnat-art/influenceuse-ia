"use client";

import { Smile } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  wizardSelectContentClass,
  wizardSelectTriggerClass,
} from "@/components/influencer/wizard-ui";
import { AppearanceAccordionSection } from "./appearance-ui";
import type { AppearanceFormState } from "./use-appearance-form";

export function AppearanceFaceSection({ form }: { form: AppearanceFormState }) {
  const t = useTranslations("wizard");

  return (
    <AppearanceAccordionSection
      title={t("sectionFace")}
      icon={Smile}
      open={form.openSections.face}
      onToggle={() => form.toggleSection("face")}
      summary={form.faceSummary}
    >
      <div className="space-y-2">
        <Label className="text-slate-300">{t("ethnicity")}</Label>
        <Select value={form.ethnicity} onValueChange={form.setEthnicity}>
          <SelectTrigger className={wizardSelectTriggerClass}>
            <SelectValue placeholder={t("selectPlaceholder")} />
          </SelectTrigger>
          <SelectContent className={wizardSelectContentClass}>
            {form.ethnicities.map((e) => (
              <SelectItem
                key={e.value}
                value={e.value}
                className="text-slate-300 focus:bg-slate-800 focus:text-white"
              >
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </AppearanceAccordionSection>
  );
}
