"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface WizardData {
  // Step 1 — Identity
  name: string;
  gender: "female" | "male" | "nonbinary";
  bio: string;
  personality: string;
  niche: string;
  age: number;
  isNsfw: boolean;
  // Step 2 — Appearance
  ethnicity: string;
  hairColor: string;
  hairLength: string;
  hairTexture: string;
  bodyType: string;
  fashionStyles: string[];
  /** URL de l'image de base sélectionnée (parmi les 4 variantes générées) */
  baseImageUrl: string;
  /**
   * Sprint 13 — uniqueness guard. Returned by the `generateBaseImage`
   * mutation alongside the image URLs. Forwarded to `influencer.create`
   * so the row knows which random visual variations were baked in (lets
   * us detect duplicate identities across users via an indexed lookup).
   */
  appearanceVariations?: {
    faceShape: number;
    eyeShape: number;
    eyeColor: number;
    nose: number;
    distinctiveFeature: number;
    expression: number;
  };
  appearanceFingerprint?: string;
  // Step 3 — Social
  instagramEnabled: boolean;
  instagramUsername: string;
  tiktokEnabled: boolean;
  tiktokUsername: string;
  onlyfansEnabled: boolean;
  onlyfansUsername: string;
}

interface WizardState {
  step: number;
  data: WizardData;
  generatedImages: string[];
  selectedImageIndex: number;
  isGenerating: boolean;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateData: (partial: Partial<WizardData>) => void;
  setGeneratedImages: (images: string[]) => void;
  setSelectedImageIndex: (index: number) => void;
  setIsGenerating: (val: boolean) => void;
  reset: () => void;
}

const initialData: WizardData = {
  name: "",
  gender: "female",
  bio: "",
  personality: "",
  niche: "",
  age: 24,
  isNsfw: false,
  ethnicity: "",
  hairColor: "",
  hairLength: "",
  hairTexture: "",
  bodyType: "",
  fashionStyles: [],
  baseImageUrl: "",
  instagramEnabled: false,
  instagramUsername: "",
  tiktokEnabled: false,
  tiktokUsername: "",
  onlyfansEnabled: false,
  onlyfansUsername: "",
};

/**
 * Sprint 12 — Persist wizard state to localStorage.
 *
 * Why: image generation costs real money (credits), so if a user closes the
 * tab between step 2 (images generated) and step 4 (final create), they lose
 * everything. Persisting the wizard state means a refresh / accidental close
 * is now recoverable — they reopen the wizard and pick up where they left off.
 *
 * `isGenerating` is intentionally NOT persisted (it would lock the UI on a
 * spinner forever if the request failed mid-flight then the page was reloaded).
 */
export const useInfluencerWizard = create<WizardState>()(
  persist(
    (set) => ({
      step: 1,
      data: { ...initialData },
      generatedImages: [],
      selectedImageIndex: 0,
      isGenerating: false,
      setStep: (step) => set({ step }),
      nextStep: () => set((s) => ({ step: Math.min(s.step + 1, 4) })),
      prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),
      updateData: (partial) =>
        set((s) => ({ data: { ...s.data, ...partial } })),
      setGeneratedImages: (images) => set({ generatedImages: images }),
      setSelectedImageIndex: (index) => set({ selectedImageIndex: index }),
      setIsGenerating: (val) => set({ isGenerating: val }),
      reset: () =>
        set({
          step: 1,
          data: { ...initialData },
          generatedImages: [],
          selectedImageIndex: 0,
          isGenerating: false,
        }),
    }),
    {
      name: "influencer-wizard-draft",
      storage: createJSONStorage(() => localStorage),
      // Only persist the data that costs money or effort to recreate.
      partialize: (s) => ({
        step: s.step,
        data: s.data,
        generatedImages: s.generatedImages,
        selectedImageIndex: s.selectedImageIndex,
      }),
      version: 1,
    }
  )
);

