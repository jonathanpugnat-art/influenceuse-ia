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
  Heart,
  Eye,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildInstagramEmbedUrl,
  buildTikTokEmbedUrl,
} from "@/lib/trends/trend-video-items";

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
    viewCount?: number | null;
    likesCount?: number | null;
    commentsCount?: number | null;
    sourceUrl: string | null;
    embedUrl?: string | null;
    /**
     * Sprint 13.2 — hero image displayed at the top of the card. When null,
     * we fall back to a niche-coloured gradient so the layout doesn't break.
     */
    thumbnailUrl?: string | null;
    /** Optional 2nd image swapped on hover for a tiny "alive" effect. */
    thumbnailUrlAlt?: string | null;
    /** Direct MP4 or platform embed for inline preview (no click required). */
    inlinePreview?: { kind: "video" | "embed"; url: string } | null;
    mediaUrls?: string[];
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
  /** 1-click: seed studio + auto-generate (photo only). */
  onGenerate?: (recommendationId: string) => void;
  /**
   * No recommendation yet — personalize then auto-generate in one flow.
   */
  onGenerateFromTrend?: (trendItemId: string) => void;
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

function platformLabel(p: TrendCardProps["trend"]["platform"]): string {
  switch (p) {
    case "TIKTOK":
      return "TikTok";
    case "INSTAGRAM":
      return "Instagram";
    case "ONLYFANS":
      return "OnlyFans";
    default: {
      const _exhaustive: never = p;
      return _exhaustive;
    }
  }
}

function compactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(value);
}

