"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { buildWizardCreateInput } from "@/lib/wizard-create-payload";
import { nicheShotToPhotoSeed } from "@/lib/niche-shot-ideas";
import { stashWizardWelcomePhotoSeed } from "@/lib/wizard-photo-seed";
import { trpc } from "@/lib/trpc";
import { useUpgradeOnLimitError } from "@/hooks/use-upgrade-on-limit-error";
import { toast } from "sonner";

export function useWizardCreateFlow() {
  const router = useRouter();
  const t = useTranslations("wizard");
  const handleUpgrade = useUpgradeOnLimitError();

  const {
    data,
    generatedImages,
    selectedImageIndex,
    reset,
    createdInfluencerId,
    setCreatedInfluencerId,
  } = useInfluencerWizard();

  const [identityPackWait, setIdentityPackWait] = useState<{
    id: string;
    name: string;
    portraitUrl: string | null;
  } | null>(null);

  const selectedImageUrl =
    data.baseImageUrl || (generatedImages[selectedImageIndex] ?? null);

  const shouldWaitForIdentityPack = useCallback(
    (isNsfw: boolean, baseImageUrl: string | null | undefined) =>
      Boolean(baseImageUrl?.trim()) && !isNsfw,
    []
  );

  const finishWizardAndRedirect = useCallback(
    (influencerId: string, name: string, isNsfw: boolean) => {
      if (data.pendingNicheShot) {
        stashWizardWelcomePhotoSeed(
          nicheShotToPhotoSeed(data.pendingNicheShot, influencerId, { isNsfw })
        );
      }
      toast.success(t("firstPhotoCta", { name }));
      reset();
      router.push(`/content/photo?influencer=${influencerId}&welcome=1`);
    },
    [data.pendingNicheShot, reset, router, t]
  );

  const beginPostCreateFlow = useCallback(
    (inf: { id: string; name: string; isNsfw: boolean }) => {
      setCreatedInfluencerId(inf.id);
      if (shouldWaitForIdentityPack(inf.isNsfw, selectedImageUrl)) {
        toast.info(t("identityPackStarted"));
        setIdentityPackWait({
          id: inf.id,
          name: inf.name,
          portraitUrl: selectedImageUrl,
        });
        return;
      }
      finishWizardAndRedirect(inf.id, inf.name, inf.isNsfw);
    },
    [
      finishWizardAndRedirect,
      selectedImageUrl,
      setCreatedInfluencerId,
      shouldWaitForIdentityPack,
      t,
    ]
  );

  const createMutation = trpc.influencer.create.useMutation({
    onSuccess: (inf) => {
      beginPostCreateFlow(inf);
    },
    onError: (err) => {
      if (handleUpgrade(err.message)) return;
      toast.error(err.message);
    },
  });

  const updateMutation = trpc.influencer.update.useMutation({
    onSuccess: (inf) => {
      beginPostCreateFlow(inf);
    },
    onError: (err) => {
      if (handleUpgrade(err.message)) return;
      toast.error(err.message);
    },
  });

  const handleCreate = () => {
    const payload = buildWizardCreateInput(data, selectedImageUrl || undefined);

    if (createdInfluencerId) {
      updateMutation.mutate({
        id: createdInfluencerId,
        name: payload.name,
        gender: payload.gender,
        bio: payload.bio,
        personality: payload.personality,
        brief: payload.brief ?? null,
        nicheProfile: payload.nicheProfile,
        niche: payload.niche,
        age: payload.age,
        style: payload.style,
        isNsfw: payload.isNsfw,
        baseImageUrl: payload.baseImageUrl ?? null,
        avatarUrl: payload.avatarUrl ?? null,
        appearanceVariations: payload.appearanceVariations,
        appearanceFingerprint: payload.appearanceFingerprint,
        socialAccounts: payload.socialAccounts,
      });
      return;
    }

    createMutation.mutate(payload);
  };

  const isCreating = createMutation.isPending || updateMutation.isPending;

  return {
    data,
    generatedImages,
    selectedImageIndex,
    selectedImageUrl,
    identityPackWait,
    finishWizardAndRedirect,
    handleCreate,
    isCreating,
  };
}

export type WizardCreateFlowState = ReturnType<typeof useWizardCreateFlow>;
