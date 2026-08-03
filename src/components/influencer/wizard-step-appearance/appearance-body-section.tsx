"use client";

import { PersonStanding } from "lucide-react";
import { useTranslations } from "next-intl";
import { WizardAppearanceV2Panel } from "@/components/influencer/wizard-appearance-v2-panel";
import type { WizardData } from "@/hooks/use-influencer-wizard";
import { AppearanceAccordionSection } from "./appearance-ui";
import type { AppearanceFormState } from "./use-appearance-form";

export function AppearanceBodySection({
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
      title={t("sectionBody")}
      icon={PersonStanding}
      open={form.openSections.body}
      onToggle={() => form.toggleSection("body")}
      summary={form.bodySummary}
    >
      <WizardAppearanceV2Panel
        data={data}
        onChange={updateData}
        forceExtendedBody={data.isNsfw}
      />
    </AppearanceAccordionSection>
  );
}
