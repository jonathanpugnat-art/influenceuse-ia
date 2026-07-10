import { describe, expect, it, vi } from "vitest";
import {
  consumeWizardWelcomePhotoSeed,
  stashWizardWelcomePhotoSeed,
  WIZARD_WELCOME_PHOTO_SEED_KEY,
} from "@/lib/wizard-photo-seed";

describe("wizard-photo-seed", () => {
  it("stashes and consumes a photo seed once", () => {
    const storage = new Map<string, string>();
    const sessionStorage = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
      removeItem: (k: string) => {
        storage.delete(k);
      },
    };
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", sessionStorage);

    stashWizardWelcomePhotoSeed({
      influencerId: "x",
      sceneDescription: "gym morning",
      scene: "custom",
    });

    expect(storage.has(WIZARD_WELCOME_PHOTO_SEED_KEY)).toBe(true);
    const consumed = consumeWizardWelcomePhotoSeed();
    expect(consumed?.sceneDescription).toBe("gym morning");
    expect(consumeWizardWelcomePhotoSeed()).toBeNull();

    vi.unstubAllGlobals();
  });
});
