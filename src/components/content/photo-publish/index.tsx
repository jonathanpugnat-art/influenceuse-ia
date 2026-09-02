"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  usePhotoPublishFlow,
  type PublishStudioKind,
} from "@/hooks/photo-studio";
import { PhotoPublishCaptionSection } from "./photo-publish-caption-section";
import { PhotoPublishHashtagsSection } from "./photo-publish-hashtags-section";
import { PhotoPublishPlatformSection } from "./photo-publish-platform-section";
import { PhotoPublishScheduleSection } from "./photo-publish-schedule-section";
import { PhotoPublishSocialSection } from "./photo-publish-social-section";
import { PhotoPublishActionsSection } from "./photo-publish-actions-section";

export function PhotoPublish({
  mobileSheet = false,
  contentKind = "PHOTO",
}: {
  mobileSheet?: boolean;
  contentKind?: PublishStudioKind;
}) {
  const t = useTranslations("content");
  const flow = usePhotoPublishFlow(contentKind);

  return (
    <motion.div
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={cn(
        "h-full overflow-y-auto bg-card/30 p-4 scrollbar-thin",
        mobileSheet ? "" : "border-l border-border/50"
      )}
    >
      {mobileSheet && (
        <div
          className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/40"
          aria-hidden
        />
      )}
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t("publishPanelTitle")}
      </h2>
      <p className="mb-4 text-[11px] leading-snug text-muted-foreground/70">
        {t("publishPanelStudioHint")}
      </p>

      <div className="space-y-5">
        <PhotoPublishCaptionSection flow={flow} />
        <PhotoPublishHashtagsSection flow={flow} />
        <PhotoPublishPlatformSection flow={flow} />
        <PhotoPublishSocialSection flow={flow} />
        <PhotoPublishScheduleSection flow={flow} />
        <PhotoPublishActionsSection flow={flow} />
      </div>
    </motion.div>
  );
}
