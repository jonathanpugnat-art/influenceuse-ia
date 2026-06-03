"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Settings2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PhotoPreview } from "@/components/content/photo-preview";
import { PhotoPublish } from "@/components/content/photo-publish";
import { PhotoWelcomeBanner } from "@/components/content/photo-welcome-banner";
import { PhotoStudioAgentPanel } from "@/components/content/photo-studio-agent-panel";
import { PhotoFeedGridStrip } from "@/components/content/photo-feed-grid-strip";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { applyStudioLook } from "@/lib/photo-studio-looks";
import { type InfluencerGender } from "@/lib/photo-niche-defaults";
import { trpc } from "@/lib/trpc";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export default function PhotoCreatorPage() {
  const t = useTranslations("content");
  const searchParams = useSearchParams();
  const { generatedUrls, isGenerating, params, updateParams } =
    usePhotoCreator();
  const showPublish = generatedUrls.length > 0 && !isGenerating;
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const seededRef = useRef(false);

  const influencerIdFromUrl = searchParams.get("influencer");
  const isWelcomeFlow =
    searchParams.get("welcome") === "1" && !welcomeDismissed;

  const { data: influencersData } = trpc.influencer.getAll.useQuery(
    { limit: 50 },
    { placeholderData: (prev) => prev }
  );
  const influencers = influencersData?.influencers ?? [];
  const welcomeInfluencer = influencerIdFromUrl
    ? influencers.find((i) => i.id === influencerIdFromUrl)
    : undefined;

  useEffect(() => {
    const id = influencerIdFromUrl;
    if (id && id !== params.influencerId) {
      updateParams({ influencerId: id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [influencerIdFromUrl]);

  useEffect(() => {
    if (!isWelcomeFlow || !welcomeInfluencer || seededRef.current) return;
    seededRef.current = true;
    const gender =
      (welcomeInfluencer.gender as InfluencerGender | undefined) ?? "female";
    updateParams({
      influencerId: welcomeInfluencer.id,
      sceneFirst: false,
      ...applyStudioLook("cafe-aesthetic", gender),
    });
    setMobileConfigOpen(true);
  }, [isWelcomeFlow, welcomeInfluencer, updateParams]);

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
          onDismiss={() => setWelcomeDismissed(true)}
        />
      )}

      {/* Mobile config drawer */}
      <div className="border-b border-slate-800/50 lg:hidden">
        <Collapsible open={mobileConfigOpen} onOpenChange={setMobileConfigOpen}>
          <CollapsibleTrigger
            className={cn(
              "flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300",
              mobileConfigOpen && "bg-slate-800/30"
            )}
          >
            <span className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t("studioMobileConfig")}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="max-h-[55vh] overflow-y-auto border-t border-slate-800/50">
              <PhotoStudioAgentPanel />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left — 40% config */}
        <div className="hidden w-full max-w-[400px] shrink-0 lg:flex lg:w-[38%] lg:max-w-[420px]">
          <PhotoStudioAgentPanel />
        </div>

        {/* Right — 60% canvas + publish */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
            <div className="flex min-h-0 flex-1 flex-col bg-slate-950">
              <PhotoPreview layout="studio" isWelcomeFlow={isWelcomeFlow} />
            </div>

            <AnimatePresence>
              {showPublish && (
                <motion.aside
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 360, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: "spring", bounce: 0.08, duration: 0.35 }}
                  className="hidden shrink-0 overflow-hidden border-l border-slate-800/50 xl:block"
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
            className="fixed inset-x-0 bottom-0 z-50 max-h-[min(88vh,100dvh)] overflow-y-auto border-t border-slate-800/60 bg-slate-900 shadow-2xl lg:hidden"
          >
            <PhotoPublish mobileSheet />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
