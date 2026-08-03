"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useUpgradeModal, type UpgradeReason } from "@/components/billing/upgrade-modal";
import { isBetaFreeMode } from "@/lib/payments";

const REASON_TO_PLAN: Record<UpgradeReason, "STARTER" | "PRO" | "ENTERPRISE"> = {
  max_influencers: "PRO",
  credits_exhausted: "PRO",
  video_required: "PRO",
  auto_publish_required: "STARTER",
  advanced_analytics_required: "ENTERPRISE",
  content_plan_required: "STARTER",
  batch_required: "PRO",
  webhooks_required: "PRO",
  character_lora_required: "PRO",
};

/**
 * Wraps a tRPC mutation `onError` and intercepts our tagged
 * `UPGRADE_REQUIRED:<reason>:...` server messages to open the contextual
 * upgrade modal instead of showing a raw error toast.
 *
 * Usage:
 *   const onUpgradeError = useUpgradeOnLimitError();
 *   const create = trpc.influencer.create.useMutation({
 *     onError: (e) => onUpgradeError(e.message) ?? toast.error(e.message),
 *   });
 */
export function useUpgradeOnLimitError() {
  const show = useUpgradeModal((s) => s.show);

  return useCallback(
    (message: string): true | undefined => {
      if (!message || !message.startsWith("UPGRADE_REQUIRED:")) return undefined;
      const [, rawReason] = message.split(":");
      const reason = rawReason as UpgradeReason;
      if (!REASON_TO_PLAN[reason]) return undefined;
      // During the bêta we don't open the upgrade modal — there's nothing
      // to upgrade to while Stripe is in TEST mode. We let the caller fall
      // through to its toast.error() instead, which surfaces the underlying
      // limit message ("Crédits insuffisants", etc.) in a non-clickable way.
      if (isBetaFreeMode()) return undefined;
      show(reason, REASON_TO_PLAN[reason]);
      return true;
    },
    [show]
  );
}

/**
 * Convenience wrapper for the common `onError` shape: opens the modal if the
 * error matches our upgrade-required convention, otherwise shows a toast.
 */
export function useTrpcErrorHandler() {
  const handleUpgrade = useUpgradeOnLimitError();
  return useCallback(
    (err: { message: string }) => {
      if (handleUpgrade(err.message)) return;
      toast.error(err.message);
    },
    [handleUpgrade]
  );
}
