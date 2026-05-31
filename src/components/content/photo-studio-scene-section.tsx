"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import {
  PHOTO_STUDIO_LOCATIONS,
  PHOTO_STUDIO_RECIPES,
  applyStudioLocation,
  applyStudioRecipe,
  isStudioLocationSelected,
  studioSceneRecapText,
  type PhotoStudioLocationId,
  type PhotoStudioRecipeId,
} from "@/lib/photo-studio-scenes";
import { getCompatiblePoseIds } from "@/lib/photo-scene-pose";
import type { InfluencerGender } from "@/lib/photo-niche-defaults";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const LIGHTING_TILES = [
  { id: "golden_hour", emoji: "🌅", labelKey: "studioLightGolden" },
  { id: "natural", emoji: "☀️", labelKey: "studioLightDay" },
  { id: "blue_hour", emoji: "🌇", labelKey: "studioLightBlue" },
  { id: "neon", emoji: "🌙", labelKey: "studioLightNeon" },
] as const;

const CAMERA_ANGLES = [
  { pose: "selfie", labelKey: "studioAngleSelfie" },
  { pose: "portrait", labelKey: "studioAnglePortrait" },
  { pose: "fullBody", labelKey: "studioAngleFull" },
  { pose: "candid", labelKey: "studioAngleCandid" },
] as const;

function Tile({
  selected,
  onClick,
  emoji,
  label,
  className,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  emoji?: string;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-center transition-all disabled:opacity-40",
        selected
          ? "border-emerald-500 bg-emerald-500/15 text-emerald-100"
          : "border-slate-700/80 bg-slate-800/30 text-slate-400 hover:border-slate-600 hover:text-slate-200",
        className
      )}
    >
      {emoji && <span className="text-base">{emoji}</span>}
      <span className="text-[10px] font-medium leading-tight">{label}</span>
    </button>
  );
}

export function PhotoStudioSceneSection({
  gender,
  niche,
  disabled,
}: {
  gender: InfluencerGender;
  niche: string;
  disabled?: boolean;
}) {
  const t = useTranslations("content");
  const { params, updateParams } = usePhotoCreator();
  const [activeRecipe, setActiveRecipe] = useState<PhotoStudioRecipeId | null>(null);
  const [propsText, setPropsText] = useState("");
  const [tweaksOpen, setTweaksOpen] = useState(false);

  const sceneLabel = (sceneId: string) => {
    const loc = PHOTO_STUDIO_LOCATIONS.find((l) => l.id === sceneId);
    if (loc) return t(loc.labelKey);
    const keys: Record<string, string> = {
      rooftop: t("sceneUrban"),
    };
    return keys[sceneId] ?? sceneId;
  };

  const recap = studioSceneRecapText(params, sceneLabel);

  const onRecipe = (id: PhotoStudioRecipeId) => {
    updateParams(applyStudioRecipe(id, gender, niche));
    setActiveRecipe(id);
    toast.success(t("studioRecipeApplied"));
  };

  const onLocation = (id: PhotoStudioLocationId) => {
    updateParams(applyStudioLocation(id, params.pose));
    setActiveRecipe(null);
  };

  const onRefine = (value: string) => {
    setActiveRecipe(null);
    updateParams({
      sceneDescription: value,
      scene: value.trim() ? "custom" : params.scene === "custom" ? "studio" : params.scene,
    });
  };

  const applyProps = (raw: string) => {
    setPropsText(raw);
    const trimmed = raw.trim();
    const base = params.sceneDescription.replace(/\s*\[Props:.*?\]\s*$/i, "").trim();
    if (!trimmed) {
      updateParams({ sceneDescription: base });
      return;
    }
    updateParams({
      sceneDescription: `${base} [Props: ${trimmed}]`.trim(),
      scene: "custom",
    });
  };

  const scenePoseInput = { scene: params.scene, sceneDescription: params.sceneDescription };
  const compatiblePoses = getCompatiblePoseIds(scenePoseInput);

  return (
    <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-emerald-400" />
        <Label className="text-sm font-medium text-white">{t("studioPillarScene")}</Label>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-slate-400">{t("studioRecipesTitle")}</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {PHOTO_STUDIO_RECIPES.map((recipe) => (
            <Tile
              key={recipe.id}
              emoji={recipe.emoji}
              label={t(recipe.labelKey)}
              selected={activeRecipe === recipe.id}
              disabled={disabled}
              onClick={() => onRecipe(recipe.id)}
              className="min-h-[52px]"
            />
          ))}
        </div>
        <p className="text-[10px] text-slate-500">{t("studioRecipesHint")}</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-slate-400">{t("studioLocationsTitle")}</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {PHOTO_STUDIO_LOCATIONS.map((loc) => (
            <Tile
              key={loc.id}
              emoji={loc.emoji}
              label={t(loc.labelKey)}
              selected={isStudioLocationSelected(loc.id, params)}
              disabled={disabled}
              onClick={() => onLocation(loc.id)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-slate-400">{t("studioSceneRefine")}</Label>
        <Textarea
          value={params.sceneDescription}
          disabled={disabled}
          onChange={(e) => onRefine(e.target.value)}
          placeholder={t("sceneDescriptionPlaceholder")}
          rows={2}
          className="border-slate-700/80 bg-slate-900/60 text-sm text-white placeholder:text-slate-600"
        />
        <p className="text-[10px] text-slate-500">{t("studioSceneRefineHint")}</p>
      </div>

      {recap ? (
        <p className="text-[11px] leading-snug text-emerald-400/90">
          {t("studioSceneActive")}: <span className="text-emerald-200">{recap}</span>
        </p>
      ) : (
        <p className="text-[11px] text-amber-500/90">{t("studioSceneEmpty")}</p>
      )}

      <Collapsible open={tweaksOpen} onOpenChange={setTweaksOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-slate-800/50 px-2.5 py-2 text-[11px] text-slate-500 hover:bg-slate-800/30">
          <span>{t("studioSceneTweaks")}</span>
          {tweaksOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-3">
          <div className="grid grid-cols-4 gap-1.5">
            {LIGHTING_TILES.map((tile) => (
              <Tile
                key={tile.id}
                emoji={tile.emoji}
                label={t(tile.labelKey)}
                selected={params.timeOfDay === tile.id}
                disabled={disabled}
                onClick={() => updateParams({ timeOfDay: tile.id })}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {CAMERA_ANGLES.map((a) => {
              const allowed = compatiblePoses.includes(a.pose);
              return (
                <Tile
                  key={a.pose}
                  label={t(a.labelKey)}
                  selected={params.pose === a.pose}
                  disabled={disabled || !allowed}
                  onClick={() => updateParams({ pose: a.pose })}
                  className={!allowed ? "opacity-35" : undefined}
                />
              );
            })}
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">{t("studioProps")}</Label>
            <Input
              value={propsText}
              disabled={disabled}
              onChange={(e) => setPropsText(e.target.value)}
              onBlur={(e) => applyProps(e.target.value)}
              placeholder={t("studioPropsPlaceholder")}
              className="h-9 border-slate-800/50 bg-slate-800/30 text-sm text-white"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
