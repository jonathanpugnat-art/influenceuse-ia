"use client";

import { create } from "zustand";

export interface PhotoParams {
  influencerId: string;
  scene: string;
  pose: string;
  outfit: string;
  expression: string;
  photoStyle: string;
  timeOfDay: string;
  customPrompt: string;
  numberOfImages: number;
  contentMode: "SFW" | "NSFW";
  nsfwLevel: string;
}

interface PhotoCreatorState {
  // Params
  params: PhotoParams;
  updateParams: (partial: Partial<PhotoParams>) => void;
  // Generation
  contentId: string | null;
  isGenerating: boolean;
  generationStep: string;
  generatedUrls: string[];
  selectedImageIndex: number;
  setContentId: (id: string | null) => void;
  setIsGenerating: (val: boolean) => void;
  setGenerationStep: (step: string) => void;
  setGeneratedUrls: (urls: string[]) => void;
  setSelectedImageIndex: (i: number) => void;
  // Publish
  caption: string;
  hashtags: string[];
  platforms: string[];
  scheduledAt: Date | null;
  setCaption: (val: string) => void;
  setHashtags: (val: string[]) => void;
  setPlatforms: (val: string[]) => void;
  setScheduledAt: (val: Date | null) => void;
  // Reset
  reset: () => void;
}

const defaultParams: PhotoParams = {
  influencerId: "",
  scene: "studio",
  pose: "portrait",
  outfit: "",
  expression: "smile",
  photoStyle: "natural",
  timeOfDay: "natural",
  customPrompt: "",
  numberOfImages: 1,
  contentMode: "SFW",
  nsfwLevel: "suggestive",
};

export const usePhotoCreator = create<PhotoCreatorState>()((set) => ({
  params: { ...defaultParams },
  updateParams: (partial) =>
    set((s) => ({ params: { ...s.params, ...partial } })),
  contentId: null,
  isGenerating: false,
  generationStep: "",
  generatedUrls: [],
  selectedImageIndex: 0,
  setContentId: (id) => set({ contentId: id }),
  setIsGenerating: (val) => set({ isGenerating: val }),
  setGenerationStep: (step) => set({ generationStep: step }),
  setGeneratedUrls: (urls) => set({ generatedUrls: urls, selectedImageIndex: 0 }),
  setSelectedImageIndex: (i) => set({ selectedImageIndex: i }),
  caption: "",
  hashtags: [],
  platforms: [],
  scheduledAt: null,
  setCaption: (val) => set({ caption: val }),
  setHashtags: (val) => set({ hashtags: val }),
  setPlatforms: (val) => set({ platforms: val }),
  setScheduledAt: (val) => set({ scheduledAt: val }),
  reset: () =>
    set({
      params: { ...defaultParams },
      contentId: null,
      isGenerating: false,
      generationStep: "",
      generatedUrls: [],
      selectedImageIndex: 0,
      caption: "",
      hashtags: [],
      platforms: [],
      scheduledAt: null,
    }),
}));

