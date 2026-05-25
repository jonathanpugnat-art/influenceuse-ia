"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ReelParams } from "@/components/content/reel-params";
import { ReelPreview } from "@/components/content/reel-preview";
import { PhotoPublish } from "@/components/content/photo-publish";
import { StudioProStrip } from "@/components/content/studio-pro-strip";
import { useReelCreator } from "@/hooks/use-reel-creator";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export default function ReelCreatorPage() {
  const t = useTranslations("content");
  const { videoUrl, isGenerating } = useReelCreator();
  const showPublish = !!videoUrl && !isGenerating;
  const [paramsOpen, setParamsOpen] = useState(false);

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-4rem)] flex-col md:-mx-6 md:flex-row lg:-mx-8">
      {/* Left column — Params (desktop) */}
      <div className="hidden w-[320px] shrink-0 md:block">
        <ReelParams />
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
              <ReelParams />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Center column — Preview */}
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-950 pb-4 lg:pb-0">
        <ReelPreview />
      </div>

      {/* Right column — Publish (desktop: sidebar; mobile: sticky bottom) */}
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
  );
}
