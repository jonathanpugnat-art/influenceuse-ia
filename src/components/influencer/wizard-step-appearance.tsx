"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, User, RefreshCw, Coins, AlertCircle } from "lucide-react";
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
import { trpc } from "@/lib/trpc";
import { CREDIT_COSTS } from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ethnicities = [
  "Caucasienne", "Afro", "Asiatique", "Latina",
  "Métisse", "Moyen-Orient", "Indienne", "Autre",
];

const hairColors = [
  { value: "Noir", dot: "bg-gray-900 border-gray-600", emoji: "⚫" },
  { value: "Brun", dot: "bg-amber-800 border-amber-600", emoji: "🟤" },
  { value: "Blond", dot: "bg-yellow-400 border-yellow-300", emoji: "🟡" },
  { value: "Roux", dot: "bg-orange-500 border-orange-400", emoji: "🟠" },
  { value: "Rose", dot: "bg-pink-400 border-pink-300", emoji: "🩷" },
  { value: "Bleu", dot: "bg-blue-500 border-blue-400", emoji: "🔵" },
  { value: "Platine", dot: "bg-gray-200 border-gray-100", emoji: "⚪" },
];

const hairLengths = ["Court", "Mi-long", "Long", "Très long"];
const hairTextures = ["Lisse", "Ondulé", "Bouclé", "Afro", "Tressé"];
const bodyTypes = ["Fine", "Athlétique", "Moyenne", "Curvy"];
const fashionStylesList = ["Casual", "Chic", "Sporty", "Glamour", "Streetwear", "Bohème"];

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
  const {
    data,
    updateData,
    generatedImages,
    setGeneratedImages,
    selectedImageIndex,
    setSelectedImageIndex,
    isGenerating,
    setIsGenerating,
  } = useInfluencerWizard();

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
      toast.success("4 variantes générées. Choisis celle que tu préfères.");
    },
    onError: (err) => {
      setIsGenerating(false);
      toast.error(err.message);
    },
  });

  const handleGenerate = () => {
    if (!hasEnoughCredits) return;
    setIsGenerating(true);
    const hairStyle = [data.hairLength, data.hairTexture].filter(Boolean).join(", ") || undefined;
    const fashionStyle = data.fashionStyles?.length ? data.fashionStyles.join(", ") : undefined;
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
    });
  };

  const handleSelectImage = (index: number) => {
    setSelectedImageIndex(index);
    const url = generatedImages[index];
    if (url) updateData({ baseImageUrl: url });
  };

  const handleNext = () => {
    const url = generatedImages[selectedImageIndex];
    if (url) updateData({ baseImageUrl: url });
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

  return (
    <div className="space-y-6">
      {/* Credits */}
      <div className="flex items-center justify-between rounded-xl border border-slate-800/50 bg-slate-800/20 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Coins className="h-4 w-4 text-amber-400" />
          <span>
            Génération : <strong>{cost}</strong> crédit{cost > 1 ? "s" : ""}
          </span>
        </div>
        <div className="text-sm text-slate-400">
          Restants : <strong className="text-white">{creditsRemaining}</strong>
        </div>
      </div>

      {!hasEnoughCredits && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-200">
              Crédits insuffisants pour générer l&apos;apparence
            </p>
            <p className="mt-0.5 text-xs text-amber-200/80">
              Il te faut au moins {cost} crédit{cost > 1 ? "s" : ""}. Passe à un plan supérieur ou attends le renouvellement.
            </p>
            <Link
              href="/billing"
              className="mt-2 inline-flex items-center rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/30"
            >
              Voir les offres →
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column — Controls */}
        <div className="space-y-5">
          {/* Ethnicity */}
          <div className="space-y-2">
            <Label className="text-slate-300">Ethnie</Label>
            <Select value={ethnicity} onValueChange={setEthnicity}>
              <SelectTrigger className="h-10 border-slate-800/50 bg-slate-800/30 text-white">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent className="border-slate-800 bg-slate-900">
                {ethnicities.map((e) => (
                  <SelectItem
                    key={e}
                    value={e}
                    className="text-slate-300 focus:bg-slate-800 focus:text-white"
                  >
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hair color */}
          <div className="space-y-2">
            <Label className="text-slate-300">Couleur de cheveux</Label>
            <div className="flex flex-wrap gap-2">
              {hairColors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setHairColor(c.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                    hairColor === c.value
                      ? "border-violet-500 bg-violet-500/20 text-violet-300"
                      : "border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600"
                  )}
                >
                  <span>{c.emoji}</span>
                  {c.value}
                </button>
              ))}
            </div>
          </div>

          {/* Hair length */}
          <div className="space-y-2">
            <Label className="text-slate-300">Longueur</Label>
            <div className="flex flex-wrap gap-2">
              {hairLengths.map((l) => (
                <Chip
                  key={l}
                  label={l}
                  selected={hairLength === l}
                  onClick={() => setHairLength(l)}
                />
              ))}
            </div>
          </div>

          {/* Hair texture */}
          <div className="space-y-2">
            <Label className="text-slate-300">Texture</Label>
            <div className="flex flex-wrap gap-2">
              {hairTextures.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  selected={hairTexture === t}
                  onClick={() => setHairTexture(t)}
                />
              ))}
            </div>
          </div>

          {/* Body type */}
          <div className="space-y-2">
            <Label className="text-slate-300">Morphologie</Label>
            <div className="flex flex-wrap gap-2">
              {bodyTypes.map((b) => (
                <Chip
                  key={b}
                  label={b}
                  selected={bodyType === b}
                  onClick={() => setBodyType(b)}
                />
              ))}
            </div>
          </div>

          {/* Fashion styles */}
          <div className="space-y-2">
            <Label className="text-slate-300">
              Style vestimentaire{" "}
              <span className="text-slate-500">(multi-sélection)</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {fashionStylesList.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={fashionStyles.includes(s)}
                  onClick={() => toggleFashion(s)}
                />
              ))}
            </div>
          </div>

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
                Génération en cours...
              </>
            ) : hasAnyChoice ? (
              <>
                <Sparkles className="h-4 w-4" />
                Générer l&apos;apparence
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Surprends-moi ✨
              </>
            )}
          </button>
          {!hasAnyChoice && (
            <p className="text-center text-xs text-slate-500">
              Sans choix, on génère 4 visages variés à partir d&apos;un style par défaut
            </p>
          )}
        </div>

        {/* Right column — Preview */}
        <div className="space-y-3">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-800/30">
            {isGenerating ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <Skeleton className="h-full w-full bg-slate-700/50" />
                <div className="absolute flex flex-col items-center gap-2">
                  <RefreshCw className="h-8 w-8 animate-spin text-violet-400" />
                  <p className="text-sm text-slate-400">
                    Création de votre influenceuse...
                  </p>
                </div>
              </div>
            ) : generatedImages.length > 0 ? (
              <div className="relative h-full w-full">
                <Image
                  src={generatedImages[selectedImageIndex] ?? generatedImages[0]!}
                  alt="Aperçu sélectionné"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
                <User className="h-16 w-16 text-slate-600" />
                <p className="text-center text-sm text-slate-500">
                  Génère l&apos;apparence pour voir un aperçu
                </p>
              </div>
            )}
          </div>

          {generatedImages.length > 0 && (
            <>
              <p className="text-xs text-slate-500">Choisis la variante que tu préfères</p>
              <div className="grid grid-cols-4 gap-2">
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
                      alt={`Variante ${i + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={isGenerating || !hasEnoughCredits}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 py-2 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <RefreshCw className="h-3 w-3" />
                Regénérer
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
          ← Précédent
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
