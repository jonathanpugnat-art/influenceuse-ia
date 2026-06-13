"use client";

import { create } from "zustand";

export interface PhotoParams {
  influencerId: string;
  /** Selected studio look (CONTENT_TEMPLATES id). Drives preset scene + Instagram Shot lane. */
  lookId: string | null;
  /** Optional user detail merged into the look scene (FR ok). */
  sceneDetail: string;
  /** When true, prefer Kontext for face-locked social photos (studio looks). */
  instagramShot: boolean;
  /** Preset id for analytics/templates; use "custom" when the user edits the scene text. */
  scene: string;
  /** Free-form environment description from the user. Translated server-side for the image prompt. */
  sceneDescription: string;
  pose: string;
  outfit: string;
  expression: string;
  photoStyle: string;
  timeOfDay: string;
  location: string;
  customPrompt: string;
  numberOfImages: number;
  /** When true, SFW photos use base/avatar image + identity prompts (Flux). */
  useFaceReference: boolean;
  /** Two-step pipeline: environment plate then Nano compose (SFW). */
  sceneFirst: boolean;
  contentMode: "SFW" | "NSFW";
  nsfwLevel: string;
  /** Optional scraped trend metadata for server-side prompt enrichment. */
  trendContext?: {
    title?: string;
    hashtags?: string[];
  };
}

/**
 * v0.12 — Shape used when seeding the photo creator from a Trend
 * recommendation. Kept loose on purpose (Partial) so the trends router can
 * evolve without touching this hook.
 */
export interface PhotoCreatorSeed {
  influencerId?: string;
  lookId?: string | null;
  instagramShot?: boolean;
  scene?: string;
  sceneDescription?: string;
  pose?: string;
  outfit?: string;
  expression?: string;
  customPrompt?: string;
  useFaceReference?: boolean;
  sceneFirst?: boolean;
  /** Optional hook copied into the caption textarea. */
  caption?: string;
  hashtags?: string[];
  trendContext?: {
    title?: string;
    hashtags?: string[];
  };
}

interface PhotoCreatorState {
  // Params
  params: PhotoParams;
  updateParams: (partial: Partial<PhotoParams>) => void;
  /** Convenience: apply a Trends seed in one call (params + caption + tags). */
  applySeed: (seed: PhotoCreatorSeed) => void;
  // Generation
  contentId: string | null;
  /** Approved scene plate URL between step 1 and 2. */
  scenePlateUrl: string | null;
  isGenerating: boolean;
  generationStep: string;
  generatedUrls: string[];
  selectedImageIndex: number;
  setContentId: (id: string | null) => void;
  setScenePlateUrl: (url: string | null) => void;
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
  /** Increment to trigger classic generation from PhotoPreview. */
  generateNonce: number;
  requestGenerate: () => void;
  // Reset
  reset: () => void;
}

const defaultParams: PhotoParams = {
  influencerId: "",
  lookId: null,
  sceneDetail: "",
  instagramShot: false,
  scene: "custom",
  sceneDescription: "",
  pose: "candid",
  outfit: "",
  expression: "smile",
  photoStyle: "natural",
  timeOfDay: "natural",
  location: "",
  customPrompt: "",
  numberOfImages: 1,
  useFaceReference: true,
  sceneFirst: false,
  contentMode: "SFW",
  nsfwLevel: "suggestive",
  trendContext: undefined,
};

export const usePhotoCreator = create<PhotoCreatorState>()((set) => ({
  params: { ...defaultParams },
  updateParams: (partial) =>
    set((s) => ({ params: { ...s.params, ...partial } })),
  applySeed: (seed) =>
    set((s) => {
      const {
        caption: captionSeed,
        hashtags: hashtagsSeed,
        ...paramSeed
      } = seed;
      return {
        params: { ...s.params, ...paramSeed },
        ...(captionSeed !== undefined ? { caption: captionSeed } : {}),
        ...(hashtagsSeed !== undefined ? { hashtags: hashtagsSeed } : {}),
      };
    }),
  contentId: null,
  scenePlateUrl: null,
  isGenerating: false,
  generationStep: "",
  generatedUrls: [],
  selectedImageIndex: 0,
  setContentId: (id) => set({ contentId: id }),
  setScenePlateUrl: (url) => set({ scenePlateUrl: url }),
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
  generateNonce: 0,
  requestGenerate: () =>
    set((s) => ({ generateNonce: s.generateNonce + 1 })),
  reset: () =>
    set({
      params: { ...defaultParams },
      contentId: null,
      scenePlateUrl: null,
      isGenerating: false,
      generationStep: "",
      generatedUrls: [],
      selectedImageIndex: 0,
      caption: "",
      hashtags: [],
      platforms: [],
      scheduledAt: null,
      generateNonce: 0,
    }),
}));

