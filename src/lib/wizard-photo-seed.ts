import type { PhotoCreatorSeed } from "@/hooks/use-photo-creator";

export const WIZARD_WELCOME_PHOTO_SEED_KEY = "aura:wizard-welcome-photo-seed";

/** Stash a photo seed before wizard reset so /content/photo can apply it on welcome. */
export function stashWizardWelcomePhotoSeed(seed: PhotoCreatorSeed): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(WIZARD_WELCOME_PHOTO_SEED_KEY, JSON.stringify(seed));
  } catch {
    // sessionStorage full or unavailable — non-blocking
  }
}

export function consumeWizardWelcomePhotoSeed(): PhotoCreatorSeed | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(WIZARD_WELCOME_PHOTO_SEED_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(WIZARD_WELCOME_PHOTO_SEED_KEY);
    const parsed = JSON.parse(raw) as PhotoCreatorSeed;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
