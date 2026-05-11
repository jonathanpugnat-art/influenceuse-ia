"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Sparkles, Loader2, Wand2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { TemplatePicker } from "@/components/influencer/template-picker";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

const NICHE_KEYS: Record<string, string> = {
  FASHION: "nicheFashion",
  FITNESS: "nicheFitness",
  LIFESTYLE: "nicheLifestyle",
  TRAVEL: "nicheTravel",
  TECH: "nicheTech",
  GAMING: "nicheGaming",
  ADULT: "nicheAdult",
  FOOD: "nicheFood",
};

const nicheColors: Record<string, string> = {
  FASHION: "border-pink-500 bg-pink-500/10 text-pink-400",
  FITNESS: "border-emerald-500 bg-emerald-500/10 text-emerald-400",
  TRAVEL: "border-blue-500 bg-blue-500/10 text-blue-400",
  GAMING: "border-purple-500 bg-purple-500/10 text-purple-400",
  FOOD: "border-amber-500 bg-amber-500/10 text-amber-400",
  LIFESTYLE: "border-rose-500 bg-rose-500/10 text-rose-400",
  TECH: "border-cyan-500 bg-cyan-500/10 text-cyan-400",
  ADULT: "border-red-500 bg-red-500/10 text-red-400",
};

const nicheEmojis: Record<string, string> = {
  FASHION: "👗",
  FITNESS: "💪",
  TRAVEL: "🌴",
  GAMING: "🎮",
  FOOD: "🍕",
  LIFESTYLE: "💄",
  TECH: "💻",
  ADULT: "🔥",
};

