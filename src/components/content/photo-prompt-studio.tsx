"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Coins, Loader2, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { composePhotoParamsFromPrompt } from "@/lib/photo-prompt-compose";
import {
  getPhotoIntentMessage,
  validatePhotoIntent,
} from "@/lib/photo-intent-validation";
import { MIN_USER_SCENE_LENGTH } from "@/lib/photo-scene-user";
import { type InfluencerGender } from "@/lib/photo-niche-defaults";
import { CREDIT_COSTS } from "@/lib/constants";
import { useInfluencers } from "@/hooks/use-influencers";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { ContentLanePicker } from "@/components/content/content-lane-picker";
import { cn } from "@/lib/utils";

const PROMPT_EXAMPLES = [
  "promptExampleCafe",
  "promptExampleStreet",
  "promptExampleBeach",
  "promptExampleBoudoir",
] as const;

function draftPromptFromParams(params: {
  sceneDescription: string;
  outfit: string;
  customPrompt: string;
}): string {
  return [
    params.sceneDescription.trim(),
    params.outfit.trim() ? `wearing ${params.outfit.trim()}` : null,
    params.customPrompt.trim() || null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function PhotoPromptStudio({
  identityPackPending = false,
}: {
  /** Soft-block generate while identity angles are still building (welcome flow). */
  identityPackPending?: boolean;
}) {
  const t = useTranslations("content");
  const locale = useLocale() as "fr" | "en";
  const { params, updateParams, applyParamsAndGenerate, isGenerating } =
    usePhotoCreator();
  const [prompt, setPrompt] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [seedSynced, setSeedSynced] = useState(false);

  const { data: influencersData } = useInfluencers(
    { limit: 50 },
    { placeholderData: (prev) => prev }
  );
  const { data: plan } = useCurrentPlan();
  const influencers = influencersData?.influencers ?? [];
  const selected = influencers.find((i) => i.id === params.influencerId);
  const gender = (selected?.gender as InfluencerGender | undefined) ?? "female";
  const portraitUrl =
    selected?.baseImageUrl?.trim() || selected?.avatarUrl?.trim() || null;
  const hasInfluencer = Boolean(params.influencerId);
  const hasNsfwPlan = plan?.features.hasNsfw ?? false;
  const composeCost = params.numberOfImages * CREDIT_COSTS.PHOTO;

  const canGenerate =
    hasInfluencer &&
    prompt.trim().length >= MIN_USER_SCENE_LENGTH &&
    !isGenerating &&
    !identityPackPending;

  const examples = useMemo(
    () => PROMPT_EXAMPLES.map((key) => ({ key, text: t(key) })),
    [t]
  );

  const draftFromParams = draftPromptFromParams(params);
  if (
    !seedSynced &&
    !prompt.trim() &&
    draftFromParams.length >= MIN_USER_SCENE_LENGTH
  ) {
    setPrompt(draftFromParams);
    setSeedSynced(true);
  }

  const handleGenerate = () => {
    if (identityPackPending) {
      toast.info(t("identityPackGeneratingBanner"));
      return;
    }
    if (!hasInfluencer) {
      toast.error(t("selectInfluencerFirst"));
      return;
    }
    const trimmed = prompt.trim();
    if (trimmed.length < MIN_USER_SCENE_LENGTH) {
      toast.error(t("promptTooShort", { min: MIN_USER_SCENE_LENGTH }));
      return;
    }

    const composed = composePhotoParamsFromPrompt({
      prompt: trimmed,
      gender,
      influencerIsNsfw: selected?.isNsfw ?? false,
      hasNsfwPlan,
    });
    const nextParams =
      params.contentMode === "NSFW"
        ? {
            ...composed,
            contentMode: "NSFW" as const,
            nsfwLevel: params.nsfwLevel,
          }
        : composed;

    const issues = validatePhotoIntent({
      contentMode: nextParams.contentMode ?? "SFW",
      sceneDescription: nextParams.sceneDescription,
      outfit: nextParams.outfit,
      scene: nextParams.scene,
      locale,
    });
    for (const issue of issues.filter((i) => i.severity === "warning")) {
      toast.warning(getPhotoIntentMessage(issue, locale), { duration: 5000 });
    }
    const error = issues.find((i) => i.severity === "error");
    if (error) {
      toast.error(getPhotoIntentMessage(error, locale));
      return;
    }

    applyParamsAndGenerate(nextParams);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-border/60 bg-card/30">
      <div className="shrink-0 border-b border-border/60 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("promptStudioTitle")}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("promptStudioSubtitle")}
            </p>
          </div>
          {selected && portraitUrl ? (
            <div className="relative h-10 w-9 shrink-0 overflow-hidden rounded-lg border border-border">
              <Image
                src={portraitUrl}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}
        </div>

        {influencers.length === 0 ? (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {t("createFirstInfluencer")}
            </p>
            <Link
              href="/influencers/new"
              className="text-[11px] font-medium text-rose-400 hover:text-rose-300"
            >
              {t("createLink")}
            </Link>
          </div>
        ) : influencers.length === 1 ? (
          <p className="mt-3 truncate text-sm font-medium text-foreground">
            {influencers[0]?.name}
          </p>
        ) : (
          <Select
            value={params.influencerId}
            onValueChange={(v) => updateParams({ influencerId: v })}
          >
            <SelectTrigger className="mt-3 h-10 text-sm">
              <SelectValue placeholder={t("selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {influencers.map((inf) => (
                <SelectItem key={inf.id} value={inf.id}>
                  {inf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {hasInfluencer ? (
        <div className="px-4 pb-1">
          <ContentLanePicker
            variant="studio"
            showFaceReference={false}
            showSceneFirst={false}
            showPremiumIntensity
          />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <Label className="mb-2 text-xs text-muted-foreground">
          {t("promptStudioLabel")}
        </Label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={!hasInfluencer || isGenerating}
          placeholder={t("promptStudioPlaceholder")}
          rows={8}
          className="min-h-[160px] w-full flex-1 resize-none rounded-xl border border-border/60 bg-muted/40 px-3 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-ring/60 focus:outline-none focus:ring-1 focus:ring-ring/40 disabled:opacity-50"
        />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {examples.map(({ key, text }) => (
            <button
              key={key}
              type="button"
              disabled={!hasInfluencer || isGenerating}
              onClick={() => setPrompt(text)}
              className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-40"
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/60 bg-background/80 px-4 py-3">
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-[11px] text-muted-foreground hover:text-foreground">
            {t("promptStudioAdvanced")}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                advancedOpen && "rotate-180"
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pb-2 pt-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">
                {t("numberOfImages")}
              </Label>
              <Slider
                value={[params.numberOfImages]}
                min={1}
                max={4}
                step={1}
                onValueChange={([v]) =>
                  updateParams({ numberOfImages: v ?? 1 })
                }
                className="mt-2"
              />
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                {params.numberOfImages}
              </p>
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground/70">
              {t("promptStudioRoutingHint")}
            </p>
          </CollapsibleContent>
        </Collapsible>

        {identityPackPending ? (
          <p className="mb-2 text-[11px] text-amber-400/90">
            {t("identityPackGeneratingBanner")}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={cn(
            "mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-colors",
            canGenerate
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("generating")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {t("promptStudioGenerate")}
              <span className="flex items-center gap-0.5 text-xs opacity-80">
                <Coins className="h-3 w-3" />
                {composeCost}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
