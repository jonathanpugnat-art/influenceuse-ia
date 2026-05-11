"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, RefreshCw, Sparkles, Coins, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { CREDIT_COSTS } from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const niches = [
  { value: "FASHION", label: "Fashion" },
  { value: "FITNESS", label: "Fitness" },
  { value: "TRAVEL", label: "Travel" },
  { value: "GAMING", label: "Gaming" },
  { value: "FOOD", label: "Food" },
  { value: "LIFESTYLE", label: "Lifestyle" },
  { value: "TECH", label: "Tech" },
  { value: "ADULT", label: "Adult" },
];

const schema = z.object({
  name: z.string().min(2).max(50),
  gender: z.enum(["female", "male", "nonbinary"]),
  bio: z.string().min(10).max(2000),
  personality: z.string().min(10).max(2000),
  niche: z.enum(["FASHION", "FITNESS", "LIFESTYLE", "TRAVEL", "TECH", "GAMING", "ADULT", "FOOD"]),
  age: z.number().min(18).max(80),
  isNsfw: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export default function EditInfluencerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratedUrls, setRegeneratedUrls] = useState<string[]>([]);
  const [selectedRegenIndex, setSelectedRegenIndex] = useState(0);

  const { data: influencer, isLoading } = trpc.influencer.getById.useQuery({ id });
  const { data: creditsData } = trpc.billing.getCurrentPlan.useQuery();
  const utils = trpc.useUtils();

  const updateMutation = trpc.influencer.update.useMutation({
    onSuccess: () => {
      utils.influencer.getById.invalidate({ id });
      toast.success("Influenceuse mise à jour");
    },
    onError: (err) => toast.error(err.message),
  });

  const generateBaseImageMutation = trpc.content.generateBaseImage.useMutation({
    onSuccess: (result) => {
      setRegeneratedUrls(result.imageUrls);
      setSelectedRegenIndex(0);
      setRegenerating(false);
      toast.success("4 variantes générées. Choisis une image puis clique Sauvegarder.");
    },
    onError: (err) => {
      setRegenerating(false);
      toast.error(err.message);
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      gender: "female",
      bio: "",
      personality: "",
      niche: "FASHION",
      age: 24,
      isNsfw: false,
    },
    values: influencer
      ? {
          name: influencer.name,
          gender: (influencer.gender as "female" | "male" | "nonbinary") ?? "female",
          bio: influencer.bio,
          personality: influencer.personality,
          niche: influencer.niche,
          age: influencer.age,
          isNsfw: influencer.isNsfw,
        }
      : undefined,
  });

  const style = useMemo(() => {
    if (!influencer?.style || typeof influencer.style !== "object") return {};
    const s = influencer.style as Record<string, unknown>;
    return {
      ethnicity: s.ethnicity as string | undefined,
      hairColor: s.hairColor as string | undefined,
      hairStyle: s.hairStyle as string | undefined,
      bodyType: s.bodyType as string | undefined,
      fashionStyle: s.fashionStyle as string | undefined,
    };
  }, [influencer?.style]);

  const creditsRemaining = creditsData?.creditsRemaining ?? 0;
  const cost = CREDIT_COSTS.BASE_IMAGE;
  const hasEnoughCredits = creditsRemaining >= cost;

  const handleRegenerateBaseImage = () => {
    if (!influencer || !hasEnoughCredits) return;
    setRegenerating(true);
    generateBaseImageMutation.mutate({
      age: influencer.age,
      style: {
        ethnicity: style.ethnicity,
        hairColor: style.hairColor,
        hairStyle: style.hairStyle,
        bodyType: style.bodyType,
        fashionStyle: style.fashionStyle,
      },
    });
  };

  const handleSave = form.handleSubmit((formData) => {
    const baseImageUrl =
      regeneratedUrls.length > 0 ? regeneratedUrls[selectedRegenIndex] : undefined;
    updateMutation.mutate({
      id,
      name: formData.name,
      gender: formData.gender,
      bio: formData.bio,
      personality: formData.personality,
      niche: formData.niche,
      age: formData.age,
      isNsfw: formData.isNsfw,
      ...(baseImageUrl ? { baseImageUrl, avatarUrl: baseImageUrl } : {}),
    });
    if (baseImageUrl) setRegeneratedUrls([]);
  });

  if (isLoading || !influencer) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/influencers/${id}`}
            className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
          <h1 className="text-2xl font-bold text-white">Modifier l&apos;influenceuse</h1>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Colonne 1 — Identité */}
          <div className="space-y-6 rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">Identité</h2>

            <div className="space-y-2">
              <Label className="text-slate-300">Nom</Label>
              <Input
                {...form.register("name")}
                className="border-slate-800/50 bg-slate-800/30 text-white"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-red-400">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Bio</Label>
              <Textarea
                {...form.register("bio")}
                rows={3}
                className="border-slate-800/50 bg-slate-800/30 text-white"
              />
              {form.formState.errors.bio && (
                <p className="text-xs text-red-400">{form.formState.errors.bio.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Niche</Label>
              <div className="flex flex-wrap gap-2">
                {niches.map((n) => (
                  <button
                    key={n.value}
                    type="button"
                    onClick={() => form.setValue("niche", n.value as FormData["niche"])}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                      form.watch("niche") === n.value
                        ? "border-violet-500 bg-violet-500/20 text-violet-300"
                        : "border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600"
                    )}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300">Âge</Label>
                <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-400">
                  {form.watch("age")} ans
                </Badge>
              </div>
              <Controller
                name="age"
                control={form.control}
                render={({ field }) => (
                  <Slider
                    min={18}
                    max={80}
                    step={1}
                    value={[field.value]}
                    onValueChange={([v]) => field.onChange(v)}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Personnalité</Label>
              <Textarea
                {...form.register("personality")}
                rows={3}
                className="border-slate-800/50 bg-slate-800/30 text-white"
              />
              {form.formState.errors.personality && (
                <p className="text-xs text-red-400">{form.formState.errors.personality.message}</p>
              )}
            </div>

            {/* NSFW toggle — hidden for now, will be re-enabled later */}
          </div>

          {/* Colonne 2 — Apparence */}
          <div className="space-y-6 rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">Apparence</h2>

            {/* Image actuelle ou variantes régénérées */}
            {regeneratedUrls.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  Choisis une image puis clique Sauvegarder
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {regeneratedUrls.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedRegenIndex(i)}
                      className={cn(
                        "relative aspect-[3/4] overflow-hidden rounded-xl border-2 transition-all",
                        selectedRegenIndex === i
                          ? "border-violet-500 shadow-lg shadow-violet-500/20"
                          : "border-slate-700 opacity-70 hover:opacity-100"
                      )}
                    >
                      <Image
                        src={url}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {(influencer.baseImageUrl || influencer.avatarUrl) ? (
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-800/50">
                    <Image
                      src={influencer.baseImageUrl ?? influencer.avatarUrl ?? ""}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/20">
                    <p className="text-sm text-slate-500">Aucune image de base</p>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-xl border border-slate-800/50 bg-slate-800/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Coins className="h-4 w-4 text-amber-400" />
                    <span>Regénération : {cost} crédit{cost > 1 ? "s" : ""}</span>
                  </div>
                  <span className="text-sm text-slate-400">
                    Restants : <strong className="text-white">{creditsRemaining}</strong>
                  </span>
                </div>

                {!hasEnoughCredits && (
                  <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-amber-200">Crédits insuffisants</p>
                      <Link
                        href="/billing"
                        className="mt-1 inline-block text-xs text-amber-400 underline hover:text-amber-300"
                      >
                        Voir les offres →
                      </Link>
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRegenerateBaseImage}
                  disabled={regenerating || !hasEnoughCredits}
                  className="w-full border-slate-700 bg-slate-800/30 text-white hover:bg-slate-700"
                >
                  {regenerating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Génération en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Regénérer l&apos;image de base
                    </>
                  )}
                </Button>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Les réseaux sociaux se gèrent sur la fiche de l&apos;influenceuse.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Link href={`/influencers/${id}`}>
            <Button type="button" variant="outline" className="w-full sm:w-auto">
              Annuler
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 sm:w-auto"
          >
            {updateMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </form>
    </div>
  );
}
