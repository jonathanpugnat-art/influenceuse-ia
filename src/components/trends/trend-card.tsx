"use client";

import Image from "next/image";
import { useState } from "react";
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
  Play,
  Calendar,
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
    /**
     * Sprint 13.2 — hero image displayed at the top of the card. When null,
     * we fall back to a niche-coloured gradient so the layout doesn't break.
     */
    thumbnailUrl?: string | null;
    /** Optional 2nd image swapped on hover for a tiny "alive" effect. */
    thumbnailUrlAlt?: string | null;
    /** Optional creator handle ("@username") for attribution. */
    authorHandle?: string | null;
    fetchedAt: Date | string;
    mediaKind?: string | null;
    hasMedia?: boolean;
    formatBrief?: {
      contentType: string;
      sceneDescription: string;
      mood: string;
      confidence: string;
      analyzedFrom: string;
    } | null;
    formatAnalyzedAt?: Date | string | null;
    recommendation: {
      id: string;
      generatedHook: string;
      generatedFields: unknown;
    } | null;
  };
  /** When true, the card shows a "personalize" CTA instead of "apply". */
  needsPersonalization: boolean;
  onApply: (recommendationId: string) => void;
  onSchedule?: (recommendationId: string) => void;
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
  onAnalyzeFormat?: (trendItemId: string) => void;
  isAnalyzingFormat?: boolean;
  formatAnalyzeCost?: number;
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

/** Niche-keyed gradient used when no thumbnail is available. */
function fallbackGradient(platform: TrendCardProps["trend"]["platform"]): string {
  switch (platform) {
    case "TIKTOK":
      return "bg-gradient-to-br from-fuchsia-600/40 via-rose-500/30 to-cyan-500/30";
    case "INSTAGRAM":
      return "bg-gradient-to-br from-orange-500/40 via-pink-500/30 to-violet-500/30";
    default:
      return "bg-gradient-to-br from-slate-700/40 via-slate-600/30 to-slate-800/40";
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
  onSchedule,
  onDismiss,
  onPersonalize,
  isBusy,
  isPersonalizing,
  personalizeOneCost = 0.1,
  onAnalyzeFormat,
  isAnalyzingFormat = false,
  formatAnalyzeCost = 0.2,
}: TrendCardProps) {
  const t = useTranslations("trends");
  const fields = readFields(trend.recommendation?.generatedFields);
  const hasRec = trend.recommendation !== null;
  const [hovered, setHovered] = useState(false);

  // Pick which thumbnail to render — alt on hover, primary at rest.
  // Both come from Unsplash (curated) or the provider (Apify), so they're
  // already sized down via query params. Next/image still optimizes them.
  const heroSrc = hovered && trend.thumbnailUrlAlt
    ? trend.thumbnailUrlAlt
    : trend.thumbnailUrl ?? null;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl transition-all hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/10"
    >
      {/* ── Hero (thumbnail + play overlay) ─────────────────────── */}
      <a
        href={trend.sourceUrl ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "relative block aspect-[4/5] w-full overflow-hidden",
          !heroSrc && fallbackGradient(trend.platform)
        )}
        aria-label={t("openSource")}
      >
        {heroSrc && (
          <Image
            src={heroSrc}
            alt={trend.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        )}

        {/* Bottom dark gradient for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />

        {/* Top — platform badge + growth */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <Badge
            variant="outline"
            className={cn(
              "text-xs backdrop-blur-md",
              platformBadgeColor(trend.platform)
            )}
          >
            {trend.platform}
          </Badge>
          {typeof trend.growthScore === "number" && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300 backdrop-blur-md">
              <TrendingUp className="h-3 w-3" />
              {Math.round(trend.growthScore)}
            </span>
          )}
        </div>

        {/* Center play overlay (visible on hover) */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-xl">
            <Play className="ml-0.5 h-6 w-6 fill-current" />
          </div>
        </div>

        {/* Bottom — author handle (Apify) */}
        {trend.authorHandle && (
          <div className="absolute bottom-2 left-3 text-xs font-medium text-white/90 drop-shadow">
            {trend.authorHandle}
          </div>
        )}
      </a>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 line-clamp-2 text-base font-semibold text-white">
          {trend.title}
        </h3>

        {trend.description && (
          <p className="mb-3 line-clamp-2 text-sm text-slate-400">
            {trend.description}
          </p>
        )}

        <div className="mb-3 space-y-1.5">
          {trend.hashtags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
              <Hash className="h-3 w-3 shrink-0" />
              {trend.hashtags.slice(0, 4).map((h) => (
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

        {trend.formatBrief && (
          <div className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="mb-1 text-xs font-medium text-emerald-300">
              {t("formatBriefTitle")}
            </p>
            <p className="line-clamp-3 text-[11px] leading-snug text-slate-300">
              {trend.formatBrief.sceneDescription}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {trend.formatBrief.analyzedFrom === "vision"
                ? t("formatAnalyzedFromVision")
                : t("formatAnalyzedFromText")}{" "}
              · {trend.formatBrief.confidence}
            </p>
          </div>
        )}

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

        <div className="mt-auto flex flex-col gap-2">
          {!trend.formatBrief && onAnalyzeFormat && (
            <Button
              size="sm"
              variant="outline"
              className="w-full border-emerald-500/30 text-emerald-300"
              disabled={isBusy || isAnalyzingFormat}
              onClick={() => onAnalyzeFormat(trend.id)}
            >
              {isAnalyzingFormat ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t("analyzeFormatCta")} ({formatAnalyzeCost} cr)
            </Button>
          )}
          <div className="flex flex-col gap-2">
          {hasRec && trend.recommendation ? (
            <>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="min-h-9 flex-1 bg-violet-500 hover:bg-violet-600"
                  disabled={isBusy}
                  onClick={() => onApply(trend.recommendation!.id)}
                >
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                  {t("applyCta")}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="min-h-9 min-w-9 shrink-0"
                  disabled={isBusy}
                  onClick={() => onDismiss(trend.recommendation!.id)}
                  aria-label={t("dismiss")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {onSchedule && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-9 w-full border-slate-600 text-slate-300"
                  disabled={isBusy}
                  onClick={() => onSchedule(trend.recommendation!.id)}
                >
                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                  {t("scheduleCta")}
                </Button>
              )}
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
        </div>
      </div>
    </motion.article>
  );
}
