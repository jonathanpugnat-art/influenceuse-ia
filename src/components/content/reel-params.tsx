"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, ChevronDown, ChevronUp, Music2, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useReelCreator } from "@/hooks/use-reel-creator";
import { cn } from "@/lib/utils";
import { presetDefaultVideoModelLabel } from "@/lib/prompts/video-prompts";
import { REEL_CREATOR_EXAMPLES } from "@/lib/reel-creator-examples";
import {
  REEL_STYLE_OPTIONS,
  reelStyleSelectSideEffects,
} from "@/lib/reel-style-options";
import { ReelAudioPanel } from "@/components/content/reel-audio-panel";
import {
  CreatorHybridPanel,
  useCreatorExpertMode,
} from "@/components/content/creator-hybrid-panel";

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
        selected
          ? "border-violet-500 bg-violet-500/20 text-violet-300"
          : "border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600"
      )}
    >
      {label}
    </button>
  );
}

const effectOptions = [
  { value: "none", labelKey: "reelEffectNone" as const },
  { value: "slow-mo", labelKey: "reelEffectSlowMo" as const },
  { value: "zoom", labelKey: "reelEffectZoom" as const },
];

export function ReelParams() {
  const t = useTranslations("content");
  const { params, updateParams } = useReelCreator();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null);
  const { expert: expertMode } = useCreatorExpertMode("reel");

  const { data: influencersData } = trpc.influencer.getAll.useQuery(
    { limit: 50 },
    { placeholderData: (prev) => prev }
  );

  const influencers = influencersData?.influencers ?? [];
  const selectedInfluencer = influencers.find((i) => i.id === params.influencerId);

  const applyExample = (id: string) => {
    const ex = REEL_CREATOR_EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setActiveExampleId(id);
    updateParams({
      videoType: ex.videoType,
      sceneDescription: ex.sceneDescription,
      outfit: ex.outfit,
      script: ex.script,
      reelStylePreset: "natural_motion",
      music: "none",
      effects: [],
      textOverlay: "",
    });
  };

  const toggleEffect = (effect: string) => {
    if (effect === "none") {
      updateParams({ effects: [] });
      return;
    }
    const current = params.effects.filter((e) => e !== "none");
    updateParams({
      effects: current.includes(effect)
        ? current.filter((e) => e !== effect)
        : [...current, effect],
    });
  };

  return (
    <div className="h-full overflow-y-auto border-r border-slate-800/50 bg-slate-900/30 p-4 scrollbar-thin">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-500">
        {t("paramsReel")}
      </h2>
      <p className="mb-4 text-xs text-slate-600">{t("reelCreatorIntro")}</p>

      <div className="space-y-5">
        <CreatorHybridPanel
          variant="reel"
          influencerId={params.influencerId}
        />

        {!expertMode && (
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">{t("outfit")}</Label>
            <Input
              value={params.outfit}
              onChange={(e) => updateParams({ outfit: e.target.value })}
              placeholder={t("reelOutfitPlaceholder")}
              className="border-slate-800/50 bg-slate-800/30 text-sm text-white placeholder:text-slate-600"
            />
          </div>
        )}

        {/* Influencer */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">{t("influencerLabel")}</Label>
          {influencers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-700 p-4">
              <Users className="h-6 w-6 text-slate-600" />
              <p className="text-center text-xs text-slate-500">
                {t("createFirstInfluencer")}
              </p>
              <Link href="/influencers/new" className="text-xs text-violet-400 hover:underline">
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
                  <SelectItem
                    key={inf.id}
                    value={inf.id}
                    className="text-slate-300 focus:bg-slate-800 focus:text-white"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-[9px] font-bold text-white">
                        {inf.name.charAt(0)}
                      </div>
                      <span>{inf.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Duration + format — compact */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">{t("reelDurationLabel")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {([15, 30, 60] as const).map((d) => (
                <Chip
                  key={d}
                  label={`${d}s`}
                  selected={params.duration === d}
                  onClick={() => updateParams({ duration: d })}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">{t("reelFormatLabel")}</Label>
            <div className="flex gap-1.5">
              <Chip
                label="9:16"
                selected={params.format === "VERTICAL"}
                onClick={() => updateParams({ format: "VERTICAL" })}
              />
              <Chip
                label="1:1"
                selected={params.format === "SQUARE"}
                onClick={() => updateParams({ format: "SQUARE" })}
              />
            </div>
          </div>
        </div>

        {expertMode && (
        <>
        {/* Real IG examples — replaces abstract "video types" */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">{t("reelExamplesTitle")}</Label>
          <p className="text-[11px] text-slate-600">{t("reelExamplesHint")}</p>
          <div className="flex flex-col gap-2">
            {REEL_CREATOR_EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => applyExample(ex.id)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-all",
                  activeExampleId === ex.id
                    ? "border-violet-500 bg-violet-500/15"
                    : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                )}
              >
                <div className="text-xs font-medium text-white">
                  {t(`reelExamples.${ex.id}.title`)}
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  {t(`reelExamples.${ex.id}.subtitle`)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 1 — Scene */}
        <div className="space-y-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/30 text-[10px] font-bold text-violet-200">
              1
            </span>
            <Label className="text-xs font-medium text-violet-300">
              {t("reelSceneTitle")}
            </Label>
          </div>
          <p className="text-[11px] text-slate-500">{t("reelSceneHintShort")}</p>
          <Textarea
            value={params.sceneDescription}
            onChange={(e) => {
              setActiveExampleId(null);
              updateParams({ sceneDescription: e.target.value });
            }}
            placeholder={t("reelScenePlaceholder")}
            rows={3}
            className="border-slate-800/50 bg-slate-800/30 text-sm text-white placeholder:text-slate-600"
          />
          <Input
            value={params.outfit}
            onChange={(e) => {
              setActiveExampleId(null);
              updateParams({ outfit: e.target.value });
            }}
            placeholder={t("reelOutfitPlaceholder")}
            className="border-slate-800/50 bg-slate-800/30 text-sm text-white placeholder:text-slate-600"
          />
        </div>

        {/* 2 — Motion (main field) */}
        <div className="space-y-2 rounded-xl border border-slate-700/80 bg-slate-800/20 p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-600 text-[10px] font-bold text-slate-200">
              2
            </span>
            <Label className="text-xs font-medium text-slate-200">
              {t("reelMotionLabel")}
            </Label>
          </div>
          <p className="text-[11px] text-slate-500">{t("reelMotionHint")}</p>
          <Textarea
            value={params.script}
            onChange={(e) => {
              setActiveExampleId(null);
              updateParams({ script: e.target.value });
            }}
            placeholder={t("reelMotionPlaceholder")}
            rows={5}
            className="border-slate-800/50 bg-slate-800/30 text-sm text-white placeholder:text-slate-600"
          />
        </div>

        </>
        )}

        {/* 3 — How it moves (IG-friendly style labels) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-600 text-[10px] font-bold text-slate-200">
              3
            </span>
            <Label className="text-xs text-slate-400">{t("reelMotionStyleLabel")}</Label>
          </div>
          <div className="flex flex-col gap-2">
            {REEL_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() =>
                  updateParams({
                    reelStylePreset: opt.key,
                    ...reelStyleSelectSideEffects(opt.key),
                  })
                }
                className={cn(
                  "rounded-xl border px-3 py-2 text-left transition-all",
                  params.reelStylePreset === opt.key
                    ? "border-violet-500 bg-violet-500/15"
                    : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="text-xs font-medium text-white">
                    {t(opt.titleKey)}
                  </div>
                  {opt.recommended && (
                    <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                      {t("reelStyleRecommended")}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">{t(opt.descKey)}</div>
                <div className="mt-0.5 text-[10px] text-slate-600">
                  {t("reelStyleEngine", {
                    model: presetDefaultVideoModelLabel(opt.key),
                  })}
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-slate-600">{t("reelPostProdHint")}</p>

        {params.reelStylePreset === "lip_sync" && (
          <ReelAudioPanel
            influencerId={params.influencerId}
            script={params.script}
            sceneDescription={params.sceneDescription}
            outfit={params.outfit}
            audioUrl={params.audioUrl}
            onAudioUrlChange={(url) => updateParams({ audioUrl: url })}
          />
        )}

        {/* Music — IG publishes with own audio */}
        <div className="flex gap-2 rounded-xl border border-slate-700/60 bg-slate-800/25 p-3">
          <Music2 className="mt-0.5 h-4 w-4 shrink-0 text-pink-400" />
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-300">{t("reelMusicTitle")}</p>
            <p className="text-[11px] leading-snug text-slate-500">{t("reelMusicHint")}</p>
          </div>
        </div>

        {expertMode && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-800/50 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800/30"
          >
            <span className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              {t("reelAdvancedTitle")}
            </span>
            {showAdvanced ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {showAdvanced && (
            <div className="space-y-3 rounded-xl border border-slate-800/50 bg-slate-800/20 p-3">
              <p className="text-[11px] text-slate-500">{t("reelAdvancedHint")}</p>
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">{t("reelEffectsLabel")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {effectOptions.map((e) => (
                    <Chip
                      key={e.value}
                      label={t(e.labelKey)}
                      selected={
                        e.value === "none"
                          ? params.effects.length === 0
                          : params.effects.includes(e.value)
                      }
                      onClick={() => toggleEffect(e.value)}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">{t("reelOverlayLabel")}</Label>
                <Input
                  value={params.textOverlay}
                  onChange={(e) => updateParams({ textOverlay: e.target.value })}
                  placeholder={t("reelOverlayPlaceholder")}
                  className="h-9 border-slate-800/50 bg-slate-800/30 text-sm text-white placeholder:text-slate-600"
                />
                <p className="text-[10px] text-slate-600">{t("reelOverlayHint")}</p>
              </div>
            </div>
          )}
        </div>
        )}

        {false && selectedInfluencer?.isNsfw && null}
      </div>
    </div>
  );
}
