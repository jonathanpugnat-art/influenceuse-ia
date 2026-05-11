"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Users,
  MapPin,
  Sparkles,
} from "lucide-react";
import { CONTENT_TEMPLATES, type ContentTemplate } from "@/lib/templates/content-templates";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
// Chip helper
// ──────────────────────────────────────────────

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

const lightingStops = ["golden_hour", "natural", "blue_hour", "neon"] as const;

type NicheSuggestionsByGender = {
  female: string[];
  male: string[];
  nonbinary: string[];
};

const nicheSuggestions: Record<string, NicheSuggestionsByGender> = {
  FITNESS: {
    female: ["Legging + brassière", "Tenue yoga", "Bikini sportif"],
    male: ["Short de sport + débardeur", "Tenue musculation", "Jogging technique"],
    nonbinary: ["Short de sport + t-shirt", "Tenue yoga unisexe", "Jogging décontracté"],
  },
  FASHION: {
    female: ["Robe noire élégante", "Tailleur oversize", "Robe de soirée"],
    male: ["Costume bien coupé", "Tailleur oversize", "Chemise + jean élégant"],
    nonbinary: ["Tailleur oversize", "Ensemble androgyne", "Chemise fluide + pantalon"],
  },
  TRAVEL: {
    female: ["Robe bohème", "Short + top léger", "Tenue safari"],
    male: ["Chemise légère + chino", "Short + t-shirt", "Tenue safari casual"],
    nonbinary: ["Short + top léger", "Tenue safari unisexe", "Jean + chemise légère"],
  },
  FOOD: {
    female: ["Tablier chef", "Tenue casual chic", "Robe cuisine"],
    male: ["Tablier chef", "Jean + t-shirt", "Tenue casual brasserie"],
    nonbinary: ["Tablier chef", "Tenue casual chic", "Jean + chemise décontractée"],
  },
  LIFESTYLE: {
    female: ["Pyjama soie", "Tenue loungewear", "Jean + blazer"],
    male: ["Jogging premium", "Tenue loungewear homme", "Jean + veste casual"],
    nonbinary: ["Tenue loungewear", "Jogging confortable", "Jean + blazer décontracté"],
  },
  GAMING: {
    female: ["Hoodie gaming", "T-shirt geek", "Cosplay"],
    male: ["Hoodie gaming", "T-shirt geek", "Cosplay"],
    nonbinary: ["Hoodie gaming", "T-shirt geek", "Cosplay"],
  },
  TECH: {
    female: ["Tenue corporate", "Smart casual", "Streetwear tech"],
    male: ["Tenue corporate", "Smart casual homme", "Streetwear tech"],
    nonbinary: ["Tenue corporate", "Smart casual", "Streetwear tech"],
  },
  ADULT: {
    female: ["Lingerie dentelle", "Bikini", "Robe transparente"],
    male: ["Boxer premium", "Torse nu + jean", "Peignoir ouvert"],
    nonbinary: ["Lingerie unisexe", "Torse nu + short", "Vêtement suggestif"],
  },
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function PhotoParams() {
  const t = useTranslations("content");
  const { params, updateParams } = usePhotoCreator();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const scenes = useMemo(
    () => [
      { value: "studio", emoji: "📷", label: t("sceneStudio") },
      { value: "beach", emoji: "🏖️", label: t("sceneBeach") },
      { value: "urban", emoji: "🏙️", label: t("sceneUrban") },
      { value: "gym", emoji: "💪", label: t("sceneGym") },
      { value: "bedroom", emoji: "🛏️", label: t("sceneBedroom") },
      { value: "restaurant", emoji: "🍽️", label: t("sceneRestaurant") },
      { value: "nature", emoji: "🌿", label: t("sceneNature") },
      { value: "cafe", emoji: "☕", label: t("sceneCafe") },
    ],
    [t]
  );
  const poses = useMemo(
    () => [
      { value: "portrait", label: t("posePortrait") },
      { value: "fullBody", label: t("poseFullBody") },
      { value: "selfie", label: t("poseSelfie") },
      { value: "action", label: t("poseAction") },
      { value: "candid", label: t("poseCandid") },
    ],
    [t]
  );
  const expressions = useMemo(
    () => [
      { value: "smile", emoji: "😊", label: t("exprSmile") },
      { value: "seductive", emoji: "😏", label: t("exprSeductive") },
      { value: "serious", emoji: "😎", label: t("exprSerious") },
      { value: "mysterious", emoji: "🤔", label: t("exprMysterious") },
      { value: "playful", emoji: "😂", label: t("exprPlayful") },
      { value: "natural", emoji: "😍", label: t("exprNatural") },
    ],
    [t]
  );
  const photoStyles = useMemo(
    () => [
      { value: "natural", label: t("styleNatural") },
      { value: "editorial", label: t("styleEditorial") },
      { value: "cinematic", label: t("styleCinematic") },
      { value: "vintage", label: t("styleVintage") },
      { value: "hdr", label: t("styleHdr") },
    ],
    [t]
  );
  const lightingLabels = useMemo(
    () => [t("lightingDawn"), t("lightingDay"), t("lightingDusk"), t("lightingNight")],
    [t]
  );

  const { data: influencersData } = trpc.influencer.getAll.useQuery(
    { limit: 50 },
    { placeholderData: (prev) => prev }
  );

  const influencers = influencersData?.influencers ?? [];
  const selectedInfluencer = influencers.find((i) => i.id === params.influencerId);
  const selectedNiche = selectedInfluencer?.niche ?? "";
  const influencerGender = (selectedInfluencer as { gender?: "female" | "male" | "nonbinary" } | undefined)?.gender ?? "female";
  const nicheSuggestionsByGender = nicheSuggestions[selectedNiche];
  const outfitSuggestions = nicheSuggestionsByGender ? nicheSuggestionsByGender[influencerGender] : [];

  const lightingIndex = lightingStops.indexOf(
    params.timeOfDay as (typeof lightingStops)[number]
  );

  const filteredTemplates = useMemo(() => {
    if (!selectedNiche) return CONTENT_TEMPLATES;
    return CONTENT_TEMPLATES.filter(
      (tpl) => tpl.niches.length === 0 || tpl.niches.includes(selectedNiche)
    );
  }, [selectedNiche]);

  const applyTemplate = (tpl: ContentTemplate) => {
    const gender = influencerGender;
    const outfit = gender === "male" ? tpl.params.outfitMale : tpl.params.outfitFemale;
    updateParams({
      scene: tpl.params.scene,
      pose: tpl.params.pose,
      expression: tpl.params.expression,
      photoStyle: tpl.params.photoStyle,
      timeOfDay: tpl.params.timeOfDay,
      outfit,
      location: tpl.params.location ?? "",
    });
    setShowTemplates(false);
  };

  return (
    <div className="h-full overflow-y-auto border-r border-slate-800/50 bg-slate-900/30 p-4 scrollbar-thin">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
        {t("params")}
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
              <Link
                href="/influencers/new"
                className="text-xs text-violet-400 hover:underline"
              >
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
                      <span className="text-xs text-slate-500">{inf.niche}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Face reference (SFW + Flux image conditioning) */}
        {influencers.length > 0 && (
          <div className="space-y-2 rounded-xl border border-slate-800/50 bg-slate-800/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-xs text-slate-300">{t("faceReferenceLabel")}</Label>
                <p className="mt-0.5 text-xs leading-snug text-slate-500">{t("faceReferenceHint")}</p>
              </div>
              <Switch
                checked={params.useFaceReference}
                disabled={
                  params.contentMode === "NSFW" ||
                  !(
                    Boolean(selectedInfluencer?.baseImageUrl?.trim()) ||
                    Boolean(selectedInfluencer?.avatarUrl?.trim())
                  )
                }
                onCheckedChange={(v) => updateParams({ useFaceReference: v })}
                className="shrink-0"
              />
            </div>
            {params.contentMode === "NSFW" ? (
              <p className="text-xs text-amber-500/90">{t("faceReferenceNsfwNote")}</p>
            ) : !selectedInfluencer ? null : !(
                selectedInfluencer.baseImageUrl?.trim() ||
                selectedInfluencer.avatarUrl?.trim()
              ) ? (
              <p className="text-xs text-slate-500">{t("faceReferenceNoRef")}</p>
            ) : null}
          </div>
        )}

        {/* Templates */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-800/50 bg-slate-800/20 px-3 py-2.5 text-xs text-slate-400 transition-colors hover:bg-slate-800/40 hover:text-slate-300"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              {t("templatesTitle")}
            </span>
            {showTemplates ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showTemplates && (
            <div className="overflow-x-auto pb-1">
              <div className="flex gap-2" style={{ minWidth: "max-content" }}>
                {filteredTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="flex w-28 shrink-0 flex-col gap-1 rounded-xl border border-slate-800/50 bg-slate-800/30 p-2.5 text-left transition-all hover:border-violet-500/50 hover:bg-violet-500/10"
                  >
                    <span className="text-lg">{tpl.emoji}</span>
                    <span className="text-xs font-medium text-white leading-tight">{tpl.name}</span>
                    <span className="text-[10px] text-slate-500 leading-tight line-clamp-2">{tpl.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Number of images */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">{t("numberOfImages")}</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) => (
              <Chip
                key={n}
                label={String(n)}
                selected={params.numberOfImages === n}
                onClick={() => updateParams({ numberOfImages: n })}
              />
            ))}
          </div>
        </div>

        {/* Scene */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">{t("scene")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {scenes.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                emoji={s.emoji}
                selected={params.scene === s.value}
                onClick={() => updateParams({ scene: s.value })}
              />
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin className="h-3 w-3" />
            {t("location")}
          </Label>
          <Input
            value={params.location}
            onChange={(e) => updateParams({ location: e.target.value })}
            placeholder={t("locationPlaceholder")}
            className="h-9 border-slate-800/50 bg-slate-800/30 text-sm text-white placeholder:text-slate-600"
          />
          <div className="flex flex-wrap gap-1.5">
            {["Tour Eiffel Paris", "Times Square NYC", "Santorini Greece", "Dubai Marina", "Shibuya Tokyo", "Bali beach", "Venice Italy", "Colosseum Rome", "Miami Beach"].map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => updateParams({ location: loc })}
                className={cn(
                  "rounded-md px-2 py-1 text-xs transition-colors",
                  params.location === loc
                    ? "bg-violet-500/20 text-violet-300"
                    : "bg-slate-800/40 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                )}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>

        {/* Pose */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">{t("pose")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {poses.map((p) => (
              <Chip
                key={p.value}
                label={p.label}
                selected={params.pose === p.value}
                onClick={() => updateParams({ pose: p.value })}
              />
            ))}
          </div>
        </div>

        {/* Outfit */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">{t("outfit")}</Label>
          <Input
            value={params.outfit}
            onChange={(e) => updateParams({ outfit: e.target.value })}
            placeholder={t("outfitPlaceholder")}
            className="h-9 border-slate-800/50 bg-slate-800/30 text-sm text-white placeholder:text-slate-600"
          />
          {outfitSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {outfitSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateParams({ outfit: s })}
                  className="rounded-md bg-slate-800/40 px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expression */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">{t("expression")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {expressions.map((e) => (
              <Chip
                key={e.value}
                label={e.label}
                emoji={e.emoji}
                selected={params.expression === e.value}
                onClick={() => updateParams({ expression: e.value })}
              />
            ))}
          </div>
        </div>

        {/* Photo Style */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">{t("photoStyle")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {photoStyles.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                selected={params.photoStyle === s.value}
                onClick={() => updateParams({ photoStyle: s.value })}
              />
            ))}
          </div>
        </div>

        {/* Lighting */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">{t("lighting")}</Label>
          <Slider
            min={0}
            max={3}
            step={1}
            value={[Math.max(0, lightingIndex)]}
            onValueChange={([v]) => updateParams({ timeOfDay: lightingStops[v] })}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-slate-500">
            {lightingLabels.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </div>

        {/* NSFW section — hidden for now, will be re-enabled later */}
        {false && selectedInfluencer?.isNsfw && (
          <div className="space-y-3 rounded-xl border border-slate-800/50 bg-slate-800/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-400">{t("contentMode")}</Label>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs", params.contentMode === "SFW" ? "text-emerald-400" : "text-slate-500")}>
                  SFW
                </span>
                <Switch
                  checked={params.contentMode === "NSFW"}
                  onCheckedChange={(v) =>
                    updateParams({ contentMode: v ? "NSFW" : "SFW" })
                  }
                />
                <span className={cn("text-xs", params.contentMode === "NSFW" ? "text-red-400" : "text-slate-500")}>
                  NSFW
                </span>
              </div>
            </div>
            {params.contentMode === "NSFW" && (
              <Select
                value={params.nsfwLevel}
                onValueChange={(v) => updateParams({ nsfwLevel: v })}
              >
                <SelectTrigger className="h-8 border-slate-700 bg-slate-800/50 text-xs text-white">
                  <SelectValue placeholder={t("nsfwLevel")} />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900">
                  <SelectItem value="suggestive" className="text-slate-300 focus:bg-slate-800 focus:text-white text-xs">{t("nsfwSuggestive")}</SelectItem>
                  <SelectItem value="soft" className="text-slate-300 focus:bg-slate-800 focus:text-white text-xs">{t("nsfwSoft")}</SelectItem>
                  <SelectItem value="explicit" className="text-slate-300 focus:bg-slate-800 focus:text-white text-xs">{t("nsfwExplicit")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Advanced prompt (collapsible) */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between text-xs text-slate-500 hover:text-slate-300"
          >
            {t("advancedPrompt")}
            {showAdvanced ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          {showAdvanced && (
            <div className="space-y-1.5">
              <Textarea
                value={params.customPrompt}
                onChange={(e) =>
                  updateParams({ customPrompt: e.target.value })
                }
                placeholder={t("customPromptPlaceholder")}
                rows={3}
                className="border-slate-800/50 bg-slate-800/30 text-xs text-white placeholder:text-slate-600"
              />
              <p className="text-xs text-slate-600">
                {t("customPromptHint")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

