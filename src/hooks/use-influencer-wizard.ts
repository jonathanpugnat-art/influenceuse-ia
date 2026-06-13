"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { WIZARD_PERSIST_STORAGE_KEY } from "@/lib/wizard-draft";
import { defaultWizardAppearanceV2 } from "@/lib/appearance-v2";

export interface WizardData {
  // Step 1 — Identity
  name: string;
  gender: "female" | "male" | "nonbinary";
  bio: string;
  personality: string;
  /** Creative director brief from wizard agent step 1. */
  brief?: string;
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
  skinTone: string;
  height: string;
  bustLevel: number;
  hipsLevel: number;
  shouldersLevel: number;
  tattoos: string[];
  makeupLevel: string;
  bodyGenerationMode: "standard" | "extended";
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

/** How the user entered the wizard. "unset" shows the Guided/Express choice. */
export type WizardEntryMode = "unset" | "guided" | "express";

interface WizardState {
  step: number;
  data: WizardData;
  generatedImages: string[];
  selectedImageIndex: number;
  isGenerating: boolean;
  expressMode: boolean;
  /** Entry-point choice (Guided conversation vs Express ~30s). */
  entryMode: WizardEntryMode;
  /** Set after draft create on step 3 (OAuth) or final create on step 4. */
  createdInfluencerId: string | null;
  setStep: (step: number) => void;
  setEntryMode: (mode: WizardEntryMode) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateData: (partial: Partial<WizardData>) => void;
  setGeneratedImages: (images: string[]) => void;
  setSelectedImageIndex: (index: number) => void;
  setIsGenerating: (val: boolean) => void;
  setExpressMode: (val: boolean) => void;
  setCreatedInfluencerId: (id: string | null) => void;
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
  fashionStyles: [],
  ...defaultWizardAppearanceV2(),
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
      expressMode: false,
      entryMode: "unset",
      createdInfluencerId: null,
      setStep: (step) => set({ step }),
      setEntryMode: (mode) => set({ entryMode: mode }),
      nextStep: () => set((s) => ({ step: Math.min(s.step + 1, 4) })),
      prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),
      updateData: (partial) =>
        set((s) => ({ data: { ...s.data, ...partial } })),
      setGeneratedImages: (images) => set({ generatedImages: images }),
      setSelectedImageIndex: (index) => set({ selectedImageIndex: index }),
      setIsGenerating: (val) => set({ isGenerating: val }),
      setExpressMode: (val) => set({ expressMode: val }),
      setCreatedInfluencerId: (id) => set({ createdInfluencerId: id }),
      reset: () =>
        set({
          step: 1,
          data: { ...initialData },
          generatedImages: [],
          selectedImageIndex: 0,
          isGenerating: false,
          expressMode: false,
          entryMode: "unset",
          createdInfluencerId: null,
        }),
    }),
    {
      name: WIZARD_PERSIST_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist the data that costs money or effort to recreate.
      partialize: (s) => ({
        step: s.step,
        data: s.data,
        generatedImages: s.generatedImages,
        selectedImageIndex: s.selectedImageIndex,
        entryMode: s.entryMode,
        createdInfluencerId: s.createdInfluencerId,
      }),
      version: 4,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as {
          data?: Partial<WizardData>;
          entryMode?: WizardEntryMode;
        };
        if (version < 3 && state.data) {
          state.data = { ...initialData, ...state.data, ...defaultWizardAppearanceV2() };
        }
        // v4 — existing drafts predate the Guided/Express choice screen; keep
        // them in the guided flow so a resumed draft never lands on the picker.
        if (version < 4 && state.entryMode == null) {
          state.entryMode = "guided";
        }
        return persisted as typeof persisted;
      },
    }
  )
);

