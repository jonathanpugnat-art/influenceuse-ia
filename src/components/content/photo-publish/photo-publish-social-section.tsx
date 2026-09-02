"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import type { PhotoPublishFlowState } from "@/hooks/photo-studio";

/**
 * Social Publish V1 — inline options section:
 * - AI-label notice (hardcoded is_ai_generated / is_aigc, no opt-out).
 * - Optional first-comment posted after IG publish.
 * - TikTok privacy selector (locked SELF_ONLY while the app is un-audited).
 *
 * We keep this section deliberately dumb: state lives in `usePhotoPublishFlow`
 * and every mutation forwards the values to the tRPC publish router.
 */
export function PhotoPublishSocialSection({
  flow,
}: {
  flow: PhotoPublishFlowState;
}) {
  const t = useTranslations("content");
  const {
    params,
    platforms,
    firstComment,
    setFirstComment,
    tiktokPrivacyLevel,
    setTiktokPrivacyLevel,
  } = flow;

  const igSelected = platforms.includes("INSTAGRAM");
  const tiktokSelected = platforms.includes("TIKTOK");

  const creatorInfoQuery = trpc.publish.getTiktokCreatorInfo.useQuery(
    { influencerId: params.influencerId ?? "" },
    {
      enabled: Boolean(params.influencerId) && tiktokSelected,
      staleTime: 60_000,
    }
  );

  const auditApproved = creatorInfoQuery.data?.auditApproved ?? false;
  const privacyOptions = creatorInfoQuery.data?.privacyLevelOptions ?? [
    "SELF_ONLY",
  ];

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

      {tiktokSelected && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("publishTiktokPrivacyLabel")}
          </Label>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                "SELF_ONLY",
                "MUTUAL_FOLLOW_FRIENDS",
                "FOLLOWER_OF_CREATOR",
                "PUBLIC_TO_EVERYONE",
              ] as const
            ).map((opt) => {
              const supported = privacyOptions.includes(opt);
              const forcedSelfOnly = !auditApproved && opt !== "SELF_ONLY";
              const disabled = !supported || forcedSelfOnly;
              const active = tiktokPrivacyLevel === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={disabled}
                  onClick={() => setTiktokPrivacyLevel(opt)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? "border-rose-400/60 bg-rose-500/10 text-rose-200"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-foreground/30",
                    disabled && "cursor-not-allowed opacity-40"
                  )}
                >
                  {t(`publishTiktokPrivacy_${opt}` as const)}
                </button>
              );
            })}
          </div>
          {!auditApproved && (
            <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
              <p className="text-[10px] leading-snug text-amber-200">
                {t("publishTiktokSandboxHint")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
