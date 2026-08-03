"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowRight, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { pickRandomInfluencerName } from "@/lib/influencer-name-suggestions";
import {
  clearNsfwWizardDefaults,
  getNsfwWizardDefaults,
} from "@/lib/wizard-of-flow";
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

export function WizardStepIdentity({ onNext }: { onNext: () => void }) {
  const t = useTranslations("wizard");
  const tInfluencer = useTranslations("influencer");
  const { data, updateData } = useInfluencerWizard();
  const { data: plan } = useCurrentPlan();
  const allowNsfw = plan?.features.hasNsfw ?? false;
  const [detailsOpen, setDetailsOpen] = useState(false);

  const namePlaceholder = useMemo(() => pickRandomInfluencerName(), []);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, t("nameMin")).max(50, t("nameMax")),
        gender: z.enum(["female", "male", "nonbinary"]).default("female"),
        angle: z.string().min(5, t("angleMin")).max(120, t("angleMax")),
        bio: z.string().max(300, t("bioMax")).optional().default(""),
        personality: z
          .string()
          .max(500, t("personalityMax"))
          .optional()
          .default(""),
        niche: z.string().min(1, t("chooseNiche")),
        age: z.number().min(18).max(35),
        isNsfw: z.boolean(),
      }),
    [t]
  );

  type FormData = z.infer<typeof schema>;

  const niches = useMemo(
    () =>
      (
        [
          "FASHION",
          "FITNESS",
          "TRAVEL",
          "GAMING",
          "FOOD",
          "LIFESTYLE",
          "TECH",
          "ADULT",
        ] as const
      ).map((value) => ({
        value,
        label: tInfluencer(NICHE_KEYS[value]),
      })),
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
    reValidateMode: "onChange",
    criteriaMode: "all",
    defaultValues: {
      name: data.name,
      gender: data.gender ?? "female",
      angle: data.angle || data.brief || "",
      bio: data.bio,
      personality: data.personality,
      niche: data.niche,
      age: data.age || 24,
      isNsfw: data.isNsfw,
    },
  });

  useEffect(() => {
    void trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reset({
      name: data.name,
      gender: data.gender ?? "female",
      angle: data.angle || data.brief || "",
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
    data.angle,
    data.brief,
    data.niche,
    data.gender,
    data.age,
    data.isNsfw,
    reset,
    trigger,
  ]);

  const selectedNiche = watch("niche");
  const isNsfw = watch("isNsfw");
  const age = watch("age");

  const onSubmit = (formData: FormData) => {
    const angle = formData.angle.trim();
    const bio =
      formData.bio?.trim() && formData.bio.trim().length >= 10
        ? formData.bio.trim()
        : angle;
    const personality =
      formData.personality?.trim() && formData.personality.trim().length >= 10
        ? formData.personality.trim()
        : angle;
    updateData({
      name: formData.name,
      gender: formData.gender,
      angle,
      bio,
      personality,
      brief: data.brief?.trim() || angle,
      niche: formData.niche,
      age: formData.age,
      isNsfw: formData.isNsfw,
    });
    onNext();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 max-md:pb-[var(--mobile-nav-height)]"
    >
      <TemplatePicker />
      <WizardIdentityPreview />

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

      <div className="space-y-2.5">
        <Eyebrow>{tInfluencer("niche")}</Eyebrow>
        <p className="text-[11px] leading-relaxed text-slate-500">
          {t("nicheSimpleHint")}
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {niches.map((n) => {
            const active = selectedNiche === n.value;
            return (
              <button
                key={n.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setValue("niche", n.value, { shouldValidate: true })
                }
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground"
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
        {errors.niche && (
          <p className="text-xs text-red-400">{errors.niche.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Eyebrow>{t("angleLabel")}</Eyebrow>
        <p className="text-[11px] leading-relaxed text-slate-500">
          {t("angleHint")}
        </p>
        <Input
          {...register("angle")}
          placeholder={t("anglePlaceholder")}
          className={wizardInputClass}
        />
        {errors.angle && (
          <p className="text-xs text-red-400">{errors.angle.message}</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Eyebrow>{t("age")}</Eyebrow>
          <Badge variant="outline" className="text-muted-foreground">
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

      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left text-sm text-slate-300 hover:border-white/20">
          {t("identityDetailsOptional")}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-500 transition-transform",
              detailsOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4">
          <div className="space-y-2">
            <Eyebrow>{tInfluencer("bio")}</Eyebrow>
            <Textarea
              {...register("bio")}
              placeholder={t("bioPlaceholder")}
              rows={3}
              className={wizardTextareaClass}
            />
          </div>
          <div className="space-y-2">
            <Eyebrow>{t("personality")}</Eyebrow>
            <Textarea
              {...register("personality")}
              placeholder={t("personalityPlaceholder")}
              rows={3}
              className={wizardTextareaClass}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

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

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={!isValid}
          className={wizardPrimaryButtonClass}
        >
          {t("next")}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </form>
  );
}
