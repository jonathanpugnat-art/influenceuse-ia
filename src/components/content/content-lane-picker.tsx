"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getPremiumPhotoDefaults,
  getSocialPhotoDefaults,
  laneFromContentMode,
  type ContentLane,
} from "@/lib/premium-content";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { PLANS } from "@/lib/constants";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function LaneChip({
  label,
  emoji,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  emoji?: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
        disabled && "cursor-not-allowed opacity-35",
        selected
          ? "border-violet-500 bg-violet-500/20 text-violet-300"
          : "border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600",
        disabled && !selected && "hover:border-slate-700"
      )}
    >
      {emoji && <span className="mr-1">{emoji}</span>}
      {label}
    </button>
  );
}

type ContentLanePickerProps = {
  /** Compact styling for the agent panel */
  variant?: "default" | "studio";
  showFaceReference?: boolean;
  showSceneFirst?: boolean;
  showPremiumIntensity?: boolean;
};

export function ContentLanePicker({
  variant = "default",
  showFaceReference = true,
  showSceneFirst = true,
  showPremiumIntensity = true,
}: ContentLanePickerProps) {
  const t = useTranslations("content");
  const { params, updateParams } = usePhotoCreator();
  const planQuery = trpc.billing.getCurrentPlan.useQuery();
  const canSceneFirst = planQuery.data
    ? PLANS[planQuery.data.plan as keyof typeof PLANS].hasSceneFirstPipeline
    : false;
  const allowNsfw = planQuery.data?.features.hasNsfw ?? false;

  const { data: influencersData } = trpc.influencer.getAll.useQuery(
    { limit: 50 },
    { placeholderData: (prev) => prev }
  );
  const influencers = influencersData?.influencers ?? [];
  const selectedInfluencer = influencers.find((i) => i.id === params.influencerId);

  useEffect(() => {
    if (!allowNsfw && params.contentMode === "NSFW") {
      updateParams(getSocialPhotoDefaults(params.pose));
    }
  }, [allowNsfw, params.contentMode, params.pose, updateParams]);

  if (!params.influencerId) return null;

  const contentLane: ContentLane = laneFromContentMode(params.contentMode);
  const isPremium = contentLane === "premium";

  const setContentLane = (lane: ContentLane) => {
    if (lane === "premium") {
      updateParams(getPremiumPhotoDefaults(params.pose));
    } else {
      updateParams(getSocialPhotoDefaults(params.pose));
    }
  };

  const borderClass =
    variant === "studio"
      ? "border-neutral-800/60 bg-neutral-900/40"
      : "border-slate-800/50 bg-slate-800/20";

  return (
    <div className="space-y-3">
      <div className={cn("space-y-2 rounded-xl border p-3", borderClass)}>
        <Label className="text-xs text-slate-400">{t("contentLaneLabel")}</Label>
        <div className="flex flex-wrap gap-1.5">
          <LaneChip
            label={t("contentLaneSocial")}
            emoji="📱"
            selected={contentLane === "social"}
            onClick={() => setContentLane("social")}
          />
          {allowNsfw && (
            <LaneChip
              label={t("contentLanePremium")}
              emoji="🔒"
              selected={contentLane === "premium"}
              onClick={() => setContentLane("premium")}
            />
          )}
        </div>
        <p className="text-[11px] leading-snug text-slate-500">
          {isPremium ? t("contentLanePremiumHint") : t("contentLaneSocialHint")}
        </p>
      </div>

      {showPremiumIntensity && isPremium && (
        <div className="space-y-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
          <Label className="text-xs text-rose-200/90">{t("premiumIntensity")}</Label>
          <div className="flex flex-wrap gap-1.5">
            <LaneChip
              label={t("nsfwSuggestive")}
              selected={params.nsfwLevel === "suggestive"}
              onClick={() => updateParams({ nsfwLevel: "suggestive" })}
            />
            <LaneChip
              label={t("nsfwSoft")}
              selected={params.nsfwLevel === "soft"}
              onClick={() => updateParams({ nsfwLevel: "soft" })}
            />
          </div>
          <p className="text-[11px] text-slate-500">{t("premiumIntensityHint")}</p>
        </div>
      )}

      {showSceneFirst && !isPremium && canSceneFirst && (
        <div className="space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label className="text-xs text-emerald-200/90">{t("sceneFirstLabel")}</Label>
              <p className="mt-0.5 text-xs leading-snug text-slate-500">
                {t("sceneFirstHint")}
              </p>
            </div>
            <Switch
              checked={params.sceneFirst && params.useFaceReference}
              disabled={!params.useFaceReference}
              onCheckedChange={(v) => updateParams({ sceneFirst: v })}
              className="shrink-0"
            />
          </div>
          {!params.useFaceReference && (
            <p className="text-[11px] text-amber-600/90">{t("sceneFirstNeedsFaceRef")}</p>
          )}
        </div>
      )}

      {showFaceReference && (
        <div className={cn("space-y-2 rounded-xl border p-3", borderClass)}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label className="text-xs text-slate-300">{t("faceReferenceLabel")}</Label>
              <p className="mt-0.5 text-xs leading-snug text-slate-500">
                {t("faceReferenceHint")}
              </p>
            </div>
            <Switch
              checked={params.useFaceReference}
              disabled={
                isPremium ||
                !(
                  Boolean(selectedInfluencer?.baseImageUrl?.trim()) ||
                  Boolean(selectedInfluencer?.avatarUrl?.trim())
                )
              }
              onCheckedChange={(v) =>
                updateParams({
                  useFaceReference: v,
                  sceneFirst: v ? params.sceneFirst : false,
                })
              }
              className="shrink-0"
            />
          </div>
          {isPremium ? (
            <p className="text-xs text-amber-500/90">{t("faceReferencePremiumNote")}</p>
          ) : selectedInfluencer &&
            !(
              selectedInfluencer.baseImageUrl?.trim() ||
              selectedInfluencer.avatarUrl?.trim()
            ) ? (
            <p className="text-xs text-slate-500">{t("faceReferenceNoRef")}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ContentLaneBadge() {
  const t = useTranslations("content");
  const { params } = usePhotoCreator();
  const isPremium = params.contentMode === "NSFW";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        isPremium
          ? "border border-rose-500/30 bg-rose-500/10 text-rose-300"
          : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      )}
    >
      {isPremium ? t("contentLanePremium") : t("contentLaneSocial")}
    </span>
  );
}
