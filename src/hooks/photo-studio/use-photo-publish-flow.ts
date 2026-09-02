"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { useReelCreator } from "@/hooks/use-reel-creator";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { buildPhotoContentDescription } from "@/lib/photo-content-context";
import {
  captionToneHint,
  type CaptionToneId,
} from "@/lib/caption-tones";
import { trpc } from "@/lib/trpc";
import { useInfluencers } from "@/hooks/use-influencers";
import { toast } from "sonner";
import {
  mergeScheduleDateTime,
  toDateInputValue,
  toTimeInputValue,
} from "@/components/content/photo-publish/photo-publish-utils";
import {
  autoPublishablePlatforms,
  defaultPlatformsForContent,
  platformsAllowedForContent,
  type PublishPlatform,
} from "@/lib/publish-platforms";

export type PublishStudioKind = "PHOTO" | "REEL";

export function usePhotoPublishFlow(contentKind: PublishStudioKind = "PHOTO") {
  const t = useTranslations("content");
  const photo = usePhotoCreator();
  const reel = useReelCreator();
  const isReel = contentKind === "REEL";
  const planQuery = useCurrentPlan();
  const canSchedule = planQuery.data?.features.hasAutoPublish ?? false;

  const influencerId = isReel
    ? reel.params.influencerId
    : photo.params.influencerId;
  const contentId = isReel ? reel.contentId : photo.contentId;
  const caption = isReel ? reel.caption : photo.caption;
  const hashtags = isReel ? reel.hashtags : photo.hashtags;
  const platforms = isReel ? reel.platforms : photo.platforms;
  const scheduledAt = isReel ? reel.scheduledAt : photo.scheduledAt;
  const setCaption = isReel ? reel.setCaption : photo.setCaption;
  const setHashtags = isReel ? reel.setHashtags : photo.setHashtags;
  const setPlatforms = isReel ? reel.setPlatforms : photo.setPlatforms;
  const setScheduledAt = isReel ? reel.setScheduledAt : photo.setScheduledAt;
  const contentMode = isReel
    ? reel.params.contentMode
    : photo.params.contentMode;
  const previewUrl = isReel
    ? (reel.thumbnailUrl ?? reel.videoUrl)
    : (photo.generatedUrls[photo.selectedImageIndex] ??
      photo.generatedUrls[0] ??
      null);

  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [captionPlatform, setCaptionPlatform] = useState("INSTAGRAM");
  const [hashtagInput, setHashtagInput] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("19:00");
  const [isGenCaption, setIsGenCaption] = useState(false);
  const [isGenHashtags, setIsGenHashtags] = useState(false);
  const [variants, setVariants] = useState<string[] | null>(null);
  const [isGenVariants, setIsGenVariants] = useState(false);
  const [captionTone, setCaptionTone] = useState<CaptionToneId>("casual");

  const captionMutation = trpc.content.generateCaption.useMutation();
  const variantsMutation = trpc.content.generateCaptionVariants.useMutation();
  const hashtagMutation = trpc.content.generateHashtags.useMutation();
  const updateMutation = trpc.content.updateContent.useMutation();
  const publishNowMutation = trpc.publish.publishNow.useMutation();
  const scheduleMutation = trpc.publish.scheduleContent.useMutation();
  const bundleMutation = trpc.content.prepareOnlyFansBundle.useMutation();

  const influencersQuery = useInfluencers();
  const selectedInf = influencersQuery.data?.influencers?.find(
    (i) => i.id === influencerId
  );

  const readinessQuery = trpc.publish.checkPublishReadiness.useQuery(
    {
      influencerId: influencerId ?? "",
      platforms: platforms as ("INSTAGRAM" | "TIKTOK" | "ONLYFANS")[],
    },
    {
      enabled: Boolean(influencerId) && platforms.length > 0,
      staleTime: 30_000,
    }
  );
  const instagramSelected = platforms.includes("INSTAGRAM");
  const tiktokSelected = platforms.includes("TIKTOK");
  const instagramCheck = readinessQuery.data?.checks.find(
    (c) => c.platform === "INSTAGRAM"
  );
  const tiktokCheck = readinessQuery.data?.checks.find(
    (c) => c.platform === "TIKTOK"
  );

  const slotsQuery = trpc.analytics.suggestSlots.useQuery(
    {
      influencerId,
      count: 1,
    },
    {
      enabled:
        scheduleMode === "schedule" &&
        Boolean(influencerId) &&
        (instagramSelected || tiktokSelected),
      staleTime: 60_000,
    }
  );

  useEffect(() => {
    if (scheduleMode !== "schedule") return;
    const slot = slotsQuery.data?.[0];
    if (!slot) return;
    const at = new Date(slot.at);
    setScheduleDate(toDateInputValue(at));
    setScheduleTime(toTimeInputValue(at));
    setScheduledAt(at);
  }, [scheduleMode, slotsQuery.data, setScheduledAt]);

  useEffect(() => {
    if (scheduleMode !== "schedule") return;
    const merged = mergeScheduleDateTime(scheduleDate, scheduleTime);
    if (merged) setScheduledAt(merged);
  }, [scheduleDate, scheduleTime, scheduleMode, setScheduledAt]);

  useEffect(() => {
    if (!canSchedule && scheduleMode === "schedule") {
      setScheduleMode("now");
    }
  }, [canSchedule, scheduleMode]);

  const publishReminders = useMemo(() => {
    const items: string[] = [];
    if (!contentId) items.push(t("publishReminderNeedMedia"));
    if (platforms.length === 0) items.push(t("publishReminderNeedPlatform"));
    if (instagramSelected && instagramCheck && !instagramCheck.ok) {
      items.push(instagramCheck.reason ?? t("publishConnectInstagram"));
    }
    if (tiktokSelected && tiktokCheck && !tiktokCheck.ok) {
      items.push(tiktokCheck.reason ?? t("publishConnectTiktok"));
    }
    if ((instagramSelected || tiktokSelected) && !caption.trim()) {
      items.push(t("publishReminderCaption"));
    }
    return items;
  }, [
    contentId,
    platforms.length,
    instagramSelected,
    instagramCheck,
    tiktokSelected,
    tiktokCheck,
    caption,
    t,
  ]);

  const photoContentDescription = useCallback(() => {
    if (isReel) {
      return [reel.params.sceneDescription, reel.params.script]
        .map((part) => part.trim())
        .filter(Boolean)
        .join("\n");
    }
    return buildPhotoContentDescription(
      {
        scene: photo.params.scene,
        sceneDescription: photo.params.sceneDescription,
        pose: photo.params.pose,
        outfit: photo.params.outfit,
        expression: photo.params.expression,
        photoStyle: photo.params.photoStyle,
        timeOfDay: photo.params.timeOfDay,
        location: photo.params.location,
        customPrompt: photo.params.customPrompt,
        contentMode: photo.params.contentMode,
        nsfwLevel: photo.params.nsfwLevel,
      },
      language
    );
  }, [isReel, language, photo.params, reel.params]);

  useEffect(() => {
    if (contentMode === "NSFW") {
      setCaptionPlatform("ONLYFANS");
      setPlatforms(
        platforms.includes("ONLYFANS") ? platforms : ["ONLYFANS"]
      );
      return;
    }
    if (platforms.length === 0) {
      setPlatforms([...defaultPlatformsForContent(contentKind)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed defaults / Premium lane once
  }, [contentMode, contentKind]);

  const captionDescriptionWithTone = useCallback(
    () => `${photoContentDescription()}\n\nTone: ${captionToneHint(captionTone)}`,
    [photoContentDescription, captionTone]
  );

  const captionPlatformTyped = captionPlatform as PublishPlatform;

  const handleGenCaption = useCallback(async () => {
    if (!influencerId) return;
    setIsGenCaption(true);
    try {
      const result = await captionMutation.mutateAsync({
        influencerId,
        contentDescription: captionDescriptionWithTone(),
        platform: captionPlatformTyped,
        language,
      });
      setCaption("");
      const chars = result.caption.split("");
      for (let i = 0; i < chars.length; i++) {
        await new Promise((r) => setTimeout(r, 15));
        setCaption(result.caption.slice(0, i + 1));
      }
    } catch {
      toast.error(t("publishToastCaptionError"));
    } finally {
      setIsGenCaption(false);
    }
  }, [
    influencerId,
    captionPlatformTyped,
    language,
    captionMutation,
    setCaption,
    captionDescriptionWithTone,
    t,
  ]);

  const handleGenVariants = useCallback(async () => {
    if (!influencerId) return;
    setIsGenVariants(true);
    setVariants(null);
    try {
      const result = await variantsMutation.mutateAsync({
        influencerId,
        contentDescription: captionDescriptionWithTone(),
        platform: captionPlatformTyped,
        language,
      });
      setVariants(result.variants);
    } catch {
      toast.error(t("publishToastVariantsError"));
    } finally {
      setIsGenVariants(false);
    }
  }, [
    influencerId,
    captionPlatformTyped,
    language,
    variantsMutation,
    captionDescriptionWithTone,
    t,
  ]);

  const pickVariant = (text: string) => {
    setCaption(text);
    setVariants(null);
  };

  const handleGenHashtags = useCallback(async () => {
    if (!selectedInf) return;
    setIsGenHashtags(true);
    try {
      const result = await hashtagMutation.mutateAsync({
        niche: selectedInf.niche,
        platform: captionPlatformTyped,
        description: photoContentDescription(),
        count: 15,
      });
      setHashtags(result.hashtags.map((h) => h.replace(/^#/, "")));
    } catch {
      toast.error(t("publishToastHashtagsError"));
    } finally {
      setIsGenHashtags(false);
    }
  }, [
    selectedInf,
    captionPlatformTyped,
    hashtagMutation,
    setHashtags,
    photoContentDescription,
    t,
  ]);

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
      setHashtagInput("");
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter((h) => h !== tag));
  };

  const togglePlatform = (p: string) => {
    if (
      p === "TIKTOK" &&
      !platformsAllowedForContent(contentKind).includes("TIKTOK")
    ) {
      toast.info(t("publishTiktokReelsOnly"));
      return;
    }
    setPlatforms(
      platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p]
    );
  };

  const handleSave = async (publish: boolean) => {
    if (!contentId) return;
    const platformList =
      platforms.length > 0
        ? (platforms as ("INSTAGRAM" | "TIKTOK" | "ONLYFANS")[])
        : [];

    try {
      await updateMutation.mutateAsync({
        contentId,
        caption: caption || undefined,
        hashtags: hashtags.length > 0 ? hashtags : undefined,
        platforms: platformList.length > 0 ? platformList : undefined,
        status: publish ? "READY" : "DRAFT",
        scheduledAt: null,
      });

      if (!publish) {
        toast.success(t("publishToastDraftSaved"));
        return;
      }

      if (scheduleMode === "schedule" && scheduledAt) {
        if (!canSchedule) {
          toast.error(t("publishSchedulePlanLocked"));
          return;
        }
        if (platformList.length === 0) {
          toast.error(t("publishToastNeedPlatform"));
          return;
        }
        await scheduleMutation.mutateAsync({
          contentId,
          platforms: platformList,
          scheduledAt: scheduledAt.toISOString(),
        });
        toast.success(t("publishToastScheduled"));
        return;
      }

      const autoPlatforms = autoPublishablePlatforms(platformList, contentKind);
      if (autoPlatforms.length > 0) {
        if (instagramSelected && instagramCheck && !instagramCheck.ok) {
          toast.error(instagramCheck.reason ?? t("publishToastIgNotReady"));
          return;
        }
        if (tiktokSelected && tiktokCheck && !tiktokCheck.ok) {
          toast.error(tiktokCheck.reason ?? t("publishToastTiktokNotReady"));
          return;
        }
        const { results } = await publishNowMutation.mutateAsync({
          contentId,
          platforms: autoPlatforms,
        });
        const failed = results.filter((r) => r.status === "FAILED");
        if (failed.length > 0) {
          toast.error(failed[0]?.error ?? t("publishToastIgFailed"));
          return;
        }
        toast.success(t("publishToastPublished"));
        return;
      }

      await updateMutation.mutateAsync({ contentId, status: "PUBLISHED" });
      toast.success(t("publishToastSavedManual"));
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("publishToastSaveError");
      toast.error(msg);
    }
  };

  const handleOFBundle = async () => {
    if (!contentId) return;
    try {
      const result = await bundleMutation.mutateAsync({ contentId });
      window.open(result.downloadUrl, "_blank");
      toast.success(t("publishToastOfReady"));
    } catch {
      toast.error(t("publishToastOfError"));
    }
  };

  return {
    contentKind,
    params: { influencerId, contentMode },
    contentId,
    caption,
    setCaption,
    hashtags,
    platforms,
    language,
    setLanguage,
    captionPlatform,
    setCaptionPlatform,
    hashtagInput,
    setHashtagInput,
    scheduleMode,
    setScheduleMode,
    scheduleDate,
    setScheduleDate,
    scheduleTime,
    setScheduleTime,
    captionTone,
    setCaptionTone,
    variants,
    isGenCaption,
    isGenHashtags,
    isGenVariants,
    selectedInf,
    instagramSelected,
    tiktokSelected,
    instagramCheck,
    tiktokCheck,
    canSchedule,
    previewUrl,
    publishReminders,
    slotsQuery,
    handleGenCaption,
    handleGenVariants,
    pickVariant,
    handleGenHashtags,
    addHashtag,
    removeHashtag,
    togglePlatform,
    handleSave,
    handleOFBundle,
    updateMutation,
    bundleMutation,
    publishNowMutation,
    scheduleMutation,
  };
}

export type PhotoPublishFlowState = ReturnType<typeof usePhotoPublishFlow>;
