import type { WizardData } from "@/hooks/use-influencer-wizard";

export const WIZARD_PERSIST_STORAGE_KEY = "influencer-wizard-draft";

export type WizardDraftSnapshot = {
  step: number;
  data: WizardData;
  generatedImages: string[];
  selectedImageIndex: number;
};

/** True when restoring localStorage is worth offering to the user. */
export function isMeaningfulWizardDraft(snapshot: WizardDraftSnapshot): boolean {
  if (snapshot.step > 1) return true;
  if (snapshot.generatedImages.length > 0) return true;
  if (snapshot.data.baseImageUrl?.trim()) return true;

  const hasIdentityProgress =
    snapshot.data.name.trim().length >= 2 ||
    snapshot.data.bio.trim().length >= 10 ||
    snapshot.data.personality.trim().length >= 10 ||
    Boolean(snapshot.data.niche);

  return hasIdentityProgress;
}
