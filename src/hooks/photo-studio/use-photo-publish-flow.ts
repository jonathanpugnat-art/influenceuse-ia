"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
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

export function usePhotoPublishFlow() {
  const t = useTranslations("content");
  const {
    params,
    contentId,
    caption,
    hashtags,
    platforms,
    scheduledAt,
    setCaption,
    setHashtags,
    setPlatforms,
    setScheduledAt,
  } = usePhotoCreator();

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
    (i) => i.id === params.influencerId
  );

  const readinessQuery = trpc.publish.checkPublishReadiness.useQuery(
    {
      influencerId: params.influencerId ?? "",
      platforms: platforms as ("INSTAGRAM" | "TIKTOK" | "ONLYFANS")[],
    },
    {
      enabled: Boolean(params.influencerId) && platforms.length > 0,
      staleTime: 30_000,
    }
  );
  const instagramSelected = platforms.includes("INSTAGRAM");
  const instagramCheck = readinessQuery.data?.checks.find(
    (c) => c.platform === "INSTAGRAM"
  );

  const slotsQuery = trpc.analytics.suggestSlots.useQuery(
    {
      influencerId: params.influencerId,
      count: 1,
    },
    {
      enabled:
        scheduleMode === "schedule" &&
        Boolean(params.influencerId) &&
        instagramSelected,
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

  const publishReminders = useMemo(() => {
    const items: string[] = [];
    if (!contentId) items.push(t("publishReminderNeedMedia"));
    if (platforms.length === 0) items.push(t("publishReminderNeedPlatform"));
    if (instagramSelected && instagramCheck && !instagramCheck.ok) {
      items.push(instagramCheck.reason ?? t("publishConnectInstagram"));
    }
    if (instagramSelected && !caption.trim()) {
      items.push(t("publishReminderCaption"));
    }
    return items;
  }, [
    contentId,
    platforms.length,
    instagramSelected,
    instagramCheck,
    caption,
    t,
  ]);

  const photoContentDescription = useCallback(
    () =>
      buildPhotoContentDescription(
        {
          scene: params.scene,
          sceneDescription: params.sceneDescription,
          pose: params.pose,
          outfit: params.outfit,
          expression: params.expression,
          photoStyle: params.photoStyle,
          timeOfDay: params.timeOfDay,
          location: params.location,
          customPrompt: params.customPrompt,
          contentMode: params.contentMode,
          nsfwLevel: params.nsfwLevel,
        },
        language
      ),
    [params, language]
  );

  useEffect(() => {
    if (params.contentMode !== "NSFW") return;
    setCaptionPlatform("ONLYFANS");
    setPlatforms(
      platforms.includes("ONLYFANS") ? platforms : ["ONLYFANS"]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when entering Premium lane
  }, [params.contentMode]);

  const captionDescriptionWithTone = useCallback(
    () => `${photoContentDescription()}\n\nTone: ${captionToneHint(captionTone)}`,
    [photoContentDescription, captionTone]
  );

  const handleGenCaption = useCallback(async () => {
    if (!params.influencerId) return;
    setIsGenCaption(true);
    try {
      const result = await captionMutation.mutateAsync({
        influencerId: params.influencerId,
        contentDescription: captionDescriptionWithTone(),
        platform: captionPlatform as "INSTAGRAM",
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
    params.influencerId,
    captionPlatform,
    language,
    captionMutation,
    setCaption,
    captionDescriptionWithTone,
    t,
  ]);

  const handleGenVariants = useCallback(async () => {
    if (!params.influencerId) return;
    setIsGenVariants(true);
    setVariants(null);
    try {
      const result = await variantsMutation.mutateAsync({
        influencerId: params.influencerId,
        contentDescription: captionDescriptionWithTone(),
        platform: captionPlatform as "INSTAGRAM",
        language,
      });
      setVariants(result.variants);
    } catch {
      toast.error(t("publishToastVariantsError"));
    } finally {
      setIsGenVariants(false);
    }
  }, [
    params.influencerId,
    captionPlatform,
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
        platform: captionPlatform as "INSTAGRAM",
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
    captionPlatform,
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

      const igPlatforms = platformList.filter((p) => p === "INSTAGRAM");
      if (igPlatforms.length > 0) {
        if (instagramCheck && !instagramCheck.ok) {
          toast.error(instagramCheck.reason ?? t("publishToastIgNotReady"));
          return;
        }
        const { results } = await publishNowMutation.mutateAsync({
          contentId,
          platforms: igPlatforms,
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
    params,
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
    instagramCheck,
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
