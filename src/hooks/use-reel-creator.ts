"use client";

import { create } from "zustand";
import {
  reelBriefToReelCreatorParams,
  type ReelBrief,
} from "@/lib/viral-brief";

export interface ReelParams {
  influencerId: string;
  duration: 15 | 30 | 60;
  format: "VERTICAL" | "SQUARE";
  videoType: string;
  script: string;
  /** Explicit scene for the first frame (English recommended). */
  sceneDescription: string;
  outfit: string;
  music: string;
  effects: string[];
  textOverlay: string;
  contentMode: "SFW" | "NSFW";
  nsfwLevel: string;
  /** Video identity / motion tradeoff (MiniMax prompt + optimizer). */
  reelStylePreset:
    | "stable_face"
    | "natural_motion"
    | "classic_motion"
    | "creative"
    | "lip_sync";
  /** Public HTTPS URL to narration (MP3/WAV) — required for lip_sync post-process. */
  audioUrl: string;
  /** Generate a scene photo before animating (recommended). */
  generateSceneFrame: boolean;
  /** Trend source MP4 for motion control reels. */
  motionSourceVideoUrl?: string;
  fromTrend?: boolean;
}

interface ReelCreatorState {
  params: ReelParams;
  updateParams: (partial: Partial<ReelParams>) => void;
  contentId: string | null;
  isGenerating: boolean;
  generationStep: string;
  generationProgress: number;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  selectedThumbnailIndex: number;
  setContentId: (id: string | null) => void;
  setIsGenerating: (val: boolean) => void;
  setGenerationStep: (step: string) => void;
  setGenerationProgress: (p: number) => void;
  setVideoUrl: (url: string | null) => void;
  setThumbnailUrl: (url: string | null) => void;
  setSelectedThumbnailIndex: (i: number) => void;
  // Shared publish state
  caption: string;
  hashtags: string[];
  platforms: string[];
  scheduledAt: Date | null;
  setCaption: (val: string) => void;
  setHashtags: (val: string[]) => void;
  setPlatforms: (val: string[]) => void;
  setScheduledAt: (val: Date | null) => void;
  generateNonce: number;
  requestGenerate: () => void;
  applyParamsAndGenerate: (partial: Partial<ReelParams>) => void;
  applyReelBrief: (brief: ReelBrief, influencerId: string) => void;
  reset: () => void;
}

const defaultParams: ReelParams = {
  influencerId: "",
  duration: 15,
  format: "VERTICAL",
  videoType: "talking_head",
  script: "",
  sceneDescription: "",
  outfit: "",
  music: "none",
  generateSceneFrame: true,
  effects: [],
  textOverlay: "",
  contentMode: "SFW",
  nsfwLevel: "suggestive",
  reelStylePreset: "natural_motion",
  audioUrl: "",
};

export const useReelCreator = create<ReelCreatorState>()((set) => ({
  params: { ...defaultParams },
  updateParams: (partial) =>
    set((s) => ({ params: { ...s.params, ...partial } })),
  contentId: null,
  isGenerating: false,
  generationStep: "",
  generationProgress: 0,
  videoUrl: null,
  thumbnailUrl: null,
  selectedThumbnailIndex: 0,
  setContentId: (id) => set({ contentId: id }),
  setIsGenerating: (val) => set({ isGenerating: val }),
  setGenerationStep: (step) => set({ generationStep: step }),
  setGenerationProgress: (p) => set({ generationProgress: p }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  setThumbnailUrl: (url) => set({ thumbnailUrl: url }),
  setSelectedThumbnailIndex: (i) => set({ selectedThumbnailIndex: i }),
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
  applyParamsAndGenerate: (partial) =>
    set((s) => ({
      params: { ...s.params, ...partial },
      generateNonce: s.generateNonce + 1,
      videoUrl: null,
    })),
  applyReelBrief: (brief, influencerId) => {
    const partial = reelBriefToReelCreatorParams(brief, influencerId);
    set((s) => ({
      params: { ...s.params, ...partial },
      caption: brief.hook ?? s.caption,
      hashtags: brief.hashtags ?? s.hashtags,
      videoUrl: null,
    }));
  },
  reset: () =>
    set({
      params: { ...defaultParams },
      contentId: null,
      isGenerating: false,
      generationStep: "",
      generationProgress: 0,
      videoUrl: null,
      thumbnailUrl: null,
      selectedThumbnailIndex: 0,
      caption: "",
      hashtags: [],
      platforms: [],
      scheduledAt: null,
      generateNonce: 0,
    }),
}));

