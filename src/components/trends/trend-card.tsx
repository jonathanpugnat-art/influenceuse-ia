"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  Hash,
  Music2,
  Sparkles,
  ExternalLink,
  X,
  Wand2,
  Image as ImageIcon,
  Video as VideoIcon,
  Loader2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// We keep the prop type local — the page is the single consumer and we want
// to avoid a circular type import from the tRPC AppRouter.
export interface TrendCardProps {
  trend: {
    id: string;
    platform: "TIKTOK" | "INSTAGRAM" | "ONLYFANS";
    title: string;
    description: string | null;
    hashtags: string[];
    soundName: string | null;
    growthScore: number | null;
    sourceUrl: string | null;
    fetchedAt: Date | string;
    recommendation: {
      id: string;
      generatedHook: string;
      generatedFields: unknown;
    } | null;
  };
  /** When true, the card shows a "personalize" CTA instead of "apply". */
  needsPersonalization: boolean;
  onApply: (recommendationId: string) => void;
  onDismiss: (recommendationId: string) => void;
  /**
   * Sprint 13.1 — per-card personalization. When passed, clicking
   * "Personalize" on a card triggers the cheap single-trend mutation
   * (~0.1 cr) instead of forcing the user through the full bulk pass.
   */
  onPersonalize?: (trendItemId: string) => void;
  /** Disabled state during a mutation. */
  isBusy?: boolean;
  /** Spinner state for THIS specific card while it's being personalized. */
  isPersonalizing?: boolean;
  /** Cost shown on the per-card "Personalize" CTA (defaults to 0.1). */
  personalizeOneCost?: number;
}

function platformBadgeColor(p: TrendCardProps["trend"]["platform"]): string {
  switch (p) {
    case "TIKTOK":
      return "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30";
    case "INSTAGRAM":
      return "bg-orange-500/15 text-orange-300 border-orange-500/30";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  }
}

interface GeneratedFieldsLite {
  type?: string;
  scene?: string;
  pose?: string;
  outfit?: string;
  confidence?: "high" | "medium" | "low";
  citations?: string[];
}

function readFields(raw: unknown): GeneratedFieldsLite | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as GeneratedFieldsLite;
}

export function TrendCard({
  trend,
  needsPersonalization,
  onApply,
  onDismiss,
  onPersonalize,
  isBusy,
  isPersonalizing,
  personalizeOneCost = 0.1,
}: TrendCardProps) {
  const t = useTranslations("trends");
  const fields = readFields(trend.recommendation?.generatedFields);
  const hasRec = trend.recommendation !== null;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 backdrop-blur-xl transition-colors hover:border-slate-700"
    >
      {/* Header — platform + growth */}
      <div className="mb-3 flex items-center justify-between">
        <Badge variant="outline" className={cn("text-xs", platformBadgeColor(trend.platform))}>
          {trend.platform}
        </Badge>
        {typeof trend.growthScore === "number" && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />
            {Math.round(trend.growthScore)}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="mb-1 line-clamp-2 text-base font-semibold text-white">
        {trend.title}
      </h3>

      {/* Description */}
      {trend.description && (
        <p className="mb-3 line-clamp-3 text-sm text-slate-400">
          {trend.description}
        </p>
      )}

      {/* Hashtags + Sound */}
      <div className="mb-4 space-y-1.5">
        {trend.hashtags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <Hash className="h-3 w-3 shrink-0" />
            {trend.hashtags.slice(0, 5).map((h) => (
              <span key={h} className="rounded bg-slate-800/60 px-1.5 py-0.5">
                #{h}
              </span>
            ))}
          </div>
        )}
        {trend.soundName && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Music2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{trend.soundName}</span>
          </div>
        )}
      </div>

      {/* Personalized block */}
      {hasRec && trend.recommendation && (
        <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            {t("personalized")}
            {fields?.confidence && (
              <Badge variant="outline" className="ml-auto text-[10px]">
                {fields.confidence}
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-white">
            {trend.recommendation.generatedHook}
          </p>
          {fields && (
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
              {fields.type && (
                <span className="flex items-center gap-1">
                  {fields.type === "REEL" ? (
                    <VideoIcon className="h-3 w-3" />
                  ) : (
                    <ImageIcon className="h-3 w-3" />
                  )}
                  {fields.type}
                </span>
              )}
              {fields.scene && <span>• {fields.scene}</span>}
              {fields.pose && <span>• {fields.pose}</span>}
              {fields.outfit && (
                <span className="line-clamp-1">• {fields.outfit}</span>
              )}
            </p>
          )}
          {fields?.citations && fields.citations.length > 0 && (
            <p className="mt-1.5 text-[10px] uppercase tracking-wider text-slate-500">
              {t("citations")}: {fields.citations.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Footer — actions */}
      <div className="mt-auto flex items-center gap-2">
        {hasRec && trend.recommendation ? (
          <>
            <Button
              size="sm"
              className="flex-1 bg-violet-500 hover:bg-violet-600"
              disabled={isBusy}
              onClick={() => onApply(trend.recommendation!.id)}
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              {t("applyCta")}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={isBusy}
              onClick={() => onDismiss(trend.recommendation!.id)}
              aria-label={t("dismiss")}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={
              isBusy ||
              isPersonalizing ||
              !needsPersonalization ||
              !onPersonalize
            }
            onClick={() => onPersonalize?.(trend.id)}
          >
            {isPersonalizing ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {t("personalizingThis")}
              </>
            ) : needsPersonalization && onPersonalize ? (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {t("personalizeOneCta", {
                  cost: personalizeOneCost.toString(),
                })}
              </>
            ) : (
              t("noRecYet")
            )}
          </Button>
        )}
        {trend.sourceUrl && (
          <a
            href={trend.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-white"
            aria-label={t("openSource")}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </motion.article>
  );
}
