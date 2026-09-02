"use client";

import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
  const locale = useLocale();
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
    contentKind,
  } = flow;

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{t("studioToneLabel")}</Label>
      <div className="flex flex-wrap gap-1.5">
        {CAPTION_TONES.map((tone) => (
          <button
            key={tone.id}
            type="button"
            onClick={() => setCaptionTone(tone.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
              captionTone === tone.id
                ? "border-rose-400/60 bg-rose-500/10 text-rose-200"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            {locale === "en" ? tone.labelEn : tone.labelFr}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{t("publishCaptionLabel")}</Label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGenCaption}
            disabled={isGenCaption || isGenVariants || !params.influencerId}
            className="flex items-center gap-1 text-xs font-medium text-rose-400 hover:text-rose-300 disabled:opacity-40"
          >
            <Sparkles className="h-3 w-3" />
            {isGenCaption ? t("publishGenerating") : t("publishGenerate")}
          </button>
          <button
            type="button"
            onClick={handleGenVariants}
            disabled={isGenVariants || isGenCaption || !params.influencerId}
            className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:opacity-40"
            title={t("publishVariantsTooltip")}
          >
            {isGenVariants ? "A/B…" : "A/B"}
          </button>
        </div>
      </div>
      {variants && variants.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("publishVariantsTitle")}
          </p>
          {variants.map((v, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pickVariant(v)}
              className="block w-full rounded-lg border border-border/60 bg-background/60 p-2.5 text-left text-xs text-foreground transition-colors hover:border-rose-400/50"
            >
              <span className="mb-1 block text-[10px] font-bold text-rose-400">
                {t("publishVariantLabel", { letter: i === 0 ? "A" : "B" })}
              </span>
              {v}
            </button>
          ))}
        </div>
      )}
      <Textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder={t("publishCaptionPlaceholder")}
        rows={4}
        className="text-sm"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground/70">
          {t("publishCharCount", { count: caption.length })}
        </span>
        <div className="flex gap-1.5">
          <Select
            value={language}
            onValueChange={(v) => setLanguage(v as "fr" | "en")}
          >
            <SelectTrigger className="h-7 w-16 px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr" className="text-xs">
                FR
              </SelectItem>
              <SelectItem value="en" className="text-xs">
                EN
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={captionPlatform} onValueChange={setCaptionPlatform}>
            <SelectTrigger className="h-7 w-24 px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INSTAGRAM" className="text-xs">
                Instagram
              </SelectItem>
              {contentKind === "REEL" && (
                <SelectItem value="TIKTOK" className="text-xs">
                  TikTok
                </SelectItem>
              )}
              <SelectItem value="ONLYFANS" className="text-xs">
                OnlyFans
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
