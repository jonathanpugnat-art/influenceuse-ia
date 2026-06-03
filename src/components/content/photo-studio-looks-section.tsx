"use client";

import Image from "next/image";
import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import {
  PHOTO_STUDIO_LOOKS,
  applyStudioLook,
} from "@/lib/photo-studio-looks";
import type { InfluencerGender } from "@/lib/photo-niche-defaults";
import { cn } from "@/lib/utils";

export function PhotoStudioLooksSection({
  gender,
  disabled,
}: {
  gender: InfluencerGender;
  disabled?: boolean;
}) {
  const t = useTranslations("content");
  const locale = useLocale();
  const { params, updateParams } = usePhotoCreator();

  const pickLook = (lookId: string) => {
    updateParams(
      applyStudioLook(lookId, gender, params.sceneDetail)
    );
  };

  return (
    <div className="space-y-3 rounded-xl border border-violet-500/25 bg-violet-500/5 p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <div>
          <p className="text-sm font-medium text-white">{t("studioLooksTitle")}</p>
          <p className="text-[10px] text-slate-500">{t("studioLooksHint")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {PHOTO_STUDIO_LOOKS.map((look) => {
          const selected = params.lookId === look.id;
          const label = locale === "fr" ? look.nameFr : look.nameEn;
          return (
            <button
              key={look.id}
              type="button"
              disabled={disabled}
              onClick={() => pickLook(look.id)}
              className={cn(
                "group relative overflow-hidden rounded-xl border text-left transition-all",
                selected
                  ? "border-violet-500 ring-1 ring-violet-500/40"
                  : "border-slate-700/80 hover:border-slate-600",
                disabled && "pointer-events-none opacity-40"
              )}
            >
              <div className="relative aspect-[4/3] bg-slate-800/60">
                {look.previewSrc ? (
                  <Image
                    src={look.previewSrc}
                    alt=""
                    fill
                    className="object-cover opacity-90 transition-transform group-hover:scale-105"
                    sizes="180px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl">
                    {look.emoji}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute bottom-2 left-2 text-lg">{look.emoji}</span>
              </div>
              <div className="px-2 py-2">
                <p
                  className={cn(
                    "text-[11px] font-semibold leading-tight",
                    selected ? "text-violet-200" : "text-slate-300"
                  )}
                >
                  {label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {!params.lookId && (
        <p className="text-[11px] text-amber-500/90">{t("studioLooksEmpty")}</p>
      )}
    </div>
  );
}
