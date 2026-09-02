"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PhotoPublishFlowState } from "@/hooks/photo-studio";
import { PublishConfirmDialog } from "@/components/publish/publish-confirm-dialog";

export function PhotoPublishActionsSection({
  flow,
}: {
  flow: PhotoPublishFlowState;
}) {
  const t = useTranslations("content");
  const tConfirm = useTranslations("publish.confirm");
  const tCommon = useTranslations("common");
  const {
    contentId,
    platforms,
    scheduleMode,
    caption,
    hashtags,
    selectedInf,
    contentKind,
    previewUrl,
    handleSave,
    handleOFBundle,
    updateMutation,
    bundleMutation,
    publishNowMutation,
    scheduleMutation,
  } = flow;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const runPublish = async () => {
    setIsConfirming(true);
    try {
      await handleSave(true);
      setConfirmOpen(false);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-2 pt-2">
      <button
        type="button"
        onClick={() => handleSave(false)}
        disabled={!contentId || updateMutation.isPending}
        className="min-h-10 w-full rounded-full border border-border py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:opacity-40"
      >
        {t("publishSaveDraft")}
      </button>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={
          !contentId || updateMutation.isPending || platforms.length === 0
        }
        className="min-h-10 w-full rounded-full bg-foreground py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
      >
        {scheduleMode === "schedule"
          ? t("publishScheduleCta")
          : t("publishNowCta")}
      </button>
      {platforms.includes("ONLYFANS") && (
        <button
          type="button"
          onClick={handleOFBundle}
          disabled={!contentId || bundleMutation.isPending}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:opacity-40"
        >
          <Package className="h-4 w-4" />
          {bundleMutation.isPending
            ? t("publishOfPreparing")
            : t("publishOfDownload")}
        </button>
      )}

      {paramsSafeInfluencerId(flow) ? (
        <PublishConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          influencerId={paramsSafeInfluencerId(flow)!}
          platforms={
            platforms as ("INSTAGRAM" | "TIKTOK" | "ONLYFANS")[]
          }
          preview={{
            mediaUrl: previewUrl,
            isVideo: contentKind === "REEL",
            caption,
            hashtags,
            contentType:
              contentKind === "REEL" ? tCommon("reel") : tCommon("photo"),
            influencerName: selectedInf?.name,
          }}
          confirmLabel={
            scheduleMode === "schedule"
              ? tConfirm("confirmSchedule")
              : tConfirm("confirm")
          }
          isConfirming={
            isConfirming ||
            updateMutation.isPending ||
            publishNowMutation.isPending ||
            scheduleMutation.isPending
          }
          onConfirm={() => void runPublish()}
        />
      ) : null}
    </div>
  );
}

function paramsSafeInfluencerId(flow: PhotoPublishFlowState): string | null {
  return flow.params.influencerId ?? null;
}
