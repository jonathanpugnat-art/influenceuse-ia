"use client";

import { Package } from "lucide-react";
import type { PhotoPublishFlowState } from "@/hooks/photo-studio";

export function PhotoPublishActionsSection({
  flow,
}: {
  flow: PhotoPublishFlowState;
}) {
  const {
    contentId,
    platforms,
    scheduleMode,
    handleSave,
    handleOFBundle,
    updateMutation,
    bundleMutation,
  } = flow;

  return (
    <div className="space-y-2 pt-2">
      <button
        type="button"
        onClick={() => handleSave(false)}
        disabled={!contentId || updateMutation.isPending}
        className="w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
      >
        Sauvegarder en brouillon
      </button>
      <button
        type="button"
        onClick={() => handleSave(true)}
        disabled={
          !contentId || updateMutation.isPending || platforms.length === 0
        }
        className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {scheduleMode === "schedule" ? "Programmer" : "Publier"}
      </button>
      {platforms.includes("ONLYFANS") && (
        <button
          type="button"
          onClick={handleOFBundle}
          disabled={!contentId || bundleMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500/20 py-2.5 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30 disabled:opacity-40"
        >
          <Package className="h-4 w-4" />
          {bundleMutation.isPending
            ? "Préparation..."
            : "Télécharger le pack OF"}
        </button>
      )}
    </div>
  );
}
