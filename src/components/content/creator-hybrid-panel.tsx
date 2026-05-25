"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, SlidersHorizontal, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { useReelCreator } from "@/hooks/use-reel-creator";
import {
  useCreatorExpertMode,
  type CreatorVariant,
} from "@/hooks/use-creator-expert-mode";
import {
  PHOTO_QUICK_INTENTS,
  REEL_QUICK_INTENTS,
  applyPhotoQuickIntent,
  applyReelQuickIntent,
  type PhotoQuickIntentId,
  type ReelQuickIntentId,
} from "@/lib/content-quick-intents";
import {
  PHOTO_PROMPT_CHIPS,
  REEL_PROMPT_CHIPS,
  appendPromptSnippet,
} from "@/lib/prompt-chips";
import type { InfluencerGender } from "@/lib/photo-niche-defaults";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function CreatorHybridPanel({
  variant,
  influencerGender = "female",
  influencerNiche,
  influencerId,
}: {
  variant: CreatorVariant;
  influencerGender?: InfluencerGender;
  influencerNiche?: string;
  influencerId?: string;
}) {
  const t = useTranslations("content");
  const router = useRouter();
  const { expert, setExpert, hydrated } = useCreatorExpertMode(variant);
  const photo = usePhotoCreator();
  const reel = useReelCreator();

  const intents = variant === "photo" ? PHOTO_QUICK_INTENTS : REEL_QUICK_INTENTS;
  const chips = variant === "photo" ? PHOTO_PROMPT_CHIPS : REEL_PROMPT_CHIPS;
  const ns = variant === "photo" ? "quickIntents.photo" : "quickIntents.reel";

  const sceneDescription =
    variant === "photo"
      ? photo.params.sceneDescription
      : reel.params.sceneDescription;

  const setSceneDescription = (value: string) => {
    if (variant === "photo") {
      photo.updateParams({ sceneDescription: value, scene: "custom" });
    } else {
      reel.updateParams({ sceneDescription: value });
    }
  };

  const onIntent = (id: string) => {
    if (variant === "photo") {
      const patch = applyPhotoQuickIntent(
        id as PhotoQuickIntentId,
        influencerGender,
        influencerNiche
      );
      photo.updateParams(patch);
      toast.success(t("quickIntentApplied"));
      return;
    }

    if (id === "batch") {
      if (!influencerId) {
        toast.error(t("selectInfluencerFirst"));
        return;
      }
      router.push(`/calendar?influencer=${influencerId}&schedule=1`);
      return;
    }

    const patch = applyReelQuickIntent(id as ReelQuickIntentId);
    reel.updateParams(patch);
    toast.success(t("quickIntentApplied"));
  };

  if (!hydrated) return null;

  return (
    <div className="mb-5 space-y-4 border-b border-slate-800/50 pb-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">
            {t("quickCreateTitle")}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            {expert ? t("quickCreateExpertHint") : t("quickCreateSimpleHint")}
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2">
          <span className="text-[10px] font-medium text-slate-500">
            {t("expertModeLabel")}
          </span>
          <Switch
            checked={expert}
            onCheckedChange={setExpert}
            className="scale-90"
          />
          <SlidersHorizontal
            className={cn(
              "h-3.5 w-3.5",
              expert ? "text-violet-400" : "text-slate-600"
            )}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {intents.map((item) => {
          const isBatch = variant === "reel" && item.id === "batch";
          const inner = (
            <>
              <span className="text-lg leading-none">{item.emoji}</span>
              <span className="mt-1 block text-xs font-semibold text-white">
                {t(`${ns}.${item.titleKey}`)}
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
                {t(`${ns}.${item.descKey}`)}
              </span>
            </>
          );

          if (isBatch) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onIntent(item.id)}
                className="rounded-xl border border-slate-700/80 bg-slate-800/30 p-3 text-left transition-all hover:border-violet-500/40 hover:bg-violet-500/10"
              >
                {inner}
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onIntent(item.id)}
              className="rounded-xl border border-slate-700/80 bg-slate-800/30 p-3 text-left transition-all hover:border-violet-500/40 hover:bg-violet-500/10"
            >
              {inner}
            </button>
          );
        })}
      </div>

      <div className="space-y-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-3.5 w-3.5 text-violet-400" />
          <Label className="text-xs font-medium text-violet-200/90">
            {variant === "photo" ? t("briefBarPhoto") : t("briefBarReelScene")}
          </Label>
        </div>
        <Textarea
          value={sceneDescription}
          onChange={(e) => setSceneDescription(e.target.value)}
          placeholder={t("briefBarPlaceholder")}
          rows={expert ? 4 : 3}
          className="border-slate-700/60 bg-slate-900/50 text-sm text-white placeholder:text-slate-600"
        />
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() =>
                setSceneDescription(
                  appendPromptSnippet(sceneDescription, chip.snippet)
                )
              }
              className="rounded-full border border-slate-700 bg-slate-800/50 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-violet-500/50 hover:text-violet-200"
            >
              {t(`promptChips.${chip.labelKey}`)}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-600">{t("briefBarHint")}</p>
      </div>

      {variant === "reel" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">{t("briefBarReelMotion")}</Label>
          <Textarea
            value={reel.params.script}
            onChange={(e) => reel.updateParams({ script: e.target.value })}
            placeholder={t("reelMotionPlaceholder")}
            rows={expert ? 4 : 2}
            className="border-slate-800/50 bg-slate-800/30 text-sm text-white placeholder:text-slate-600"
          />
        </div>
      )}

      {!expert && (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Sparkles className="h-3 w-3 text-violet-400/80" />
          {t("expertModeTeaser")}
          <button
            type="button"
            onClick={() => setExpert(true)}
            className="font-medium text-violet-400 hover:underline"
          >
            {t("expertModeEnable")}
          </button>
        </p>
      )}

      {variant === "reel" && !influencerId && (
        <p className="text-[10px] text-amber-600/90">
          {t("quickBatchNeedsInfluencer")}{" "}
          <Link href="/influencers" className="text-violet-400 hover:underline">
            {t("createLink")}
          </Link>
        </p>
      )}
    </div>
  );
}

/** Re-export for params panels */
export { useCreatorExpertMode };
