"use client";

import { useState } from "react";
import { motion, type Variants } from "framer-motion";
import { ImagePlus, Video, Play, Heart, Eye, Image } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InstagramIcon, TikTokIcon } from "@/components/ui/social-icons";
import { cn } from "@/lib/utils";

interface ContentItem {
  id: string;
  type: string;
  status: string;
  mediaUrls: string[];
  thumbnailUrl?: string | null;
  platforms: string[];
  caption?: string | null;
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
];

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { type: "spring" as const, bounce: 0.1, duration: 0.4 } },
};

export function InfluencerFeed({
  contents,
  totalContents,
}: {
  contents: ContentItem[];
  totalContents: number;
}) {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

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
          <Image className="h-10 w-10 text-slate-600" aria-hidden role="img" aria-label="" />
          <p className="mt-3 text-sm text-slate-400">Aucun contenu</p>
        </div>
      ) : (
        <motion.div
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-3 gap-1.5 sm:gap-2"
        >
          {filtered.map((content) => (
            <motion.div
              key={content.id}
              variants={itemVariants}
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-slate-800/50"
            >
              {/* Thumbnail */}
              {content.thumbnailUrl || content.mediaUrls[0] ? (
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
              {content.type === "REEL" && (
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

              {/* Status badge */}
              {content.status !== "PUBLISHED" && (
                <div className="absolute bottom-1.5 left-1.5">
                  <Badge className="border-0 bg-black/60 px-1.5 py-0 text-[9px] text-white backdrop-blur-sm">
                    {content.status === "DRAFT"
                      ? "Brouillon"
                      : content.status === "SCHEDULED"
                        ? "Programmé"
                        : content.status === "READY"
                          ? "Prêt"
                          : content.status}
                  </Badge>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}

      {totalContents > contents.length && (
        <p className="text-center text-xs text-slate-500">
          {contents.length} sur {totalContents} contenus affichés
        </p>
      )}
    </div>
  );
}

