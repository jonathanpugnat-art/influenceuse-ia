"use client";

import { create } from "zustand";

interface CalendarAgentState {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  /** Batch awaiting lot validation (S5). */
  reviewBatchId: string | null;
  setReviewBatchId: (batchId: string | null) => void;
}

export const useCalendarAgentStore = create<CalendarAgentState>((set) => ({
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  reviewBatchId: null,
  setReviewBatchId: (batchId) => set({ reviewBatchId: batchId }),
}));
