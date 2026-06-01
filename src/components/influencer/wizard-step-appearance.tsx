"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Sparkles,
  User,
  RefreshCw,
  Coins,
  AlertCircle,
  Dice5,
} from "lucide-react";
import { WizardCollisionBanner } from "@/components/influencer/wizard-collision-banner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { explodeAppearanceVariations } from "@/lib/prompts/image-prompts";
import {
  fingerprintFromWizard,
  normalizeAppearanceVariation,
  randomAppearanceVariation,
} from "@/lib/prompts/appearance-variation-ui";
import { WizardAppearanceExpert } from "@/components/influencer/wizard-appearance-expert";
import { WizardPortraitComparison } from "@/components/influencer/wizard-portrait-comparison";
import { WizardTrendsInspire } from "@/components/influencer/wizard-trends-inspire";
import { isIdentityStepComplete } from "@/lib/wizard-validation";
import { trpc } from "@/lib/trpc";
import { CREDIT_COSTS } from "@/lib/constants";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Stored values (French) — labels come from i18n. */
const ETHNICITY_VALUES = [
  "Caucasienne",
  "Afro",
  "Asiatique",
  "Latina",
  "Métisse",
  "Moyen-Orient",
  "Indienne",
  "Autre",
] as const;

const ETHNICITY_KEYS = [
  "caucasian",
  "afro",
  "asian",
  "latina",
  "mixed",
  "middleEast",
  "indian",
  "other",
] as const;

const HAIR_COLOR_VALUES = [
  "Noir",
  "Brun",
  "Blond",
  "Roux",
  "Rose",
  "Bleu",
  "Platine",
] as const;

const HAIR_COLOR_KEYS = [
  "black",
  "brown",
  "blonde",
  "red",
  "pink",
  "blue",
  "platinum",
] as const;

const HAIR_LENGTH_VALUES = ["Court", "Mi-long", "Long", "Très long"] as const;
const HAIR_LENGTH_KEYS = ["short", "medium", "long", "veryLong"] as const;

const HAIR_TEXTURE_VALUES = ["Lisse", "Ondulé", "Bouclé", "Afro", "Tressé"] as const;
const HAIR_TEXTURE_KEYS = [
  "straight",
  "wavy",
  "curly",
  "afro",
  "braided",
] as const;

const BODY_TYPE_VALUES = ["Fine", "Athlétique", "Moyenne", "Curvy"] as const;
const BODY_TYPE_KEYS = ["slim", "athletic", "average", "curvy"] as const;

const FASHION_VALUES = [
  "Casual",
  "Chic",
  "Sporty",
  "Glamour",
  "Streetwear",
  "Bohème",
] as const;

const FASHION_KEYS = [
  "casual",
  "chic",
  "sporty",
  "glamour",
  "streetwear",
  "bohemian",
] as const;

const HAIR_COLOR_EMOJI = ["⚫", "🟤", "🟡", "🟠", "🩷", "🔵", "⚪"];

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
        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
        selected
          ? "border-violet-500 bg-violet-500/20 text-violet-300"
          : "border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600"
      )}
    >
      {label}
    </button>
  );
}

