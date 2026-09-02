"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Settings2, Loader2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PhotoPreview } from "@/components/content/photo-preview";
import { PhotoPublish } from "@/components/content/photo-publish";
import { PhotoWelcomeBanner } from "@/components/content/photo-welcome-banner";
import { PhotoPromptStudio } from "@/components/content/photo-prompt-studio";
import { PhotoFeedGridStrip } from "@/components/content/photo-feed-grid-strip";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { useAutoSelectSoleInfluencer } from "@/hooks/use-auto-select-sole-influencer";
import { consumeWizardWelcomePhotoSeed } from "@/lib/wizard-photo-seed";
import { trpc } from "@/lib/trpc";
import { useInfluencers } from "@/hooks/use-influencers";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function PhotoCreatorPage() {
  const t = useTranslations("content");
  const searchParams = useSearchParams();
  const { generatedUrls, isGenerating, params, updateParams, applySeed, applyViralBrief, requestGenerate } =
    usePhotoCreator();
  const showPublish = generatedUrls.length > 0 && !isGenerating;
  const influencerIdFromUrl = searchParams.get("influencer");
  const trendItemIdFromUrl = searchParams.get("trendItemId");
  const recommendationIdFromUrl = searchParams.get("recommendationId");
  const autoGenerate = searchParams.get("autoGenerate") === "1";
  const hasTrendDeepLink = Boolean(trendItemIdFromUrl || recommendationIdFromUrl);
  const [mobileConfigOpen, setMobileConfigOpen] = useState(
    () =>
      searchParams.get("welcome") === "1" ||
      Boolean(searchParams.get("trendItemId") || searchParams.get("recommendationId"))
  );
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const seededRef = useRef(false);
  const trendSeededRef = useRef(false);
  const autoGenerateFiredRef = useRef(false);

  const isWelcomeFlow =
    searchParams.get("welcome") === "1" && !welcomeDismissed;

  const { data: influencersData } = useInfluencers({ limit: 50 }, { placeholderData: (prev) => prev });
  const influencers = influencersData?.influencers ?? [];
  const welcomeInfluencer = influencerIdFromUrl
    ? influencers.find((i) => i.id === influencerIdFromUrl)
    : undefined;

  const identityPackStatusQuery = trpc.influencer.getIdentityPackStatus.useQuery(
    { influencerId: influencerIdFromUrl! },
    {
      enabled:
        Boolean(influencerIdFromUrl) &&
        Boolean(welcomeInfluencer) &&
        !welcomeInfluencer?.isNsfw,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === "ready" || status === "failed") return false;
        return 5000;
      },
    }
  );

  const identityPackStatus = identityPackStatusQuery.data?.status;
  const showIdentityPackBanner =
    identityPackStatus === "generating" || identityPackStatus === "pending";
  const prevIdentityPackStatusRef = useRef<string | null>(null);

  const trendSeedQuery = trpc.trends.getPhotoSeed.useQuery(
    {
      influencerId: influencerIdFromUrl!,
      trendItemId: trendItemIdFromUrl ?? undefined,
      recommendationId: recommendationIdFromUrl ?? undefined,
    },
    {
      enabled:
        Boolean(influencerIdFromUrl) && hasTrendDeepLink,
    }
  );

  useEffect(() => {
    const current = identityPackStatus;
    const prev = prevIdentityPackStatusRef.current;
    if (
      (prev === "generating" || prev === "pending") &&
      current === "ready"
    ) {
      toast.success(t("identityPackReadyToast"));
    }
    if (current) {
      prevIdentityPackStatusRef.current = current;
    }
  }, [identityPackStatus, t]);

  useAutoSelectSoleInfluencer(
    params.influencerId,
    influencerIdFromUrl,
    updateParams
  );

  useEffect(() => {
    if (!isWelcomeFlow || !welcomeInfluencer || seededRef.current) return;
    seededRef.current = true;
    updateParams({ influencerId: welcomeInfluencer.id });

    const wizardSeed = consumeWizardWelcomePhotoSeed();
    if (wizardSeed) {
      applySeed({ ...wizardSeed, influencerId: welcomeInfluencer.id });
    }
  }, [applySeed, isWelcomeFlow, updateParams, welcomeInfluencer]);

  useEffect(() => {
    const infId = influencerIdFromUrl;
    if (!infId || trendSeededRef.current) return;
    if (!trendItemIdFromUrl && !recommendationIdFromUrl) return;
    if (!trendSeedQuery.data?.brief) return;
    trendSeededRef.current = true;
    applyViralBrief(trendSeedQuery.data.brief, infId);
  }, [
    applyViralBrief,
    influencerIdFromUrl,
    recommendationIdFromUrl,
    trendItemIdFromUrl,
    trendSeedQuery.data?.brief,
  ]);

  // Trends 1-click: seed is in store (and/or hydrated via getPhotoSeed) → generate.
  useEffect(() => {
    if (!autoGenerate || autoGenerateFiredRef.current || isGenerating) return;
    if (!params.influencerId) return;
    const hasTrendIds = Boolean(
      params.recommendationId || params.trendItemId || recommendationIdFromUrl
    );
    const hasSceneOutfit =
      Boolean(params.outfit?.trim()) &&
      Boolean(params.sceneDescription?.trim());
    if (!hasTrendIds && !hasSceneOutfit) return;
    // Wait for seed from applySeed or getPhotoSeed when coming from trends.
    if (hasTrendIds && !hasSceneOutfit) {
      // Store may already be seeded by trends page before navigation.
      if (!params.recommendationId && !params.trendItemId) return;
    }
    autoGenerateFiredRef.current = true;
    requestGenerate();
  }, [
    autoGenerate,
    isGenerating,
    params.influencerId,
    params.outfit,
    params.recommendationId,
    params.sceneDescription,
    params.trendItemId,
    recommendationIdFromUrl,
    requestGenerate,
  ]);

  const portraitUrl =
    welcomeInfluencer?.baseImageUrl?.trim() ||
    welcomeInfluencer?.avatarUrl?.trim() ||
    null;

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-4rem)] flex-col md:-mx-6 lg:-mx-8">
      {isWelcomeFlow && welcomeInfluencer && (
        <PhotoWelcomeBanner
          influencerName={welcomeInfluencer.name}
          portraitUrl={portraitUrl}
          isPremium={welcomeInfluencer.isNsfw}
          onDismiss={() => setWelcomeDismissed(true)}
        />
      )}

      {showIdentityPackBanner && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span>{t("identityPackGeneratingBanner")}</span>
        </div>
      )}

      {/* Mobile config drawer */}
      <div className="border-b border-border/50 lg:hidden">
        <Collapsible open={mobileConfigOpen} onOpenChange={setMobileConfigOpen}>
          <CollapsibleTrigger
            className={cn(
              "flex min-h-11 w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground/90",
              mobileConfigOpen && "bg-accent/40"
            )}
          >
            <span className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t("promptStudioMobileConfig")}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="h-[min(55vh,100dvh)] border-t border-border/50">
              <PhotoPromptStudio identityPackPending={showIdentityPackBanner} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left — 40% config */}
        <div className="hidden h-full w-full max-w-[400px] shrink-0 lg:flex lg:w-[38%] lg:max-w-[420px]">
          <PhotoPromptStudio identityPackPending={showIdentityPackBanner} />
        </div>

        {/* Right — 60% canvas + publish */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
            <div className="flex min-h-0 flex-1 flex-col bg-background/60">
              <PhotoPreview layout="studio" isWelcomeFlow={isWelcomeFlow} />
            </div>

            <AnimatePresence>
              {showPublish && (
                <motion.aside
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 360, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: "spring", bounce: 0.08, duration: 0.35 }}
                  className="hidden shrink-0 overflow-hidden xl:block"
                >
                  <PhotoPublish />
                </motion.aside>
              )}
            </AnimatePresence>
          </div>

          <PhotoFeedGridStrip influencerId={params.influencerId} />
        </div>
      </div>

      {/* Mobile publish sheet */}
      <AnimatePresence>
        {showPublish && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", bounce: 0.15 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[min(88vh,100dvh)] overflow-y-auto rounded-t-2xl border-t border-border/60 bg-popover shadow-2xl lg:hidden"
          >
            <PhotoPublish mobileSheet />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
