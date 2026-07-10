"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CAPTION_TONES } from "@/lib/caption-tones";
import { cn } from "@/lib/utils";
import type { PhotoPublishFlowState } from "@/hooks/photo-studio";

export function PhotoPublishCaptionSection({
  flow,
}: {
  flow: PhotoPublishFlowState;
}) {
  const t = useTranslations("content");
  const {
    params,
    caption,
    setCaption,
    language,
    setLanguage,
    captionPlatform,
    setCaptionPlatform,
    captionTone,
    setCaptionTone,
    variants,
    isGenCaption,
    isGenVariants,
    handleGenCaption,
    handleGenVariants,
    pickVariant,
  } = flow;

  return (
    <div className="space-y-2">
      <Label className="text-xs text-slate-400">{t("studioToneLabel")}</Label>
      <div className="flex flex-wrap gap-1.5">
        {CAPTION_TONES.map((tone) => (
          <button
            key={tone.id}
            type="button"
            onClick={() => setCaptionTone(tone.id)}
            className={cn(
              "rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors",
              captionTone === tone.id
                ? "border-violet-500 bg-violet-500/20 text-violet-200"
                : "border-slate-700 text-slate-500 hover:border-slate-600"
            )}
          >
            {tone.labelFr}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-slate-400">Caption</Label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGenCaption}
            disabled={isGenCaption || isGenVariants || !params.influencerId}
            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-40"
          >
            <Sparkles className="h-3 w-3" />
            {isGenCaption ? "Génération..." : "Générer"}
          </button>
          <button
            type="button"
            onClick={handleGenVariants}
            disabled={isGenVariants || isGenCaption || !params.influencerId}
            className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300 hover:bg-violet-500/20 disabled:opacity-40"
            title="Génère 2 variantes A/B et choisis la meilleure"
          >
            {isGenVariants ? "A/B…" : "A/B"}
          </button>
        </div>
      </div>
      {variants && variants.length > 0 && (
        <div className="space-y-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-violet-300">
            2 variantes — choisis la meilleure
          </p>
          {variants.map((v, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pickVariant(v)}
              className="block w-full rounded-md border border-slate-700/60 bg-slate-900/60 p-2.5 text-left text-xs text-slate-200 transition-colors hover:border-violet-500/60 hover:bg-slate-900"
            >
              <span className="mb-1 block text-[10px] font-bold text-violet-400">
                Variante {i === 0 ? "A" : "B"}
              </span>
              {v}
            </button>
          ))}
        </div>
      )}
      <Textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Écris ta caption ici..."
        rows={4}
        className="border-slate-800/50 bg-slate-800/30 text-sm text-white placeholder:text-slate-600"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-600">{caption.length} caractères</span>
        <div className="flex gap-1.5">
          <Select
            value={language}
            onValueChange={(v) => setLanguage(v as "fr" | "en")}
          >
            <SelectTrigger className="h-6 w-14 border-slate-700 bg-slate-800/50 px-1.5 text-xs text-slate-400">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900">
              <SelectItem value="fr" className="text-xs text-slate-300">
                🇫🇷 FR
              </SelectItem>
              <SelectItem value="en" className="text-xs text-slate-300">
                🇬🇧 EN
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={captionPlatform} onValueChange={setCaptionPlatform}>
            <SelectTrigger className="h-6 w-20 border-slate-700 bg-slate-800/50 px-1.5 text-xs text-slate-400">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900">
              <SelectItem value="INSTAGRAM" className="text-xs text-slate-300">
                Instagram
              </SelectItem>
              <SelectItem value="TIKTOK" className="text-xs text-slate-300">
                TikTok
              </SelectItem>
              <SelectItem value="ONLYFANS" className="text-xs text-slate-300">
                OnlyFans
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