/** Neutral placeholder surface used when no thumbnail is available. */
function fallbackGradient(): string {
  return "bg-gradient-to-b from-muted/60 to-background";
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
  onGenerate,
  onGenerateFromTrend,
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
  const tCommon = useTranslations("common");
  const fields = readFields(trend.recommendation?.generatedFields);
  const hasRec = trend.recommendation !== null;
  const [hovered, setHovered] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const isVideo =
    trend.mediaKind === "video" || Boolean(trend.inlinePreview);
  const isReelTarget =
    fields?.type === "REEL" || (isVideo && fields?.type !== "PHOTO");
  const isPhotoTarget = !isReelTarget;
  const inlinePreview = trend.inlinePreview;
  const fallbackEmbedUrl =
    trend.platform === "TIKTOK"
      ? buildTikTokEmbedUrl(trend.embedUrl ?? trend.sourceUrl)
      : trend.platform === "INSTAGRAM"
        ? buildInstagramEmbedUrl(trend.embedUrl ?? trend.sourceUrl)
        : null;
  const showInlineVideo =
    inlinePreview?.kind === "video" && !videoFailed;
  const embedSrc =
    inlinePreview?.kind === "embed"
      ? inlinePreview.url
      : videoFailed
        ? fallbackEmbedUrl
        : !inlinePreview
          ? fallbackEmbedUrl
          : null;
  const showInlineEmbed = Boolean(embedSrc) && !showInlineVideo;
  const heroLink = trend.sourceUrl || "#";

  const heroSrc =
    hovered && trend.thumbnailUrlAlt
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
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl transition-colors hover:border-foreground/25"
    >
      {/* ── Hero (inline video / thumbnail) ─────────────────────── */}
      <div
        className={cn(
          "relative block aspect-[4/5] w-full overflow-hidden bg-black",
          !showInlineVideo && !showInlineEmbed && !heroSrc && fallbackGradient()
        )}
      >
        {showInlineVideo ? (
          <video
            src={inlinePreview!.url}
            poster={heroSrc ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setVideoFailed(true)}
          />
        ) : showInlineEmbed && embedSrc ? (
          <iframe
            src={embedSrc}
            title={trend.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
          />
        ) : heroSrc ? (
          <Image
            src={heroSrc}
            alt={trend.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        ) : null}

        {trend.sourceUrl && !showInlineVideo && !showInlineEmbed && (
          <a
            href={heroLink}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 z-[1]"
            aria-label={t("openSource")}
          />
        )}

        {/* Bottom dark gradient for text legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Top — platform badge + growth */}
        <div className="absolute inset-x-0 top-0 z-[2] flex items-center justify-between p-3">
          <Badge
            variant="outline"
            className="border-white/20 bg-black/50 text-xs text-white backdrop-blur-md"
          >
            {platformLabel(trend.platform)}
          </Badge>
          {isVideo && (
            <Badge
              variant="outline"
              className="border-white/20 bg-black/50 text-[10px] text-white/90 backdrop-blur-md"
            >
              {t("videoTrendBadge")}
            </Badge>
          )}
          {typeof trend.likesCount === "number" && trend.likesCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white/90 backdrop-blur-md">
              <Heart className="h-3 w-3" />
              {compactCount(trend.likesCount)}
            </span>
          )}
          {typeof trend.viewCount === "number" && trend.viewCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white/90 backdrop-blur-md">
              <Eye className="h-3 w-3" />
              {compactCount(trend.viewCount)}
            </span>
          )}
          {typeof trend.growthScore === "number" && (
            <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-emerald-300 backdrop-blur-md">
              <TrendingUp className="h-3 w-3" />
              {Math.round(trend.growthScore)}
            </span>
          )}
        </div>

        {/* Play overlay only when there's no inline preview */}
        {!showInlineVideo && !showInlineEmbed && (
          <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-xl">
              <Play className="ml-0.5 h-6 w-6 fill-current" />
            </div>
          </div>
        )}

        {/* Bottom — author handle */}
        {trend.authorHandle && (
          <div className="absolute bottom-2 left-3 z-[2] text-xs font-medium text-white/90 drop-shadow">
            {trend.authorHandle}
          </div>
        )}

        {trend.sourceUrl && (showInlineVideo || showInlineEmbed) && (
          <a
            href={heroLink}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-3 z-[2] flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            aria-label={t("openSource")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 line-clamp-2 text-base font-semibold text-foreground">
          {trend.title}
        </h3>

        {trend.description && (
          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
            {trend.description}
          </p>
        )}

        <div className="mb-3 space-y-1.5">
          {trend.hashtags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <Hash className="h-3 w-3 shrink-0" />
              {trend.hashtags.slice(0, 4).map((h) => (
                <span key={h} className="rounded bg-muted/60 px-1.5 py-0.5">
                  #{h}
                </span>
              ))}
            </div>
          )}
          {trend.soundName && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Music2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{trend.soundName}</span>
            </div>
          )}
        </div>

        {trend.formatBrief && (
          <div className="mb-3 rounded-xl border border-border/60 bg-muted/30 p-3">
            <p className="mb-1 text-xs font-medium text-foreground">
              {t("formatBriefTitle")}
            </p>
            <p className="line-clamp-3 text-[11px] leading-snug text-foreground/80">
              {trend.formatBrief.sceneDescription}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {trend.formatBrief.analyzedFrom === "vision"
                ? t("formatAnalyzedFromVision")
                : t("formatAnalyzedFromText")}{" "}
              ·{" "}
              {trend.formatBrief.confidence === "high"
                ? t("confidenceHigh")
                : trend.formatBrief.confidence === "medium"
                  ? t("confidenceMedium")
                  : trend.formatBrief.confidence}
            </p>
          </div>
        )}

        {hasRec && trend.recommendation && (
          <div className="mb-4 rounded-xl border-l-2 border-rose-400/70 bg-muted/30 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-300">
              <Sparkles className="h-3.5 w-3.5" />
              {t("personalized")}
              {fields?.confidence && (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {fields.confidence}
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium text-foreground">
              {trend.recommendation.generatedHook}
            </p>
            {fields && (
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {fields.type && (
                  <span className="flex items-center gap-1">
                    {fields.type === "REEL" ? (
                      <VideoIcon className="h-3 w-3" />
                    ) : (
                      <ImageIcon className="h-3 w-3" />
                    )}
                    {fields.type === "REEL" ? tCommon("reel") : tCommon("photo")}
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
              <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
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
              className="w-full"
              disabled={isBusy || isAnalyzingFormat}
              onClick={() => onAnalyzeFormat(trend.id)}
            >
              {isAnalyzingFormat ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t("analyzeFormatCta", { cost: formatAnalyzeCost.toString() })}
            </Button>
          )}
          <div className="flex flex-col gap-2">
          {hasRec && trend.recommendation ? (
            <>
              <div className="flex items-center gap-2">
                {isPhotoTarget && onGenerate ? (
                  <Button
                    size="sm"
                    className="min-h-9 flex-1"
                    disabled={isBusy}
                    onClick={() => onGenerate(trend.recommendation!.id)}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    {t("generatePhotoCta")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="min-h-9 flex-1"
                    disabled={isBusy}
                    onClick={() => onApply(trend.recommendation!.id)}
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    {!fields?.type && isVideo
                      ? t("applyReelCta")
                      : isReelTarget
                        ? t("applyReelCta")
                        : t("applyPhotoCta")}
                  </Button>
                )}
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
              {isPhotoTarget && onGenerate ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-9 w-full"
                  disabled={isBusy}
                  onClick={() => onApply(trend.recommendation!.id)}
                >
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                  {t("openStudioCta")}
                </Button>
              ) : null}
              {onSchedule && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-9 w-full"
                  disabled={isBusy}
                  onClick={() => onSchedule(trend.recommendation!.id)}
                >
                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                  {t("scheduleCta")}
                </Button>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {onGenerateFromTrend && needsPersonalization ? (
                <Button
                  size="sm"
                  className="min-h-9 w-full"
                  disabled={isBusy || isPersonalizing}
                  onClick={() => onGenerateFromTrend(trend.id)}
                >
                  {isPersonalizing ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      {t("personalizingThis")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      {t("generateFromTrendCta", {
                        cost: personalizeOneCost.toString(),
                      })}
                    </>
                  )}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={
                  isBusy ||
                  isPersonalizing ||
                  !needsPersonalization ||
                  !onPersonalize
                }
                onClick={() => onPersonalize?.(trend.id)}
              >
                {isPersonalizing && !onGenerateFromTrend ? (
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
            </div>
          )}
          {trend.sourceUrl && (
            <a
              href={trend.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
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
