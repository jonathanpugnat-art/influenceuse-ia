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
import { trpc } from "@/lib/trpc";
import { useInfluencers } from "@/hooks/use-influencers";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { cn } from "@/lib/utils";

const PROMPT_EXAMPLES = [
  "promptExampleCafe",
  "promptExampleStreet",
  "promptExampleBeach",
  "promptExampleBoudoir",
] as const;

export function PhotoPromptStudio() {
  const t = useTranslations("content");
  const locale = useLocale() as "fr" | "en";
  const { params, updateParams, applyParamsAndGenerate, isGenerating } =
    usePhotoCreator();
  const [prompt, setPrompt] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { data: influencersData } = useInfluencers({ limit: 50 }, { placeholderData: (prev) => prev });
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
    !isGenerating;

  const examples = useMemo(
    () => PROMPT_EXAMPLES.map((key) => ({ key, text: t(key) })),
    [t]
  );

  const handleGenerate = () => {
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

    const issues = validatePhotoIntent({
      contentMode: composed.contentMode ?? "SFW",
      sceneDescription: composed.sceneDescription,
      outfit: composed.outfit,
      scene: composed.scene,
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

    applyParamsAndGenerate(composed);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-neutral-800/60 bg-neutral-950/40">
      <div className="shrink-0 border-b border-neutral-800/60 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              {t("promptStudioTitle")}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {t("promptStudioSubtitle")}
            </p>
          </div>
          {selected && portraitUrl ? (
            <div className="relative h-10 w-9 shrink-0 overflow-hidden rounded-lg border border-rose-400/30">
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
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-dashed border-neutral-700 px-3 py-2">
            <p className="text-[11px] text-neutral-500">
              {t("createFirstInfluencer")}
            </p>
            <Link href="/influencers/new" className="text-[11px] text-rose-400">
              {t("createLink")}
            </Link>
          </div>
        ) : (
          <Select
            value={params.influencerId}
            onValueChange={(v) => updateParams({ influencerId: v })}
          >
            <SelectTrigger className="mt-3 h-10 border-neutral-800/60 bg-neutral-900/50 text-sm text-white">
              <SelectValue placeholder={t("selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent className="border-neutral-800 bg-neutral-950">
              {influencers.map((inf) => (
                <SelectItem
                  key={inf.id}
                  value={inf.id}
                  className="text-neutral-300"
                >
                  {inf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <Label className="mb-2 text-xs text-neutral-400">
          {t("promptStudioLabel")}
        </Label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={!hasInfluencer || isGenerating}
          placeholder={t("promptStudioPlaceholder")}
          rows={8}
          className="min-h-[160px] w-full flex-1 resize-none rounded-xl border border-neutral-800/60 bg-neutral-900/60 px-3 py-3 text-sm leading-relaxed text-white placeholder:text-neutral-600 focus:border-rose-400/40 focus:outline-none focus:ring-1 focus:ring-rose-400/30 disabled:opacity-50"
        />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {examples.map(({ key, text }) => (
            <button
              key={key}
              type="button"
              disabled={!hasInfluencer || isGenerating}
              onClick={() => setPrompt(text)}
              className="rounded-full border border-neutral-800 bg-neutral-900/80 px-2.5 py-1 text-[10px] text-neutral-400 transition-colors hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-40"
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-neutral-800/60 bg-neutral-950/80 px-4 py-3">
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-[11px] text-neutral-500 hover:text-neutral-300">
            {t("promptStudioAdvanced")}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                advancedOpen && "rotate-180"
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-neutral-400">
                  {t("numberOfImages")}
                </Label>
                <span className="text-[11px] text-neutral-300">
                  {params.numberOfImages}
                </span>
              </div>
              <Slider
                min={1}
                max={4}
                step={1}
                value={[params.numberOfImages]}
                onValueChange={([v]) => updateParams({ numberOfImages: v })}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all",
            canGenerate
              ? "bg-gradient-to-r from-rose-500 to-pink-600 shadow-lg shadow-rose-500/20 hover:opacity-95"
              : "cursor-not-allowed bg-neutral-800 text-neutral-500"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("generatingInfluencer")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {t("promptStudioGenerate")}
              <span className="flex items-center gap-1 text-xs font-normal text-rose-100/80">
                <Coins className="h-3 w-3" />
                {composeCost} {t("creditUnit")}
                {composeCost > 1 ? "s" : ""}
              </span>
            </>
          )}
        </button>

        <p className="mt-2 text-center text-[10px] text-neutral-600">
          {t("promptStudioRoutingHint")}
        </p>
      </div>
    </div>
  );
}
