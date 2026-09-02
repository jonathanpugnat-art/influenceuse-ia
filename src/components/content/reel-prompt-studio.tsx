"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Coins, Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { useReelCreator } from "@/hooks/use-reel-creator";
import { composeReelParamsFromPrompt } from "@/lib/reel-prompt-compose";
import { MIN_USER_SCENE_LENGTH } from "@/lib/photo-scene-user";
import { CREDIT_COSTS } from "@/lib/constants";
import { trpc } from "@/lib/trpc";
import { useInfluencers } from "@/hooks/use-influencers";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { cn } from "@/lib/utils";

const REEL_EXAMPLES = [
  "reelExampleGrwm",
  "reelExampleOotd",
  "reelExampleCoffee",
  "reelExampleGym",
] as const;

export function ReelPromptStudio() {
  const t = useTranslations("content");
  const { params, updateParams, applyParamsAndGenerate, isGenerating } =
    useReelCreator();
  const [prompt, setPrompt] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { data: influencersData } = useInfluencers({ limit: 50 }, { placeholderData: (prev) => prev });
  const { data: plan } = useCurrentPlan();
  const influencers = influencersData?.influencers ?? [];
  const selected = influencers.find((i) => i.id === params.influencerId);
  const portraitUrl =
    selected?.baseImageUrl?.trim() || selected?.avatarUrl?.trim() || null;
  const hasInfluencer = Boolean(params.influencerId);
  const hasNsfwPlan = plan?.features.hasNsfw ?? false;
  const cost = CREDIT_COSTS.REEL;

  const canGenerate =
    hasInfluencer &&
    prompt.trim().length >= MIN_USER_SCENE_LENGTH &&
    !isGenerating;

  const examples = useMemo(
    () => REEL_EXAMPLES.map((key) => ({ key, text: t(key) })),
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

    const composed = composeReelParamsFromPrompt({
      prompt: trimmed,
      influencerIsNsfw: selected?.isNsfw ?? false,
      hasNsfwPlan,
    });

    applyParamsAndGenerate({
      ...composed,
      duration: params.duration,
      format: params.format,
    });
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-neutral-800/60 bg-neutral-950/40">
      <div className="shrink-0 border-b border-neutral-800/60 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              {t("reelPromptStudioTitle")}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {t("reelPromptStudioSubtitle")}
            </p>
          </div>
          {selected && portraitUrl ? (
            <div className="relative h-10 w-9 shrink-0 overflow-hidden rounded-lg border border-violet-400/30">
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
            <Link href="/influencers/new" className="text-[11px] text-violet-400">
              {t("createLink")}
            </Link>
          </div>
        ) : influencers.length === 1 ? (
          <p className="mt-3 truncate text-sm font-medium text-white">
            {influencers[0]?.name}
          </p>
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
          {t("reelPromptStudioLabel")}
        </Label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={!hasInfluencer || isGenerating}
          placeholder={t("reelPromptStudioPlaceholder")}
          rows={8}
          className="min-h-[160px] w-full flex-1 resize-none rounded-xl border border-neutral-800/60 bg-neutral-900/60 px-3 py-3 text-sm leading-relaxed text-white placeholder:text-neutral-600 focus:border-violet-400/40 focus:outline-none focus:ring-1 focus:ring-violet-400/30 disabled:opacity-50"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {examples.map(({ key, text }) => (
            <button
              key={key}
              type="button"
              disabled={!hasInfluencer || isGenerating}
              onClick={() => setPrompt(text)}
              className="rounded-full border border-neutral-800 bg-neutral-900/80 px-2.5 py-1 text-[10px] text-neutral-400 transition-colors hover:border-violet-400/40 hover:text-violet-200 disabled:opacity-40"
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
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-neutral-400">
                  {t("reelDurationLabel")}
                </Label>
                <span className="text-[11px] text-neutral-300">
                  {params.duration}s
                </span>
              </div>
              <Slider
                min={15}
                max={60}
                step={15}
                value={[params.duration]}
                onValueChange={([v]) =>
                  updateParams({ duration: v as 15 | 30 | 60 })
                }
              />
            </div>
            <div className="flex gap-2">
              {(["VERTICAL", "SQUARE"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => updateParams({ format: fmt })}
                  className={cn(
                    "flex-1 rounded-lg border py-1.5 text-[11px] font-medium",
                    params.format === fmt
                      ? "border-violet-500 bg-violet-500/20 text-violet-200"
                      : "border-neutral-800 text-neutral-500"
                  )}
                >
                  {fmt === "VERTICAL" ? "9:16" : "1:1"}
                </button>
              ))}
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
              ? "bg-gradient-to-r from-violet-500 to-indigo-500 shadow-lg shadow-violet-500/20 hover:opacity-95"
              : "cursor-not-allowed bg-neutral-800 text-neutral-500"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("reelGenerating")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {t("reelPromptStudioGenerate")}
              <span className="flex items-center gap-1 text-xs font-normal text-violet-100/80">
                <Coins className="h-3 w-3" />
                {cost} {t("creditUnit")}
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
