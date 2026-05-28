"use client";

import { Shirt } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import {
  getOutfitSuggestionsForNiche,
  type InfluencerGender,
} from "@/lib/photo-niche-defaults";
import { cn } from "@/lib/utils";

export function PhotoStudioOutfitSection({
  niche,
  gender,
  disabled,
}: {
  niche: string;
  gender: InfluencerGender;
  disabled?: boolean;
}) {
  const t = useTranslations("content");
  const { params, updateParams } = usePhotoCreator();
  const suggestions = getOutfitSuggestionsForNiche(niche, gender);

  return (
    <div className="space-y-3 rounded-xl border border-violet-500/25 bg-violet-500/5 p-3">
      <div className="flex items-center gap-2">
        <Shirt className="h-4 w-4 text-violet-400" />
        <Label className="text-sm font-medium text-white">{t("outfit")}</Label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((o) => (
          <button
            key={o}
            type="button"
            disabled={disabled}
            onClick={() => updateParams({ outfit: o })}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              params.outfit === o
                ? "border-violet-500 bg-violet-500/25 text-violet-100"
                : "border-slate-600/80 bg-slate-800/40 text-slate-400 hover:border-slate-500 hover:text-slate-200",
              disabled && "pointer-events-none opacity-40"
            )}
          >
            {o}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-slate-500">{t("studioOutfitCustom")}</Label>
        <Input
          value={params.outfit}
          disabled={disabled}
          onChange={(e) => updateParams({ outfit: e.target.value })}
          placeholder={t("outfitPlaceholder")}
          className="h-10 border-slate-700/80 bg-slate-900/60 text-sm text-white placeholder:text-slate-600"
        />
      </div>

      {params.outfit.trim() ? (
        <p className="text-[11px] leading-snug text-emerald-400/90">
          {t("studioOutfitSelected")}: <span className="text-emerald-200">{params.outfit}</span>
        </p>
      ) : (
        <p className="text-[11px] text-amber-500/90">{t("studioOutfitEmpty")}</p>
      )}
    </div>
  );
}
