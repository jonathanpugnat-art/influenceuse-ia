"use client";

import { Sparkles, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { PhotoPublishFlowState } from "@/hooks/photo-studio";

export function PhotoPublishHashtagsSection({
  flow,
}: {
  flow: PhotoPublishFlowState;
}) {
  const {
    hashtags,
    hashtagInput,
    setHashtagInput,
    isGenHashtags,
    selectedInf,
    handleGenHashtags,
    addHashtag,
    removeHashtag,
  } = flow;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-slate-400">Hashtags</Label>
        <button
          type="button"
          onClick={handleGenHashtags}
          disabled={isGenHashtags || !selectedInf}
          className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-40"
        >
          <Sparkles className="h-3 w-3" />
          {isGenHashtags ? "Génération..." : "Générer"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {hashtags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-0.5 text-xs text-violet-400"
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeHashtag(tag)}
              className="hover:text-red-400"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={hashtagInput}
          onChange={(e) => setHashtagInput(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), addHashtag())
          }
          placeholder="#hashtag"
          className="h-7 border-slate-800/50 bg-slate-800/30 text-xs text-white placeholder:text-slate-600"
        />
      </div>
      <p className="text-xs text-slate-600">{hashtags.length}/30 hashtags</p>
    </div>
  );
}
