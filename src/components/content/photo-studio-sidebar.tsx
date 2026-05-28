"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Dna,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { useCreatorExpertMode } from "@/hooks/use-creator-expert-mode";
import { PhotoParams } from "@/components/content/photo-params";
import { PhotoStudioOutfitSection } from "@/components/content/photo-studio-outfit-section";
import { CONTENT_TEMPLATES } from "@/lib/templates/content-templates";
import {
  PHOTO_QUICK_INTENTS,
  applyPhotoQuickIntent,
  type PhotoQuickIntentId,
} from "@/lib/content-quick-intents";
import { type InfluencerGender } from "@/lib/photo-niche-defaults";
import {
  getCompatiblePoseIds,
  pickDefaultPoseForScene,
} from "@/lib/photo-scene-pose";
import { getSceneInspirationText } from "@/lib/prompts/image-prompts";
import { PLANS } from "@/lib/constants";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PRIMARY_INTENTS: PhotoQuickIntentId[] = ["cafe", "ootd", "gym", "lifestyle"];

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

function Pillar({
  icon: Icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-slate-800/60 bg-slate-800/20 px-3 py-2.5 text-left transition-colors hover:bg-slate-800/40">
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <Icon className="h-4 w-4 text-violet-400" />
          {title}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-1 pb-1 pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function Tile({
  selected,
  onClick,
  emoji,
  label,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  emoji?: string;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-all",
        selected
          ? "border-violet-500 bg-violet-500/15 text-violet-200"
          : "border-slate-700/80 bg-slate-800/30 text-slate-400 hover:border-slate-600 hover:text-slate-200",
        className
      )}
    >
      {emoji && <span className="text-lg">{emoji}</span>}
      <span className="text-[10px] font-medium leading-tight">{label}</span>
    </button>
  );
}

