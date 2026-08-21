"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ImagePlus,
  Video,
  Play,
  Clock,
  Upload,
  Trash2,
  Image,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InstagramIcon, TikTokIcon } from "@/components/ui/social-icons";
import { trpc } from "@/lib/trpc";
import { useInfluencers } from "@/hooks/use-influencers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ContentLibraryDetailModal } from "@/components/content/content-library-detail-modal";

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Brouillon", color: "bg-slate-600 text-slate-200" },
  GENERATING: { label: "En cours...", color: "bg-amber-600 text-amber-100" },
  READY: { label: "Prêt", color: "bg-emerald-600 text-emerald-100" },
  SCHEDULED: { label: "Programmé", color: "bg-blue-600 text-blue-100" },
  PUBLISHED: { label: "Publié", color: "bg-violet-600 text-violet-100" },
  FAILED: { label: "Échoué", color: "bg-red-600 text-red-100" },
};

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { type: "spring" as const, bounce: 0.1, duration: 0.4 } },
};

export default function ContentLibraryPage() {
  const [influencerFilter, setInfluencerFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);

  const { data: influencersData } = useInfluencers();
  const influencers = influencersData?.influencers ?? [];

  const { data, isLoading } = trpc.content.getAll.useQuery(
    {
      influencerId: influencerFilter !== "ALL" ? influencerFilter : undefined,
      type: typeFilter !== "ALL" ? (typeFilter as "PHOTO") : undefined,
      status: statusFilter !== "ALL" ? (statusFilter as "READY") : undefined,
      page,
      limit: 24,
    },
    { placeholderData: (prev) => prev }
  );

  const utils = trpc.useUtils();

  const deleteMutation = trpc.content.deleteContent.useMutation({
    onSuccess: () => {
      toast.success("Contenu supprimé");
      utils.content.getAll.invalidate();
    },
  });

  const updateMutation = trpc.content.updateContent.useMutation({
    onSuccess: () => toast.success("Statut mis à jour"),
  });

  const contents = data?.contents ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bibliothèque de contenu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${data.total} contenu${data.total > 1 ? "s" : ""}` : "Chargement..."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/content/photo" className="dash-cta">
            <ImagePlus className="h-4 w-4" />
            Photo
          </Link>
          <Link href="/content/reel" className="dash-cta-outline">
            <Video className="h-4 w-4" />
            Reel
          </Link>
          <Link href="/content/remix" className="dash-cta-outline">
            <Video className="h-4 w-4" />
            Remix
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={influencerFilter} onValueChange={(v) => { setInfluencerFilter(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-full dash-filter sm:w-44 [&>span]:text-muted-foreground">
            <SelectValue placeholder="Influenceuse" />
          </SelectTrigger>
          <SelectContent className="border-border bg-popover">
            <SelectItem value="ALL" className="text-foreground focus:bg-accent">Toutes</SelectItem>
            {influencers.map((inf) => (
              <SelectItem key={inf.id} value={inf.id} className="text-foreground focus:bg-accent">
                {inf.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-full dash-filter sm:w-32 [&>span]:text-muted-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-border bg-popover">
            <SelectItem value="ALL" className="text-foreground focus:bg-accent">Tous types</SelectItem>
            <SelectItem value="PHOTO" className="text-foreground focus:bg-accent">Photos</SelectItem>
            <SelectItem value="REEL" className="text-foreground focus:bg-accent">Reels</SelectItem>
            <SelectItem value="CAROUSEL" className="text-foreground focus:bg-accent">Carousel</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-full dash-filter sm:w-36 [&>span]:text-muted-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-border bg-popover">
            <SelectItem value="ALL" className="text-foreground focus:bg-accent">Tous statuts</SelectItem>
            <SelectItem value="READY" className="text-foreground focus:bg-accent">Prêts</SelectItem>
            <SelectItem value="PUBLISHED" className="text-foreground focus:bg-accent">Publiés</SelectItem>
            <SelectItem value="SCHEDULED" className="text-foreground focus:bg-accent">Programmés</SelectItem>
            <SelectItem value="DRAFT" className="text-foreground focus:bg-accent">Brouillons</SelectItem>
            <SelectItem value="GENERATING" className="text-foreground focus:bg-accent">En cours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl bg-muted" />
          ))}
        </div>
      ) : contents.length === 0 ? (
        <EmptyState />
      ) : (
        <motion.div
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
        >
          {contents.map((content) => {
            const status = statusLabels[content.status] ?? statusLabels.DRAFT;
            return (
              <motion.div
                key={content.id}
                role="button"
                tabIndex={0}
                variants={itemVariants}
                whileHover={{ scale: 1.02, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.2), 0 0 0 1px rgb(139 92 246 / 0.1)" }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setSelectedContentId(content.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedContentId(content.id);
                  }
                }}
              >
                {/* Thumbnail */}
                {content.thumbnailUrl || content.mediaUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={content.thumbnailUrl ?? content.mediaUrls[0]}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                    {content.type === "REEL" ? (
                      <Video className="h-10 w-10 text-slate-600" />
                    ) : (
                      <ImagePlus className="h-10 w-10 text-slate-600" />
                    )}
                  </div>
                )}

                {/* Reel badge */}
                {content.type === "REEL" && (
                  <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                    <Play className="h-3 w-3 text-white" />
                    <span className="text-xs font-medium text-white">Reel</span>
                  </div>
                )}

                {/* Status badge */}
                <div className="absolute right-2 top-2">
                  <Badge className={cn("border-0 px-1.5 py-0 text-[9px]", status.color)}>
                    {status.label}
                  </Badge>
                </div>

                {/* Platform badges */}
                <div className="absolute bottom-2 left-2 flex gap-1">
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

                {/* Influencer name */}
                <div className="absolute bottom-2 right-2">
                  <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
                    {content.influencer.name}
                  </span>
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateMutation.mutate({ contentId: content.id, status: "PUBLISHED" });
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    aria-label="Publier"
                  >
                    <Upload className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateMutation.mutate({ contentId: content.id, status: "SCHEDULED" });
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    aria-label="Programmer"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate({ contentId: content.id });
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-red-400 backdrop-blur-sm hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800/50 bg-slate-900/50 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-slate-400">
            Page {page} / {data.totalPages}
          </span>
          <button
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800/50 bg-slate-900/50 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <ContentLibraryDetailModal
        contentId={selectedContentId}
        open={!!selectedContentId}
        onClose={() => setSelectedContentId(null)}
        onDeleted={() => utils.content.getAll.invalidate()}
      />
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center surface py-16 text-center"
    >
      <ImagePlus className="mb-4 h-16 w-16 text-slate-400/30" aria-hidden />
      <h3 className="text-lg font-semibold text-white">Aucun contenu pour l&apos;instant</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-400">
        Crée ton premier contenu pour le voir ici.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link
          href="/content/photo"
          className="dash-cta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ImagePlus className="h-4 w-4" />
          Créer une photo
        </Link>
        <Link
          href="/content/reel"
          className="dash-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Video className="h-4 w-4" />
          Créer un reel
        </Link>
      </div>
    </motion.div>
  );
}
