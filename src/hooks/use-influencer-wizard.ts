"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { WIZARD_PERSIST_STORAGE_KEY } from "@/lib/wizard-draft";
import { defaultWizardAppearanceV2 } from "@/lib/appearance-v2";
import type { NicheProfile } from "@/lib/niche-profile";
import type { NicheShotIdea } from "@/lib/niche-shot-ideas";

export interface WizardData {
  // Step 1 — Identity
  name: string;
  gender: "female" | "male" | "nonbinary";
  bio: string;
  personality: string;
  /** Creative director brief from wizard agent step 1. */
  brief?: string;
  /**
   * Structured niche understanding from the "niche brain" agent. Not a form
   * field the user edits directly — it captures the agent's comprehension and
   * drives niche-specific realistic content generation downstream.
   */
  nicheProfile?: NicheProfile;
  /** Shot idea picked in the niche brain panel — applied to photo studio after create. */
  pendingNicheShotId?: string;
  pendingNicheShot?: NicheShotIdea;
  /**
   * Freeform positioning angle (e.g. "coach running Paris").
   * Primary day-1 signal — niche enum stays a coarse bucket.
   */
  angle: string;
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
  /** Free-text morphology direction baked into the base portrait. */
  morphologyNotes: string;
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
  /** Set after draft create on step 3 (OAuth) or final create on step 4. */
  createdInfluencerId: string | null;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateData: (partial: Partial<WizardData>) => void;
  setGeneratedImages: (images: string[]) => void;
  setSelectedImageIndex: (index: number) => void;
  setIsGenerating: (val: boolean) => void;
  setCreatedInfluencerId: (id: string | null) => void;
  reset: () => void;
}

const initialData: WizardData = {
  name: "",
  gender: "female",
  bio: "",
  personality: "",
  angle: "",
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
      createdInfluencerId: null,
      setStep: (step) => set({ step }),
      nextStep: () => set((s) => ({ step: Math.min(s.step + 1, 4) })),
      prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),
      updateData: (partial) =>
        set((s) => ({ data: { ...s.data, ...partial } })),
      setGeneratedImages: (images) => set({ generatedImages: images }),
      setSelectedImageIndex: (index) => set({ selectedImageIndex: index }),
      setIsGenerating: (val) => set({ isGenerating: val }),
      setCreatedInfluencerId: (id) => set({ createdInfluencerId: id }),
      reset: () =>
        set({
          step: 1,
          data: { ...initialData },
          generatedImages: [],
          selectedImageIndex: 0,
          isGenerating: false,
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
        createdInfluencerId: s.createdInfluencerId,
      }),
      version: 6,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as {
          data?: Partial<WizardData>;
          entryMode?: unknown;
          expressMode?: unknown;
        };
        if (version < 3 && state.data) {
          state.data = {
            ...initialData,
            ...state.data,
            ...defaultWizardAppearanceV2(),
          };
        }
        // v5 — the Guided/Express choice + express mode were removed in favour
        // of a single linear flow. Drop the stale fields from older drafts.
        if (version < 5) {
          delete state.entryMode;
          delete state.expressMode;
        }
        // v6 — angle field (niche positioning) for simplified identity step.
        if (version < 6 && state.data) {
          state.data = {
            ...state.data,
            angle: state.data.angle ?? state.data.brief ?? "",
          };
        }
        return persisted as typeof persisted;
      },
    }
  )
);

