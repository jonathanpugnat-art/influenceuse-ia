import type { WizardData } from "@/hooks/use-influencer-wizard";

export function isIdentityStepComplete(data: WizardData): boolean {
  // Primary signal: creative universe (angle/brief). Bio+personality remain a
  // legacy escape hatch for older drafts.
  const angle = (data.angle ?? data.brief ?? "").trim();
  const hasAngleOrBio =
    angle.length >= 5 ||
    (data.bio.trim().length >= 10 && data.personality.trim().length >= 10);

  return (
    data.name.trim().length >= 2 &&
    data.name.trim().length <= 50 &&
    Boolean(data.niche?.trim()) &&
    hasAngleOrBio
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
  return (
    targetStep <=
    getMaxReachableWizardStep(data, generatedImages, selectedImageIndex)
  );
}
