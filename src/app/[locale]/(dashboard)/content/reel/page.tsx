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
import { ReelPromptStudio } from "@/components/content/reel-prompt-studio";
import { ReelPreview } from "@/components/content/reel-preview";
import { PhotoPublish } from "@/components/content/photo-publish";
import { useReelCreator } from "@/hooks/use-reel-creator";
import { trpc } from "@/lib/trpc";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ReelCreatorPage() {
  const t = useTranslations("content");
  const searchParams = useSearchParams();
  const {
    videoUrl,
    isGenerating,
    params,
    updateParams,
    applyReelBrief,
  } = useReelCreator();
  const showPublish = !!videoUrl && !isGenerating;
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);
  const trendSeededRef = useRef(false);

  const influencerIdFromUrl = searchParams.get("influencer");
  const trendItemIdFromUrl = searchParams.get("trendItemId");
  const recommendationIdFromUrl = searchParams.get("recommendationId");

  const trendSeedQuery = trpc.trends.getReelSeed.useQuery(
    {
      influencerId: influencerIdFromUrl!,
      trendItemId: trendItemIdFromUrl ?? undefined,
      recommendationId: recommendationIdFromUrl ?? undefined,
    },
    {
      enabled:
        Boolean(influencerIdFromUrl) &&
        Boolean(trendItemIdFromUrl || recommendationIdFromUrl) &&
        !trendSeededRef.current,
    }
  );

  useEffect(() => {
    if (influencerIdFromUrl && influencerIdFromUrl !== params.influencerId) {
      updateParams({ influencerId: influencerIdFromUrl });
    }
  }, [influencerIdFromUrl, params.influencerId, updateParams]);

  useEffect(() => {
    const infId = influencerIdFromUrl;
    if (!infId || trendSeededRef.current) return;
    if (!trendItemIdFromUrl && !recommendationIdFromUrl) return;
    if (!trendSeedQuery.data?.brief) return;
    trendSeededRef.current = true;
    applyReelBrief(trendSeedQuery.data.brief, infId);
    setMobileConfigOpen(true);
  }, [
    applyReelBrief,
    influencerIdFromUrl,
    recommendationIdFromUrl,
    trendItemIdFromUrl,
    trendSeedQuery.data?.brief,
  ]);

  useEffect(() => {
    if (trendSeedQuery.isError) {
      toast.error(trendSeedQuery.error.message);
    }
  }, [trendSeedQuery.error, trendSeedQuery.isError]);

  const trendHydrating =
    Boolean(trendItemIdFromUrl || recommendationIdFromUrl) &&
    trendSeedQuery.isLoading &&
    !trendSeededRef.current;

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-4rem)] flex-col md:-mx-6 lg:-mx-8">
      {trendHydrating && (
        <div className="flex items-center gap-2 border-b border-slate-800/50 bg-slate-900/40 px-4 py-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("trendSeedLoading")}
        </div>
      )}

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
              {t("reelPromptStudioMobile")}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="h-[min(55vh,100dvh)] border-t border-slate-800/50">
              <ReelPromptStudio />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="hidden h-full w-full max-w-[400px] shrink-0 lg:flex lg:w-[38%] lg:max-w-[420px]">
          <ReelPromptStudio />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950">
          <ReelPreview />
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

      <AnimatePresence>
        {showPublish && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", bounce: 0.15 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[min(88vh,100dvh)] overflow-y-auto border-t border-slate-800/60 bg-slate-900 shadow-2xl xl:hidden"
          >
            <PhotoPublish mobileSheet />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
