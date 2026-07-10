"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Sparkles, Check, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { TemplatePicker } from "@/components/influencer/template-picker";
import {
  Eyebrow,
  nicheDotClass,
  wizardInputClass,
  wizardPrimaryButtonClass,
  wizardSegmentClass,
  wizardTextareaClass,
} from "@/components/influencer/wizard-ui";
import { WizardIdentityPreview } from "@/components/influencer/wizard-identity-preview";
import { WizardVisionCard } from "@/components/influencer/wizard-vision-card";
import { pickRandomInfluencerName } from "@/lib/influencer-name-suggestions";
import {
  clearNsfwWizardDefaults,
  getNsfwWizardDefaults,
} from "@/lib/wizard-of-flow";
import { trpc } from "@/lib/trpc";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { cn } from "@/lib/utils";
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

type NicheOption = {
  value: string;
  emoji: string;
  label: string;
  color: string;
};

export function WizardStepIdentity({ onNext }: { onNext: () => void }) {
  const t = useTranslations("wizard");
  const tInfluencer = useTranslations("influencer");
  const { data, updateData } = useInfluencerWizard();
  const { data: plan } = useCurrentPlan();
  const allowNsfw = plan?.features.hasNsfw ?? false;

  // Sprint 14 — rotate the name placeholder per mount so we don't all end
  // up with "Luna Fit" influencers. Memoised so it doesn't jitter on every
  // re-render but does refresh when the user opens the wizard again.
  const namePlaceholder = useMemo(() => pickRandomInfluencerName(), []);

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
    trigger,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    mode: "onChange",
    // Sprint 14 — bugfix: with mode:"onChange" alone, isValid stays false on
    // mount even when defaultValues are all valid (the case when arriving
    // from a Template). We force a validation pass on mount + after every
    // template-driven reset() below so the "Next" button isn't stuck.
    reValidateMode: "onChange",
    criteriaMode: "all",
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

  // Sprint 14 — bugfix #1: trigger() on mount so isValid reflects defaults.
  useEffect(() => {
    void trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync form values when a template applies updates to the zustand store
  // from outside this component (e.g. TemplatePicker). After resetting we
  // re-run validation so the "Next" button enables immediately if the
  // template filled every required field.
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
    void trigger();
  }, [
    data.name,
    data.bio,
    data.personality,
    data.niche,
    data.gender,
    data.age,
    data.isNsfw,
    reset,
    trigger,
  ]);

  const bio = watch("bio");
  const personality = watch("personality");
  const selectedNiche = watch("niche");
  const isNsfw = watch("isNsfw");
  const age = watch("age");

  const onSubmit = (formData: FormData) => {
    updateData(formData);
    onNext();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 max-md:pb-[var(--mobile-nav-height)]"
    >
      {/* Sprint 7 — pre-baked persona templates */}
      <TemplatePicker />

      <WizardVisionCard />

      <WizardIdentityPreview />

      {/* Name */}
      <div className="space-y-2">
        <Eyebrow>{t("influencerName")}</Eyebrow>
        <Input
          id="wizard-identity-name"
          {...register("name")}
          placeholder={t("namePlaceholderRotating", { name: namePlaceholder })}
          className={wizardInputClass}
        />
        {errors.name && (
          <p className="text-xs text-red-400">{errors.name.message}</p>
        )}
      </div>

      {/* Gender */}
      <div className="space-y-2">
        <Eyebrow>{t("gender")}</Eyebrow>
        <div className="grid grid-cols-3 gap-1.5">
          {(["female", "male", "nonbinary"] as const).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={watch("gender") === g}
              onClick={() => setValue("gender", g, { shouldValidate: true })}
              className={wizardSegmentClass(watch("gender") === g)}
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
          <Eyebrow>{tInfluencer("bio")}</Eyebrow>
          <span
            className={cn(
              "text-xs tabular-nums",
              (bio?.length ?? 0) > 300 ? "text-red-400" : "text-slate-600"
            )}
          >
            {bio?.length ?? 0}/300
          </span>
        </div>
        <Textarea
          {...register("bio")}
          placeholder={t("bioPlaceholder")}
          rows={3}
          className={wizardTextareaClass}
        />
        {errors.bio && (
          <p className="text-xs text-red-400">{errors.bio.message}</p>
        )}
      </div>

      {/* Niche — demoted: the agent detects it, the user confirms/overrides. */}
      <NicheField
        niches={niches}
        selected={selectedNiche}
        detected={Boolean(
          data.nicheProfile?.nicheCategory &&
            data.nicheProfile.nicheCategory === selectedNiche
        )}
        onSelect={(value) => setValue("niche", value, { shouldValidate: true })}
        error={errors.niche?.message}
      />

      {/* Age */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Eyebrow>{t("age")}</Eyebrow>
          <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-300">
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
          <Eyebrow>{t("personality")}</Eyebrow>
          <span
            className={cn(
              "text-xs tabular-nums",
              (personality?.length ?? 0) > 500 ? "text-red-400" : "text-slate-600"
            )}
          >
            {personality?.length ?? 0}/500
          </span>
        </div>
        <Textarea
          {...register("personality")}
          placeholder={t("personalityPlaceholder")}
          rows={3}
          className={wizardTextareaClass}
        />
        {errors.personality && (
          <p className="text-xs text-red-400">{errors.personality.message}</p>
        )}
      </div>

      {allowNsfw && (
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
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    const name = watch("name");
                    const niche = watch("niche");
                    const onlyfansUsername = data.onlyfansUsername;
                    if (checked) {
                      const patch = getNsfwWizardDefaults({
                        name,
                        niche,
                        onlyfansUsername,
                      });
                      updateData(patch);
                      if (patch.niche && patch.niche !== niche) {
                        setValue("niche", patch.niche, { shouldValidate: true });
                      }
                    } else {
                      updateData(clearNsfwWizardDefaults());
                    }
                  }}
                />
              )}
            />
          </div>
          {isNsfw && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="text-xs text-amber-300">
                <p>{t("nsfwHint")}</p>
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
          className={wizardPrimaryButtonClass}
        >
          {t("next")}
          <span className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
      </div>
    </form>
  );
}

/**
 * Demoted niche field. Per the product decision, the niche is a technical
 * category the agent infers — not a manual gate. When a niche is set we show
 * a confirmable chip (flagged "detected" when it came from the agent); the
 * full selector stays one click away for override.
 */
function NicheField({
  niches,
  selected,
  detected,
  onSelect,
  error,
}: {
  niches: NicheOption[];
  selected: string;
  detected: boolean;
  onSelect: (value: string) => void;
  error?: string;
}) {
  const t = useTranslations("wizard");
  const tInfluencer = useTranslations("influencer");
  const [editing, setEditing] = useState(!selected);

  // Collapse back to the confirm chip when niche is set externally (template/agent).
  useEffect(() => {
    if (selected) setEditing(false);
  }, [selected]);

  const current = niches.find((n) => n.value === selected);
  const showGrid = editing || !current;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Eyebrow>{tInfluencer("niche")}</Eyebrow>
        {current && !showGrid ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-violet-300"
          >
            <Pencil className="h-3 w-3" />
            {t("nicheChange")}
          </button>
        ) : null}
      </div>

      {current && !showGrid ? (
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
          <span className="flex items-center gap-2.5">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                nicheDotClass[current.value] ?? "bg-violet-400"
              )}
            />
            <span className="text-sm font-medium text-white">
              {current.label}
            </span>
          </span>
          {detected ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium text-violet-200">
              <Sparkles className="h-3 w-3" />
              {t("nicheDetected")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-300/90">
              <Check className="h-3 w-3" />
              {t("nicheConfirmed")}
            </span>
          )}
        </div>
      ) : (
        <>
          <p className="text-[11px] leading-relaxed text-slate-500">
            {t("nicheAutoHint")}
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {niches.map((n) => {
              const active = selected === n.value;
              return (
                <button
                  key={n.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onSelect(n.value);
                    setEditing(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "border-violet-400/50 bg-violet-500/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200"
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      nicheDotClass[n.value] ?? "bg-violet-400"
                    )}
                  />
                  {n.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

