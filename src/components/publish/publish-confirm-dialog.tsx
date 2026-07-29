"use client";

import { CheckCircle2, AlertTriangle, Loader2, Instagram } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export type PublishPlatform = "INSTAGRAM" | "TIKTOK" | "ONLYFANS";

export interface PublishConfirmPreview {
  mediaUrl?: string | null;
  isVideo?: boolean;
  caption?: string | null;
  hashtags?: string[];
  contentType?: string;
  influencerName?: string;
}

interface PublishConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  influencerId: string;
  platforms: PublishPlatform[];
  preview: PublishConfirmPreview;
  /** Confirm button label override */
  confirmLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
}

/**
 * Shared pre-publish gate: media + caption preview and
 * `checkPublishReadiness` checklist (API officielle Meta).
 */
export function PublishConfirmDialog({
  open,
  onOpenChange,
  influencerId,
  platforms,
  preview,
  confirmLabel,
  isConfirming,
  onConfirm,
}: PublishConfirmDialogProps) {
  const t = useTranslations("publish.confirm");

  const readinessQuery = trpc.publish.checkPublishReadiness.useQuery(
    { influencerId, platforms },
    {
      enabled: open && Boolean(influencerId) && platforms.length > 0,
      staleTime: 15_000,
    }
  );

  const checks = readinessQuery.data?.checks ?? [];
  const ready = readinessQuery.data?.ready ?? false;
  const captionLen = (preview.caption ?? "").length;
  const hashtagLine =
    preview.hashtags && preview.hashtags.length > 0
      ? preview.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
      : "";

  const softWarnings: string[] = [];
  if (platforms.includes("INSTAGRAM") && !preview.caption?.trim()) {
    softWarnings.push(t("warnNoCaption"));
  }
  if (!preview.mediaUrl) {
    softWarnings.push(t("warnNoMedia"));
  }
  if (captionLen > 2200) {
    softWarnings.push(t("warnCaptionLong"));
  }

  const canConfirm =
    ready &&
    Boolean(preview.mediaUrl) &&
    !readinessQuery.isLoading &&
    !isConfirming;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
            <div className="relative aspect-[4/5] max-h-56 w-full bg-muted">
              {preview.mediaUrl ? (
                preview.isVideo ? (
                  <video
                    src={preview.mediaUrl}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.mediaUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  {t("noPreview")}
                </div>
              )}
            </div>
            <div className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {preview.influencerName ? (
                  <span className="text-sm font-medium text-foreground">
                    {preview.influencerName}
                  </span>
                ) : null}
                {preview.contentType ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground"
                  >
                    {preview.contentType}
                  </Badge>
                ) : null}
                {platforms.map((p) => (
                  <Badge
                    key={p}
                    variant="outline"
                    className="text-[10px] text-muted-foreground"
                  >
                    {p === "INSTAGRAM" ? (
                      <span className="inline-flex items-center gap-1">
                        <Instagram className="h-3 w-3" /> Instagram
                      </span>
                    ) : (
                      p
                    )}
                  </Badge>
                ))}
              </div>
              {preview.caption ? (
                <p className="line-clamp-4 text-xs leading-relaxed text-foreground/90">
                  {preview.caption}
                </p>
              ) : (
                <p className="text-xs italic text-muted-foreground">
                  {t("emptyCaption")}
                </p>
              )}
              {hashtagLine ? (
                <p className="line-clamp-2 text-[11px] text-muted-foreground">
                  {hashtagLine}
                </p>
              ) : null}
              <p className="text-[10px] text-muted-foreground/70">
                {t("captionLength", { count: captionLen })}
              </p>
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
            <p className="text-xs font-medium text-foreground">{t("checklistTitle")}</p>
            {readinessQuery.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("checking")}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {checks.map((check) => (
                  <li
                    key={check.platform}
                    className="flex items-start gap-2 text-xs"
                  >
                    {check.ok ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                    )}
                    <span
                      className={cn(
                        check.ok ? "text-foreground/90" : "text-amber-200"
                      )}
                    >
                      <span className="font-medium">{check.platform}</span>
                      {check.reason ? ` — ${check.reason}` : ` — ${t("checkOk")}`}
                    </span>
                  </li>
                ))}
                {softWarnings.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-xs text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            )}
            <p className="pt-1 text-[10px] text-muted-foreground/70">
              {t("officialApiHint")}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
          >
            {t("cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={!canConfirm}>
            {isConfirming ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {t("confirming")}
              </>
            ) : (
              confirmLabel ?? t("confirm")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