export function PhotoStudioSidebar() {
  const t = useTranslations("content");
  const { params, updateParams } = usePhotoCreator();
  const { expert, setExpert, hydrated } = useCreatorExpertMode("photo");
  const [propsText, setPropsText] = useState("");
  const [sceneTweaksOpen, setSceneTweaksOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const planQuery = trpc.billing.getCurrentPlan.useQuery();
  const canSceneFirst = planQuery.data
    ? PLANS[planQuery.data.plan as keyof typeof PLANS].hasSceneFirstPipeline
    : false;

  const { data: influencersData } = trpc.influencer.getAll.useQuery(
    { limit: 50 },
    { placeholderData: (prev) => prev }
  );
  const influencers = influencersData?.influencers ?? [];
  const selected = influencers.find((i) => i.id === params.influencerId);
  const gender = (selected?.gender as InfluencerGender | undefined) ?? "female";
  const niche = selected?.niche ?? "";
  const portraitUrl =
    selected?.baseImageUrl?.trim() || selected?.avatarUrl?.trim() || null;
  const hasInfluencer = Boolean(params.influencerId);

  const templates = useMemo(() => {
    const filtered = niche
      ? CONTENT_TEMPLATES.filter(
          (tpl) => tpl.niches.length === 0 || tpl.niches.includes(niche)
        )
      : CONTENT_TEMPLATES;
    return filtered.slice(0, 5);
  }, [niche]);

  const applyTemplate = (templateId: string) => {
    const tpl = CONTENT_TEMPLATES.find((x) => x.id === templateId);
    if (!tpl) return;
    const outfit = gender === "male" ? tpl.params.outfitMale : tpl.params.outfitFemale;
    const sceneDescription = getSceneInspirationText(tpl.params.scene);
    updateParams({
      scene: tpl.params.scene,
      sceneDescription,
      pose: pickDefaultPoseForScene(
        { scene: tpl.params.scene, sceneDescription },
        tpl.params.pose
      ),
      expression: tpl.params.expression,
      photoStyle: tpl.params.photoStyle,
      timeOfDay: tpl.params.timeOfDay,
      outfit,
      location: tpl.params.location ?? "",
    });
    toast.success(t("quickIntentApplied"));
  };

  const onQuickIntent = (id: PhotoQuickIntentId) => {
    const patch = applyPhotoQuickIntent(id, gender, niche);
    updateParams(patch);
    toast.success(t("quickIntentApplied"));
  };

  const applyProps = (raw: string) => {
    setPropsText(raw);
    const trimmed = raw.trim();
    const base = params.sceneDescription.replace(/\s*\[Props:.*?\]\s*$/i, "").trim();
    if (!trimmed) {
      updateParams({ sceneDescription: base, scene: params.scene === "custom" ? "studio" : params.scene });
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
    <div className="flex h-full flex-col overflow-hidden border-r border-slate-800/50 bg-slate-900/40">
      <div className="shrink-0 border-b border-slate-800/50 px-4 py-4">
        <h1 className="text-lg font-bold text-white">{t("studioTitle")}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{t("studioSubtitleSimple")}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin">
        {/* Pilier 1 — Qui */}
        <Pillar icon={Dna} title={t("studioPillarWho")} defaultOpen>
          {influencers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-4 text-center">
              <Users className="mx-auto h-6 w-6 text-slate-600" />
              <p className="mt-2 text-xs text-slate-500">{t("createFirstInfluencer")}</p>
              <Link href="/influencers/new" className="mt-2 inline-block text-xs text-violet-400">
                {t("createLink")}
              </Link>
            </div>
          ) : (
            <Select
              value={params.influencerId}
              onValueChange={(v) => updateParams({ influencerId: v })}
            >
              <SelectTrigger className="h-10 border-slate-800/50 bg-slate-800/30 text-white">
                <SelectValue placeholder={t("selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent className="border-slate-800 bg-slate-900">
                {influencers.map((inf) => (
                  <SelectItem key={inf.id} value={inf.id} className="text-slate-300">
                    {inf.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selected && portraitUrl && (
            <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-2.5">
              <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg border border-violet-500/30">
                <Image src={portraitUrl} alt="" fill className="object-cover" unoptimized />
              </div>
              <p className="text-[11px] text-slate-400">{t("studioDnaLocked")}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/50 bg-slate-800/20 px-3 py-2">
            <Label className="text-xs text-slate-300">{t("faceReferenceLabel")}</Label>
            <Switch
              checked={params.useFaceReference}
              disabled={!portraitUrl || params.contentMode === "NSFW"}
              onCheckedChange={(v) =>
                updateParams({
                  useFaceReference: v,
                  sceneFirst: v ? params.sceneFirst : false,
                })
              }
            />
          </div>
        </Pillar>

        {/* Tenue — toujours visible */}
        <PhotoStudioOutfitSection
          niche={niche}
          gender={gender}
          disabled={!hasInfluencer}
        />

        {/* Pilier 2 — Où / quoi (simplifié) */}
        <Pillar icon={MapPin} title={t("studioPillarScene")} defaultOpen>
          <p className="text-[11px] text-slate-500">{t("studioSceneHint")}</p>

          <div className="grid grid-cols-2 gap-1.5">
            {PRIMARY_INTENTS.map((id) => {
              const intent = PHOTO_QUICK_INTENTS.find((i) => i.id === id);
              if (!intent) return null;
              return (
                <Tile
                  key={id}
                  emoji={intent.emoji}
                  label={t(`quickIntents.photo.${id}.title`)}
                  selected={false}
                  onClick={() => onQuickIntent(id)}
                  className="min-h-[52px]"
                />
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500">{t("templatesTitle")}</Label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl.id)}
                  className="flex w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-xl border border-slate-700/80 bg-slate-800/30 p-2 hover:border-violet-500/50"
                >
                  <span className="text-base">{tpl.emoji}</span>
                  <span className="line-clamp-2 text-center text-[9px] font-medium text-white">
                    {tpl.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Collapsible open={sceneTweaksOpen} onOpenChange={setSceneTweaksOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-slate-800/50 px-2.5 py-2 text-[11px] text-slate-500 hover:bg-slate-800/30">
              <span>{t("studioSceneTweaks")}</span>
              {sceneTweaksOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              <div className="grid grid-cols-4 gap-1.5">
                {LIGHTING_TILES.map((tile) => (
                  <Tile
                    key={tile.id}
                    emoji={tile.emoji}
                    label={t(tile.labelKey)}
                    selected={params.timeOfDay === tile.id}
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
                      onClick={() => allowed && updateParams({ pose: a.pose })}
                      className={!allowed ? "opacity-35" : undefined}
                    />
                  );
                })}
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-500">{t("studioProps")}</Label>
                <Input
                  value={propsText}
                  onChange={(e) => setPropsText(e.target.value)}
                  onBlur={(e) => applyProps(e.target.value)}
                  placeholder={t("studioPropsPlaceholder")}
                  className="h-9 border-slate-800/50 bg-slate-800/30 text-sm text-white"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Pillar>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-slate-800/60 px-3 py-2.5 text-xs text-slate-400 hover:bg-slate-800/30">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t("studioAdvanced")}
            </span>
            {advancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3 rounded-xl border border-slate-800/40 bg-slate-950/50 p-2">
            {hydrated && (
              <button
                type="button"
                onClick={() => setExpert(!expert)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300"
              >
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                {expert ? t("studioExpertOff") : t("studioExpertOn")}
              </button>
            )}
            {canSceneFirst && params.contentMode === "SFW" && (
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-xs text-slate-400">{t("sceneFirstLabel")}</span>
                <Switch
                  checked={params.sceneFirst && params.useFaceReference}
                  disabled={!params.useFaceReference}
                  onCheckedChange={(v) => updateParams({ sceneFirst: v })}
                />
              </div>
            )}
            {expert && (
              <div className="max-h-[50vh] overflow-y-auto scrollbar-thin">
                <PhotoParams embeddedExpert />
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
