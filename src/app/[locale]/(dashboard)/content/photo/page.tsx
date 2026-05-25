"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PhotoParams } from "@/components/content/photo-params";
import { PhotoPreview } from "@/components/content/photo-preview";
import { PhotoPublish } from "@/components/content/photo-publish";
import { PhotoWelcomeBanner } from "@/components/content/photo-welcome-banner";
import { StudioProStrip } from "@/components/content/studio-pro-strip";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import {
  getNichePhotoDefaults,
  type InfluencerGender,
} from "@/lib/photo-niche-defaults";
import { trpc } from "@/lib/trpc";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export default function PhotoCreatorPage() {
  const t = useTranslations("content");
  const searchParams = useSearchParams();
  const { generatedUrls, isGenerating, params, updateParams } =
    usePhotoCreator();
  const showPublish = generatedUrls.length > 0 && !isGenerating;
  const [paramsOpen, setParamsOpen] = useState(false);
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
    const defaults = getNichePhotoDefaults(welcomeInfluencer.niche, gender);
    updateParams({
      influencerId: welcomeInfluencer.id,
      ...defaults,
    });
    setParamsOpen(true);
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

      <StudioProStrip variant="photo" />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="hidden w-[320px] shrink-0 md:block">
          <PhotoParams />
        </div>

        <div className="border-b border-slate-800/50 md:hidden">
          <Collapsible open={paramsOpen} onOpenChange={setParamsOpen}>
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800/30 hover:text-white",
                paramsOpen && "bg-slate-800/30"
              )}
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                {t("params")}
              </span>
              {paramsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="max-h-[60vh] overflow-y-auto border-t border-slate-800/50 bg-slate-900/30 px-4 py-3">
                <PhotoParams />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden bg-slate-950 pb-4 lg:pb-0">
          <PhotoPreview isWelcomeFlow={isWelcomeFlow} />
        </div>

        <AnimatePresence>
          {showPublish && (
            <>
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 350, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring" as const, bounce: 0.1, duration: 0.4 }}
                className="hidden shrink-0 overflow-hidden lg:block"
              >
                <PhotoPublish />
              </motion.div>
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", bounce: 0.2 }}
                className="fixed bottom-0 left-0 right-0 z-40 max-h-[min(85vh,100dvh)] overflow-y-auto border-t border-slate-800/50 bg-slate-900 pb-[env(safe-area-inset-bottom)] shadow-lg lg:hidden"
              >
                <PhotoPublish mobileSheet />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
