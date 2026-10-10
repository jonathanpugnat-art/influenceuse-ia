"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PhotoPublishFlowState } from "@/hooks/photo-studio";
import { PhotoPublishTiktokSection } from "./photo-publish-tiktok-section";

/**
 * Social Publish V1 — inline options section:
 * - AI-label notice (hardcoded is_ai_generated / is_aigc, no opt-out).
 * - Optional first-comment posted after IG publish.
 * - TikTok composer block (see photo-publish-tiktok-section.tsx) which
 *   implements the UX items TikTok's Content Posting API audit mandates.
 */
export function PhotoPublishSocialSection({
  flow,
}: {
  flow: PhotoPublishFlowState;
}) {
  const t = useTranslations("content");
  const { platforms, firstComment, setFirstComment } = flow;
  const igSelected = platforms.includes("INSTAGRAM");

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 p-2.5">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fuchsia-300" />
        <div className="flex-1 space-y-0.5">
          <p className="text-[11px] font-medium text-foreground">
            {t("publishAiLabelTitle")}
          </p>
          <p className="text-[10px] leading-snug text-muted-foreground">
            {t("publishAiLabelHint")}
          </p>
        </div>
      </div>

      {igSelected && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("publishFirstCommentLabel")}
          </Label>
          <Textarea
            value={firstComment}
            onChange={(e) => setFirstComment(e.target.value)}
            placeholder={t("publishFirstCommentPlaceholder")}
            className="min-h-[64px] text-xs"
            maxLength={2200}
          />
          <p className="text-[10px] text-muted-foreground/70">
            {t("publishFirstCommentHint")}
          </p>
        </div>
      )}

      <PhotoPublishTiktokSection flow={flow} />
    </div>
  );
}