export function WizardStepIdentity({ onNext }: { onNext: () => void }) {
  const t = useTranslations("wizard");
  const tInfluencer = useTranslations("influencer");
  const { data, updateData } = useInfluencerWizard();

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, t("nameMin")).max(50, t("nameMax")),
        gender: z.enum(["female", "male", "nonbinary"]).default("female"),
        bio: z.string().min(10, t("bioMin")).max(300, t("bioMax")),
        personality: z.string().min(10, t("personalityMin")).max(500, t("personalityMax")),
        niche: z.string().min(1, t("chooseNiche")),
        age: z.number().min(18).max(35),
        isNsfw: z.boolean(),
      }),
    [t]
  );

  type FormData = z.infer<typeof schema>;

  const niches = useMemo(
    () =>
      (["FASHION", "FITNESS", "TRAVEL", "GAMING", "FOOD", "LIFESTYLE", "TECH", "ADULT"] as const).map(
        (value) => ({
          value,
          emoji: nicheEmojis[value],
          label: tInfluencer(NICHE_KEYS[value]),
          color: nicheColors[value],
        })
      ),
    [tInfluencer]
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    mode: "onChange",
    defaultValues: {
      name: data.name,
      gender: data.gender ?? "female",
      bio: data.bio,
      personality: data.personality,
      niche: data.niche,
      age: data.age || 24,
      isNsfw: data.isNsfw,
    },
  });

  // Sync form values when a template applies updates to the zustand store
  // from outside this component (e.g. TemplatePicker).
  useEffect(() => {
    reset({
      name: data.name,
      gender: data.gender ?? "female",
      bio: data.bio,
      personality: data.personality,
      niche: data.niche,
      age: data.age || 24,
      isNsfw: data.isNsfw,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.bio, data.personality, data.niche, data.gender, data.age, data.isNsfw]);

  const bio = watch("bio");
  const personality = watch("personality");
  const selectedNiche = watch("niche");
  const isNsfw = watch("isNsfw");
  const age = watch("age");
  const currentName = watch("name");
  const currentGender = watch("gender");

  // Sprint 12 — AI persona suggestions ──────────────────────────────────────
  const locale = useLocale();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<{ bio: string; personality: string }>
  >([]);

  const suggestMutation = trpc.influencer.suggestPersona.useMutation({
    onSuccess: (ideas) => {
      setSuggestions(ideas);
      setSuggestOpen(true);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSuggest = () => {
    if (!selectedNiche) {
      toast.info("Choisis d'abord une niche pour des suggestions ciblées.");
      return;
    }
    suggestMutation.mutate({
      name: currentName?.trim() || undefined,
      niche: selectedNiche as
        | "FASHION"
        | "FITNESS"
        | "LIFESTYLE"
        | "TRAVEL"
        | "TECH"
        | "GAMING"
        | "ADULT"
        | "FOOD",
      gender: currentGender,
      language: locale === "en" ? "en" : "fr",
    });
  };

  const applySuggestion = (idx: number) => {
    const s = suggestions[idx];
    if (!s) return;
    setValue("bio", s.bio, { shouldValidate: true });
    setValue("personality", s.personality, { shouldValidate: true });
    updateData({ bio: s.bio, personality: s.personality });
    setSuggestOpen(false);
    toast.success("Bio et personnalité appliquées ✨");
  };

  const onSubmit = (formData: FormData) => {
    updateData(formData);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Sprint 7 — pre-baked persona templates */}
      <TemplatePicker />

      {/* Name */}
      <div className="space-y-2">
        <Label className="text-slate-300">{t("influencerName")}</Label>
        <Input
          {...register("name")}
          placeholder={t("namePlaceholder")}
          className="h-11 border-slate-800/50 bg-slate-800/30 text-white placeholder:text-slate-500 focus:border-violet-500"
        />
        {errors.name && (
          <p className="text-xs text-red-400">{errors.name.message}</p>
        )}
      </div>

      {/* Gender */}
      <div className="space-y-2">
        <Label className="text-slate-300">{t("gender")}</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["female", "male", "nonbinary"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setValue("gender", g, { shouldValidate: true })}
              className={cn(
                "rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all",
                watch("gender") === g
                  ? "border-violet-500 bg-violet-500/20 text-violet-300"
                  : "border-slate-800 bg-slate-800/30 text-slate-400 hover:border-slate-700"
              )}
            >
              {g === "female" && t("genderFemale")}
              {g === "male" && t("genderMale")}
              {g === "nonbinary" && t("genderNonbinary")}
            </button>
          ))}
        </div>
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-slate-300">{tInfluencer("bio")}</Label>
            {/* Sprint 12 — AI magic suggest */}
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggestMutation.isPending || !selectedNiche}
              className={cn(
                "flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-medium text-violet-300 transition-colors hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40",
                !selectedNiche && "opacity-50"
              )}
              title={
                !selectedNiche
                  ? "Choisis d'abord une niche"
                  : "Génère 3 suggestions de bio + personnalité"
              }
            >
              {suggestMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3" />
              )}
              Suggérer
            </button>
          </div>
          <span
            className={cn(
              "text-xs",
              (bio?.length ?? 0) > 300 ? "text-red-400" : "text-slate-500"
            )}
          >
            {bio?.length ?? 0}/300
          </span>
        </div>
        <Textarea
          {...register("bio")}
          placeholder={t("bioPlaceholder")}
          rows={3}
          className="border-slate-800/50 bg-slate-800/30 text-white placeholder:text-slate-500 focus:border-violet-500"
        />
        {errors.bio && (
          <p className="text-xs text-red-400">{errors.bio.message}</p>
        )}
      </div>

      {/* Niche */}
      <div className="space-y-2">
        <Label className="text-slate-300">{tInfluencer("niche")}</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {niches.map((n) => (
            <button
              key={n.value}
              type="button"
              onClick={() => setValue("niche", n.value, { shouldValidate: true })}
              className={cn(
                "flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all",
                selectedNiche === n.value
                  ? n.color
                  : "border-slate-800/50 bg-slate-800/20 text-slate-400 hover:border-slate-700"
              )}
            >
              <span className="text-lg">{n.emoji}</span>
              {n.label}
            </button>
          ))}
        </div>
        {errors.niche && (
          <p className="text-xs text-red-400">{errors.niche.message}</p>
        )}
      </div>

      {/* Age */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-slate-300">{t("age")}</Label>
          <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-400">
            {age} {t("years")}
          </Badge>
        </div>
        <Controller
          name="age"
          control={control}
          render={({ field }) => (
            <Slider
              min={18}
              max={35}
              step={1}
              value={[field.value]}
              onValueChange={([v]) => field.onChange(v)}
              className="py-2"
            />
          )}
        />
      </div>

      {/* Personality */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-slate-300">{t("personality")}</Label>
          <span
            className={cn(
              "text-xs",
              (personality?.length ?? 0) > 500 ? "text-red-400" : "text-slate-500"
            )}
          >
            {personality?.length ?? 0}/500
          </span>
        </div>
        <Textarea
          {...register("personality")}
          placeholder={t("personalityPlaceholder")}
          rows={3}
          className="border-slate-800/50 bg-slate-800/30 text-white placeholder:text-slate-500 focus:border-violet-500"
        />
        {errors.personality && (
          <p className="text-xs text-red-400">{errors.personality.message}</p>
        )}
      </div>

      {/* NSFW toggle — hidden for now, will be re-enabled later */}
      {false && (
      <div className="space-y-3 rounded-xl border border-slate-800/50 bg-slate-800/20 p-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="nsfw-toggle" className="text-slate-300">
            {t("enableNsfw")}
          </Label>
          <Controller
            name="isNsfw"
            control={control}
            render={({ field }) => (
              <Switch
                id="nsfw-toggle"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
        {isNsfw && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs text-amber-300">
              <p>{t("nsfwHint")}</p>
              <Link
                href="/billing"
                className="mt-1 inline-block text-amber-400 underline underline-offset-2 hover:text-amber-300"
              >
                {t("seePlans")}
              </Link>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={!isValid}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {t("next")} →
        </button>
      </div>

      {/* Sprint 12 — AI persona suggestions dialog */}
      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="max-w-2xl border-slate-800 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5 text-violet-400" />
              3 personnalités générées pour toi
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Clique sur celle qui te ressemble. Tu pourras toujours l&apos;éditer
              ensuite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applySuggestion(i)}
                className="group w-full rounded-xl border border-slate-700 bg-slate-800/30 p-4 text-left transition-all hover:border-violet-500 hover:bg-violet-500/10"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                    {i === 0
                      ? "Authentique"
                      : i === 1
                        ? "Drôle & joueuse"
                        : "Audacieuse"}
                  </span>
                </div>
                <p className="text-sm font-medium text-white">{s.bio}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {s.personality}
                </p>
              </button>
            ))}
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggestMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 py-2 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
            >
              {suggestMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3" />
              )}
              Régénérer 3 nouvelles propositions
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}