export function WizardStepAppearance({
  onNext,
  onPrev,
}: {
  onNext: () => void;
  onPrev: () => void;
}) {
  const t = useTranslations("wizard");

  const ethnicities = useMemo(
    () =>
      ETHNICITY_VALUES.map((value, i) => ({
        value,
        label: t(`ethnicityOptions.${ETHNICITY_KEYS[i]}`),
      })),
    [t]
  );

  const hairColors = useMemo(
    () =>
      HAIR_COLOR_VALUES.map((value, i) => ({
        value,
        emoji: HAIR_COLOR_EMOJI[i],
        label: t(`hairColorOptions.${HAIR_COLOR_KEYS[i]}`),
      })),
    [t]
  );

  const hairLengths = useMemo(
    () =>
      HAIR_LENGTH_VALUES.map((value, i) => ({
        value,
        label: t(`hairLengthOptions.${HAIR_LENGTH_KEYS[i]}`),
      })),
    [t]
  );

  const hairTextures = useMemo(
    () =>
      HAIR_TEXTURE_VALUES.map((value, i) => ({
        value,
        label: t(`hairTextureOptions.${HAIR_TEXTURE_KEYS[i]}`),
      })),
    [t]
  );

  const bodyTypes = useMemo(
    () =>
      BODY_TYPE_VALUES.map((value, i) => ({
        value,
        label: t(`bodyTypeOptions.${BODY_TYPE_KEYS[i]}`),
      })),
    [t]
  );

  const fashionStylesList = useMemo(
    () =>
      FASHION_VALUES.map((value, i) => ({
        value,
        label: t(`fashionStyleOptions.${FASHION_KEYS[i]}`),
      })),
    [t]
  );

  const {
    data,
    updateData,
    generatedImages,
    setGeneratedImages,
    selectedImageIndex,
    setSelectedImageIndex,
    isGenerating,
    setIsGenerating,
    expressMode,
    setExpressMode,
    setStep,
  } = useInfluencerWizard();
  const expressAutoStarted = useRef(false);

  const { data: creditsData } = trpc.billing.getCurrentPlan.useQuery();
  const creditsRemaining = creditsData?.creditsRemaining ?? 0;
  const cost = CREDIT_COSTS.BASE_IMAGE;
  const hasEnoughCredits = creditsRemaining >= cost;

  const generateMutation = trpc.content.generateBaseImage.useMutation({
    onSuccess: (result) => {
      setGeneratedImages(result.imageUrls);
      setSelectedImageIndex(0);
      // Persist the appearance variations + fingerprint alongside the URL
      // so step 4 (`influencer.create`) can forward them to the DB. Without
      // this, the influencer row would have NULL fingerprint and we'd lose
      // the uniqueness signal even though the image itself was unique.
      const updates: Parameters<typeof updateData>[0] = {
        appearanceVariations: result.appearanceVariations,
        appearanceFingerprint: result.appearanceFingerprint,
      };
      if (result.imageUrls[0]) {
        updates.baseImageUrl = result.imageUrls[0];
      }
      updateData(updates);
      setIsGenerating(false);
      toast.success(t("variantsGeneratedToast"));
      if (expressMode) {
        setExpressMode(false);
        toast.success(t("expressPortraitDone"));
        setStep(4);
      }
    },
    onError: (err) => {
      setIsGenerating(false);
      if (expressMode) {
        expressAutoStarted.current = false;
        setExpressMode(false);
      }
      toast.error(err.message);
    },
  });

  const handleGenerate = () => {
    if (!hasEnoughCredits) return;
    setIsGenerating(true);
    const hairStyle = [data.hairLength, data.hairTexture].filter(Boolean).join(", ") || undefined;
    const fashionStyle = data.fashionStyles?.length ? data.fashionStyles.join(", ") : undefined;
    const variations = normalizeAppearanceVariation(data.appearanceVariations);
    generateMutation.mutate({
      age: data.age || 24,
      gender: data.gender ?? "female",
      style: {
        ethnicity: data.ethnicity || undefined,
        hairColor: data.hairColor || undefined,
        hairStyle,
        bodyType: data.bodyType || undefined,
        fashionStyle,
      },
      appearanceVariations: variations,
    });
  };

  const handleSurpriseMe = () => {
    const next = randomAppearanceVariation();
    updateData({
      appearanceVariations: next,
      appearanceFingerprint: fingerprintFromWizard(data.age || 24, data, next),
    });
    handleGenerate();
  };

  const handleSelectImage = (index: number) => {
    setSelectedImageIndex(index);
    const url = generatedImages[index];
    if (url) updateData({ baseImageUrl: url });
  };

  const selectedPortraitUrl =
    generatedImages[selectedImageIndex] ?? data.baseImageUrl?.trim() ?? "";

  const handleNext = () => {
    if (!selectedPortraitUrl) {
      toast.error(t("portraitRequired"));
      return;
    }
    updateData({ baseImageUrl: selectedPortraitUrl });
    onNext();
  };

  const ethnicity = data.ethnicity;
  const hairColor = data.hairColor;
  const hairLength = data.hairLength;
  const hairTexture = data.hairTexture;
  const bodyType = data.bodyType;
  const fashionStyles = data.fashionStyles ?? [];

  const setEthnicity = (v: string) => updateData({ ethnicity: v });
  const setHairColor = (v: string) => updateData({ hairColor: v });
  const setHairLength = (v: string) => updateData({ hairLength: v });
  const setHairTexture = (v: string) => updateData({ hairTexture: v });
  const setBodyType = (v: string) => updateData({ bodyType: v });
  const toggleFashion = (style: string) => {
    const next = fashionStyles.includes(style)
      ? fashionStyles.filter((s) => s !== style)
      : [...fashionStyles, style];
    updateData({ fashionStyles: next });
  };

  // Sprint 12 — let users generate from the very first click. The AI service
  // already substitutes sensible defaults (caucasian / brown / average / casual)
  // so blocking the button on three selects was creating dead clicks. Anyone
  // who wants more control can fill the fields, but it's no longer a blocker.
  const hasAnyChoice = Boolean(
    ethnicity || hairColor || hairLength || hairTexture || bodyType || fashionStyles.length > 0
  );
  const canGenerate = true;

  useEffect(() => {
    if (
      !expressMode ||
      expressAutoStarted.current ||
      generatedImages.length > 0 ||
      isGenerating ||
      !hasEnoughCredits
    ) {
      return;
    }
    if (!isIdentityStepComplete(data)) return;
    expressAutoStarted.current = true;
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot express auto-run
  }, [expressMode, generatedImages.length, isGenerating, hasEnoughCredits]);

  return (
    <div className="space-y-6">
      {expressMode && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {t("expressGenerating")}
        </div>
      )}

      <WizardTrendsInspire />
      {/* Credits */}
      <div className="flex items-center justify-between rounded-xl border border-slate-800/50 bg-slate-800/20 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Coins className="h-4 w-4 text-amber-400" />
          <span>{t("generationCost", { cost })}</span>
        </div>
        <div className="text-sm text-slate-400">
          {t("creditsLeft", { count: creditsRemaining })}
        </div>
      </div>

      {!hasEnoughCredits && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-200">
              {t("insufficientCredits")}
            </p>
            <p className="mt-0.5 text-xs text-amber-200/80">
              {t("insufficientCreditsHint", { cost })}
            </p>
            <Link
              href="/billing"
              className="mt-2 inline-flex items-center rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/30"
            >
              {t("seeOffers")}
            </Link>
          </div>
        </div>
      )}

      {data.appearanceFingerprint && (
        <WizardCollisionBanner
          fingerprint={data.appearanceFingerprint}
          onReroll={handleSurpriseMe}
          compact
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column — Controls */}
        <div className="order-2 space-y-5 lg:order-1">
          {/* Ethnicity */}
          <div className="space-y-2">
            <Label className="text-slate-300">{t("ethnicity")}</Label>
            <Select value={ethnicity} onValueChange={setEthnicity}>
              <SelectTrigger className="h-10 border-slate-800/50 bg-slate-800/30 text-white">
                <SelectValue placeholder={t("selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent className="border-slate-800 bg-slate-900">
                {ethnicities.map((e) => (
                  <SelectItem
                    key={e.value}
                    value={e.value}
                    className="text-slate-300 focus:bg-slate-800 focus:text-white"
                  >
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hair color */}
          <div className="space-y-2">
            <Label className="text-slate-300">{t("hairColor")}</Label>
            <div className="flex flex-wrap gap-2">
              {hairColors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setHairColor(c.value)}
                  aria-pressed={hairColor === c.value}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                    hairColor === c.value
                      ? "border-violet-500 bg-violet-500/20 text-violet-300"
                      : "border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600"
                  )}
                >
                  <span>{c.emoji}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hair length */}
          <div className="space-y-2">
            <Label className="text-slate-300">{t("hairLength")}</Label>
            <div className="flex flex-wrap gap-2">
              {hairLengths.map((l) => (
                <Chip
                  key={l.value}
                  label={l.label}
                  selected={hairLength === l.value}
                  onClick={() => setHairLength(l.value)}
                />
              ))}
            </div>
          </div>

          {/* Hair texture */}
          <div className="space-y-2">
            <Label className="text-slate-300">{t("hairTexture")}</Label>
            <div className="flex flex-wrap gap-2">
              {hairTextures.map((ht) => (
                <Chip
                  key={ht.value}
                  label={ht.label}
                  selected={hairTexture === ht.value}
                  onClick={() => setHairTexture(ht.value)}
                />
              ))}
            </div>
          </div>

          {/* Body type */}
          <div className="space-y-2">
            <Label className="text-slate-300">{t("bodyType")}</Label>
            <div className="flex flex-wrap gap-2">
              {bodyTypes.map((b) => (
                <Chip
                  key={b.value}
                  label={b.label}
                  selected={bodyType === b.value}
                  onClick={() => setBodyType(b.value)}
                />
              ))}
            </div>
          </div>

          {/* Fashion styles */}
          <div className="space-y-2">
            <Label className="text-slate-300">
              {t("fashionStyle")}{" "}
              <span className="text-slate-500">{t("multiSelect")}</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {fashionStylesList.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  selected={fashionStyles.includes(s.value)}
                  onClick={() => toggleFashion(s.value)}
                />
              ))}
            </div>
          </div>

          <WizardAppearanceExpert data={data} updateData={updateData} />

          {/* Generate button (Sprint 12 — never blocked) */}
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={!canGenerate || isGenerating || !hasEnoughCredits}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 disabled:opacity-40 disabled:shadow-none"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {t("generatingAppearance")}
              </>
            ) : hasAnyChoice ? (
              <>
                <Sparkles className="h-4 w-4" />
                {t("generateAppearance")}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {t("surpriseMe")} ✨
              </>
            )}
          </button>
          {!hasAnyChoice && (
            <p className="text-center text-xs text-slate-500">
              {t("surpriseMeDefault")}
            </p>
          )}
        </div>

        {/* Preview — sticky on mobile, above controls */}
        <div className="order-1 space-y-3 lg:order-2 lg:sticky lg:top-20 lg:self-start">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-800/30">
            {isGenerating ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <Skeleton className="h-full w-full bg-slate-700/50" />
                <div className="absolute flex flex-col items-center gap-2">
                  <RefreshCw className="h-8 w-8 animate-spin text-violet-400" />
                  <p className="text-sm text-slate-400">
                    {t("creatingInfluencer")}
                  </p>
                </div>
              </div>
            ) : generatedImages.length > 0 ? (
              <div className="relative h-full w-full">
                <Image
                  src={generatedImages[selectedImageIndex] ?? generatedImages[0]!}
                  alt={t("previewAlt")}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
                <User className="h-16 w-16 text-slate-600" />
                <p className="text-center text-sm text-slate-500">
                  {t("previewHint")}
                </p>
              </div>
            )}
          </div>

          {generatedImages.length > 0 && (
            <>
              <WizardPortraitComparison
                urls={generatedImages}
                selectedIndex={selectedImageIndex}
                onSelect={handleSelectImage}
              />
              <p className="text-xs text-slate-500 lg:hidden">{t("selectVariant")}</p>
              <div className="grid grid-cols-4 gap-2 lg:hidden">
                {generatedImages.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectImage(i)}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-xl border-2 transition-all",
                      selectedImageIndex === i
                        ? "border-violet-500 shadow-lg shadow-violet-500/20"
                        : "border-transparent opacity-60 hover:opacity-90"
                    )}
                  >
                    <Image
                      src={url}
                      alt={t("variantAlt", { index: i + 1 })}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </button>
                ))}
              </div>

              {/* Sprint 14 — surface the random "visual signature" so users
                  see WHY each portrait is unique (was previously hidden).
                  Lists the 6 facial trait variations randomised on the
                  server. "Re-roll" simply triggers another generate. */}
              {data.appearanceVariations && (
                <div className="space-y-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-violet-300">
                      {t("visualSignature")}
                    </p>
                    <button
                      type="button"
                      onClick={handleSurpriseMe}
                      disabled={isGenerating || !hasEnoughCredits}
                      className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-200 transition-colors hover:bg-violet-500/20 disabled:opacity-40"
                      title={t("surpriseMeRerollTitle")}
                    >
                      <Dice5 className="h-3 w-3" />
                      {t("surpriseMe")}
                    </button>
                  </div>
                  <ul className="grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-slate-300 sm:grid-cols-2">
                    {(() => {
                      const traits = explodeAppearanceVariations(
                        data.appearanceVariations
                      );
                      const items: Array<{ label: string; value: string }> = [
                        { label: "Visage", value: traits.faceShape },
                        { label: "Yeux", value: traits.eyeShape },
                        { label: "Couleur", value: traits.eyeColor },
                        { label: "Nez", value: traits.nose },
                        { label: "Détail", value: traits.distinctiveFeature },
                        { label: "Expression", value: traits.expression },
                      ];
                      return items
                        .filter((t) => t.value)
                        .map((t) => (
                          <li key={t.label} className="flex gap-1.5">
                            <span className="shrink-0 text-slate-500">
                              {t.label}
                            </span>
                            <span className="text-slate-300">
                              · {t.value}
                            </span>
                          </li>
                        ));
                    })()}
                  </ul>
                  <p className="text-[10px] text-slate-500">
                    {t("traitsInjectedHint")}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={isGenerating || !hasEnoughCredits}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 py-2 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <RefreshCw className="h-3 w-3" />
                {t("regenerate")} ({cost} {t("creditsShort")})
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="rounded-xl border border-slate-700 px-6 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          ← {t("back")}
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!selectedPortraitUrl}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("next")} →
        </button>
      </div>
    </div>
  );
}
