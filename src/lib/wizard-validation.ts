import type { WizardData } from "@/hooks/use-influencer-wizard";

export function isIdentityStepComplete(data: WizardData): boolean {
  return (
    data.name.trim().length >= 2 &&
    data.name.trim().length <= 50 &&
    data.bio.trim().length >= 10 &&
    data.bio.trim().length <= 300 &&
    data.personality.trim().length >= 10 &&
    data.personality.trim().length <= 500 &&
    Boolean(data.niche?.trim())
  );
}

export function hasWizardPortrait(
  data: WizardData,
  generatedImages: string[],
  selectedImageIndex: number
): boolean {
  const fromGallery = generatedImages[selectedImageIndex]?.trim();
  return Boolean(fromGallery || data.baseImageUrl?.trim());
}

export function isAppearanceStepComplete(
  data: WizardData,
  generatedImages: string[],
  selectedImageIndex: number
): boolean {
  return hasWizardPortrait(data, generatedImages, selectedImageIndex);
}

/** Furthest step the user may jump to via the progress bar (1–4). */
export function getMaxReachableWizardStep(
  data: WizardData,
  generatedImages: string[],
  selectedImageIndex: number
): number {
  if (!isIdentityStepComplete(data)) return 1;
  if (!isAppearanceStepComplete(data, generatedImages, selectedImageIndex)) {
    return 2;
  }
  return 4;
}

export function canNavigateToWizardStep(
  targetStep: number,
  data: WizardData,
  generatedImages: string[],
  selectedImageIndex: number
): boolean {
  if (targetStep < 1 || targetStep > 4) return false;
  return targetStep <= getMaxReachableWizardStep(data, generatedImages, selectedImageIndex);
}
