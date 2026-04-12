"use client";

import { create } from "zustand";

export interface WizardData {
  // Step 1 — Identity
  name: string;
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

export const useInfluencerWizard = create<WizardState>()((set) => ({
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
}));

