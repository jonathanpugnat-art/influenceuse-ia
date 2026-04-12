"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { useReelCreator } from "@/hooks/use-reel-creator";
import { cn } from "@/lib/utils";

function Chip({
  label,
  emoji,
  selected,
  onClick,
}: {
  label: string;
  emoji?: string;
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
      {emoji && <span className="mr-1">{emoji}</span>}
      {label}
    </button>
  );
}

const videoTypes = [
  { value: "talking_head", emoji: "🗣️", label: "Talking Head" },
  { value: "transition", emoji: "🔄", label: "Transition" },
  { value: "dance", emoji: "💃", label: "Danse" },
  { value: "grwm", emoji: "💄", label: "GRWM" },
  { value: "unboxing", emoji: "📦", label: "Unboxing" },
  { value: "day_in_life", emoji: "📅", label: "Day in my life" },
  { value: "workout", emoji: "🏋️", label: "Workout" },
  { value: "sketch", emoji: "🎭", label: "Sketch" },
];

const effectOptions = [
  { value: "none", label: "Aucun" },
  { value: "slow-mo", label: "Slow-mo" },
  { value: "zoom", label: "Zoom dynamique" },
  { value: "split", label: "Split screen" },
  { value: "glitch", label: "Glitch" },
  { value: "bokeh", label: "Bokeh" },
];

export function ReelParams() {
  const t = useTranslations("content");
  const { params, updateParams } = useReelCreator();
  const [showNsfw, setShowNsfw] = useState(false);

  const { data: influencersData } = trpc.influencer.getAll.useQuery(
    { limit: 50 },
    { placeholderData: (prev) => prev }
  );

  const influencers = influencersData?.influencers ?? [];
  const selectedInfluencer = influencers.find((i) => i.id === params.influencerId);

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
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
        {t("paramsReel")}
      </h2>

      <div className="space-y-5">
        {/* Influencer selector */}
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

        {/* Duration */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">Durée</Label>
          <div className="flex gap-2">
            {([15, 30, 60] as const).map((d) => (
              <Chip
                key={d}
                label={`${d}s`}
                selected={params.duration === d}
                onClick={() => updateParams({ duration: d })}
              />
            ))}
          </div>
          <p className="text-xs text-slate-600">La durée réelle peut varier légèrement</p>
        </div>

        {/* Format */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">Format</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateParams({ format: "VERTICAL" })}
              className={cn(
                "flex flex-1 flex-col items-center gap-1.5 rounded-xl border p-3 transition-all",
                params.format === "VERTICAL"
                  ? "border-violet-500 bg-violet-500/20"
                  : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
              )}
            >
              <div className={cn(
                "h-8 w-5 rounded-sm border-2",
                params.format === "VERTICAL" ? "border-violet-400" : "border-slate-600"
              )} />
              <span className={cn("text-xs font-medium", params.format === "VERTICAL" ? "text-violet-300" : "text-slate-500")}>
                📱 9:16
              </span>
            </button>
            <button
              type="button"
              onClick={() => updateParams({ format: "SQUARE" })}
              className={cn(
                "flex flex-1 flex-col items-center gap-1.5 rounded-xl border p-3 transition-all",
                params.format === "SQUARE"
                  ? "border-violet-500 bg-violet-500/20"
                  : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
              )}
            >
              <div className={cn(
                "h-6 w-6 rounded-sm border-2",
                params.format === "SQUARE" ? "border-violet-400" : "border-slate-600"
              )} />
              <span className={cn("text-xs font-medium", params.format === "SQUARE" ? "text-violet-300" : "text-slate-500")}>
                ⬛ 1:1
              </span>
            </button>
          </div>
        </div>

        {/* Video type */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">Type de vidéo</Label>
          <div className="flex flex-wrap gap-1.5">
            {videoTypes.map((t) => (
              <Chip
                key={t.value}
                label={t.label}
                emoji={t.emoji}
                selected={params.videoType === t.value}
                onClick={() => updateParams({ videoType: t.value })}
              />
            ))}
          </div>
        </div>

        {/* Script */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-slate-400">Script / Scénario</Label>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
            >
              <Sparkles className="h-3 w-3" />
              Générer un scénario
            </button>
          </div>
          <Textarea
            value={params.script}
            onChange={(e) => updateParams({ script: e.target.value })}
            placeholder="Décris ce que fait l'influenceuse dans la vidéo. Ex: Elle arrive dans un café, s'installe, sort son ordinateur, sourit à la caméra..."
            rows={6}
            className="border-slate-800/50 bg-slate-800/30 text-sm text-white placeholder:text-slate-600"
          />
        </div>

        {/* Music */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">Musique</Label>
          <Select value={params.music} onValueChange={(v) => updateParams({ music: v })}>
            <SelectTrigger className="h-9 border-slate-800/50 bg-slate-800/30 text-sm text-white">
              <SelectValue placeholder="Aucune musique" />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900">
              <SelectItem value="none" className="text-slate-300 focus:bg-slate-800 text-xs">Aucune musique</SelectItem>
              <SelectItem value="trending" className="text-slate-300 focus:bg-slate-800 text-xs">🔥 Trending (auto)</SelectItem>
              <SelectItem value="chill" className="text-slate-300 focus:bg-slate-800 text-xs">😌 Chill</SelectItem>
              <SelectItem value="energetic" className="text-slate-300 focus:bg-slate-800 text-xs">⚡ Energetic</SelectItem>
              <SelectItem value="emotional" className="text-slate-300 focus:bg-slate-800 text-xs">💔 Emotional</SelectItem>
              <SelectItem value="funny" className="text-slate-300 focus:bg-slate-800 text-xs">😂 Funny</SelectItem>
            </SelectContent>
          </Select>
          {params.music === "trending" && (
            <p className="text-xs text-slate-600">Sera ajouté au moment de la publication</p>
          )}
        </div>

        {/* Effects */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">Effets</Label>
          <div className="flex flex-wrap gap-1.5">
            {effectOptions.map((e) => (
              <Chip
                key={e.value}
                label={e.label}
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

        {/* Text overlay */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">Texte overlay (optionnel)</Label>
          <Input
            value={params.textOverlay}
            onChange={(e) => updateParams({ textOverlay: e.target.value })}
            placeholder="Texte qui apparaîtra sur la vidéo"
            className="h-9 border-slate-800/50 bg-slate-800/30 text-sm text-white placeholder:text-slate-600"
          />
        </div>

        {/* NSFW */}
        {selectedInfluencer?.isNsfw && (
          <div className="space-y-3 rounded-xl border border-slate-800/50 bg-slate-800/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-400">Mode contenu</Label>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs", params.contentMode === "SFW" ? "text-emerald-400" : "text-slate-500")}>SFW</span>
                <Switch
                  checked={params.contentMode === "NSFW"}
                  onCheckedChange={(v) => updateParams({ contentMode: v ? "NSFW" : "SFW" })}
                />
                <span className={cn("text-xs", params.contentMode === "NSFW" ? "text-red-400" : "text-slate-500")}>NSFW</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

