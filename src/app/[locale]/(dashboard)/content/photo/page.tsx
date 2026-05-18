"use client";

import { useEffect, useState } from "react";
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
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export default function PhotoCreatorPage() {
  const t = useTranslations("content");
  const searchParams = useSearchParams();
  const { generatedUrls, isGenerating, params, updateParams } =
    usePhotoCreator();
  const showPublish = generatedUrls.length > 0 && !isGenerating;
  const [paramsOpen, setParamsOpen] = useState(false);

  // Sprint 14 — bugfix: pre-select the influencer from the query string.
  // The profile page links here with `?influencer=<id>` after the user
  // clicks "Create content" on an influencer profile. Without this hook
  // the dropdown stayed empty and the user had to pick again manually.
  // We only set it when (a) the param exists, (b) it's different from
  // the currently selected one — otherwise we'd stomp on the user's
  // manual choice mid-session.
  useEffect(() => {
    const id = searchParams.get("influencer");
    if (id && id !== params.influencerId) {
      updateParams({ influencerId: id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-4rem)] flex-col md:-mx-6 md:flex-row lg:-mx-8">
      {/* Left column — Params (desktop: sidebar; mobile: collapsible above preview) */}
      <div className="hidden w-[320px] shrink-0 md:block">
        <PhotoParams />
      </div>

      {/* Mobile: collapsible params above preview */}
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

      {/* Center column — Preview */}
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-950">
        <PhotoPreview />
      </div>

      {/* Right column — Publish (desktop: slides in; mobile: sticky bottom) */}
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
            {/* Mobile: sticky bottom publish panel */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.2 }}
              className="fixed bottom-0 left-0 right-0 z-40 max-h-[85vh] overflow-y-auto border-t border-slate-800/50 bg-slate-900 shadow-lg lg:hidden"
            >
              <div className="pb-8">
                <PhotoPublish />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
