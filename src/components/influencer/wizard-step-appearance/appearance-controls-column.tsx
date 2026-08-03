"use client";

import { AppearanceBodySection } from "./appearance-body-section";
import { AppearanceFaceSection } from "./appearance-face-section";
import { AppearanceGenerateActions } from "./appearance-generate-actions";
import { AppearanceHairSection } from "./appearance-hair-section";
import { AppearanceStyleSection } from "./appearance-style-section";
import type { AppearanceFormState } from "./use-appearance-form";
import type { AppearanceGenerationState } from "./use-appearance-generation";

export function AppearanceControlsColumn({
  form,
  generation,
}: {
  form: AppearanceFormState;
  generation: AppearanceGenerationState;
}) {
  const { data, updateData } = generation;

  return (
    <div className="order-2 space-y-3 lg:order-1">
      <AppearanceFaceSection form={form} />
      <AppearanceHairSection form={form} />
      <AppearanceBodySection form={form} data={data} updateData={updateData} />
      <AppearanceStyleSection form={form} data={data} updateData={updateData} />
      <AppearanceGenerateActions form={form} generation={generation} />
    </div>
  );
}
