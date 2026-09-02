"use client";

import { useState } from "react";
import { motion, type Variants } from "framer-motion";
import {
  ImagePlus,
  Video,
  Play,
  Heart,
  Eye,
  Image,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InstagramIcon, TikTokIcon } from "@/components/ui/social-icons";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ContentItem {
  id: string;
  type: string;
  status: string;
  mediaUrls: string[];
  thumbnailUrl?: string | null;
  platforms: string[];
  caption?: string | null;
  /**
   * French-formatted error message when `status === "FAILED"` (mapped from the
   * last GenerationJob.error via `formatGenerationErrorForUser`). Backend fills
   * this so the feed can surface face-lock / safety / etc. reasons instead of
   * a raw "FAILED" badge with no action.
   */
  errorMessage?: string | null;
}

const filterTypes = [
  { value: "ALL", label: "Tous" },
  { value: "PHOTO", label: "Photos" },
  { value: "REEL", label: "Reels" },
];

const filterStatuses = [
  { value: "ALL", label: "Tous" },
  { value: "PUBLISHED", label: "Publiés" },
  { value: "READY", label: "Prêts" },
  { value: "DRAFT", label: "Brouillons" },
  { value: "SCHEDULED", label: "Programmés" },
  { value: "FAILED", label: "Échecs" },
];

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring" as const, bounce: 0.1, duration: 0.4 },
  },
};

/**
 * Map a raw ContentStatus to the French label shown on the feed tile.
 * Extracted so we can unit-test the "FAILED → Échec" mapping (previously
 * fell through to a raw untranslated "FAILED" string — QA face-lock bug).
 */
export function feedStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "SCHEDULED":
      return "Programmé";
    case "READY":
      return "Prêt";
    case "GENERATING":
      return "En cours";
    case "FAILED":
      return "Échec";
    case "PUBLISHED":
      return "Publié";
    default:
      return status;
  }
}

export function InfluencerFeed({
  contents,
  totalContents,
}: {
  contents: ContentItem[];
  totalContents: number;
}) {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [errorDetail, setErrorDetail] = useState<{
    contentId: string;
    contentType: string;
    message: string;
  } | null>(null);

  const filtered = contents.filter((c) => {
    if (typeFilter !== "ALL" && c.type !== typeFilter) return false;
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-lg border border-slate-800/50 bg-slate-900/50 p-0.5">
          {filterTypes.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                typeFilter === f.value
                  ? "bg-violet-500/20 text-violet-400"
                  : "text-slate-500 hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-slate-800/50 bg-slate-900/50 p-0.5">
          {filterStatuses.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-violet-500/20 text-violet-400"
                  : "text-slate-500 hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/50 bg-slate-900/50 py-16">
          <Image
            className="h-10 w-10 text-slate-600"
            aria-hidden
            role="img"
            aria-label=""
          />
          <p className="mt-3 text-sm text-slate-400">Aucun contenu</p>
        </div>
      ) : (
        <motion.div
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-3 gap-1.5 sm:gap-2"
        >
          {filtered.map((content) => {
            const isFailed = content.status === "FAILED";
            const failureMessage = isFailed
              ? content.errorMessage?.trim() ||
                "La génération a échoué. Réessayez depuis le studio."
              : null;

            const tileClass = cn(
              "group relative aspect-square overflow-hidden rounded-xl text-left",
              isFailed
                ? "cursor-pointer border border-rose-500/40 bg-rose-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                : "cursor-pointer bg-slate-800/50"
            );

            const tileContent = (
              <>
                {/* Thumbnail (or failed placeholder) */}
                {isFailed ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
                    <AlertTriangle className="h-6 w-6 text-rose-300" />
                    <p className="line-clamp-3 text-[10px] leading-snug text-rose-100/90">
                      {failureMessage}
                    </p>
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-rose-300/90">
                      Cliquer pour détails
                    </span>
                  </div>
                ) : content.thumbnailUrl || content.mediaUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={content.thumbnailUrl ?? content.mediaUrls[0]}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImagePlus className="h-8 w-8 text-slate-600" />
                  </div>
                )}

                {/* Reel icon */}
                {content.type === "REEL" && !isFailed && (
                  <div className="absolute left-2 top-2">
                    <Video className="h-4 w-4 text-white drop-shadow" />
                  </div>
                )}

                {/* Platform badges */}
                <div className="absolute right-1.5 top-1.5 flex gap-1">
                  {content.platforms.includes("INSTAGRAM") && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-black/50 backdrop-blur-sm">
                      <InstagramIcon className="h-3 w-3 text-white" />
                    </div>
                  )}
                  {content.platforms.includes("TIKTOK") && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-black/50 backdrop-blur-sm">
                      <TikTokIcon className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>

                {/* Hover overlay */}
                {!isFailed && (
                  <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                    {content.type === "REEL" && (
                      <Play className="h-8 w-8 text-white" />
                    )}
                    <div className="flex items-center gap-1 text-white">
                      <Heart className="h-4 w-4" />
                      <span className="text-sm font-medium">—</span>
                    </div>
                    <div className="flex items-center gap-1 text-white">
                      <Eye className="h-4 w-4" />
                      <span className="text-sm font-medium">—</span>
                    </div>
                  </div>
                )}

                {/* Status badge */}
                {content.status !== "PUBLISHED" && (
                  <div className="absolute bottom-1.5 left-1.5">
                    <Badge
                      className={cn(
                        "border-0 px-1.5 py-0 text-[9px] backdrop-blur-sm",
                        isFailed
                          ? "bg-rose-600/80 text-white"
                          : "bg-black/60 text-white"
                      )}
                    >
                      {feedStatusLabel(content.status)}
                    </Badge>
                  </div>
                )}
              </>
            );

            if (isFailed) {
              return (
                <motion.button
                  key={content.id}
                  type="button"
                  variants={itemVariants}
                  className={tileClass}
                  onClick={() =>
                    setErrorDetail({
                      contentId: content.id,
                      contentType: content.type,
                      message: failureMessage ?? "",
                    })
                  }
                  aria-label={`Voir le détail de l'échec de génération : ${failureMessage}`}
                >
                  {tileContent}
                </motion.button>
              );
            }

            return (
              <motion.div
                key={content.id}
                variants={itemVariants}
                className={tileClass}
              >
                {tileContent}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {totalContents > contents.length && (
        <p className="text-center text-xs text-slate-500">
          {contents.length} sur {totalContents} contenus affichés
        </p>
      )}

      <Dialog
        open={errorDetail !== null}
        onOpenChange={(open) => {
          if (!open) setErrorDetail(null);
        }}
      >
        <DialogContent className="border-rose-500/40 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-300">
              <AlertTriangle className="h-4 w-4" />
              Génération échouée
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {errorDetail?.contentType === "REEL"
                ? "Ce reel n'a pas pu être généré. Voici pourquoi."
                : "Cette photo n'a pas pu être générée. Voici pourquoi."}
            </DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-100">
            {errorDetail?.message}
          </p>
          <p className="text-xs text-slate-500">
            Aucun crédit n&apos;a été débité pour cette tentative — relance
            depuis le studio quand le problème est corrigé.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
