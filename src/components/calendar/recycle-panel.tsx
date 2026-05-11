"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Recycle, TrendingUp, Eye, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

/**
 * Sprint 8 — Recycle top performers panel.
 * Shows the user's best-engaging posts and lets them re-publish them as
 * a fresh DRAFT (same media, regenerated caption).
 */
export function RecyclePanel() {
  const t = useTranslations("calendar.recycle");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.content.listRecycleCandidates.useQuery();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const recycle = trpc.content.recyclePost.useMutation({
    onSuccess: () => {
      toast.success(t("created"));
      utils.content.listRecycleCandidates.invalidate();
      setPendingId(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setPendingId(null);
    },
  });

  if (isLoading) {
    return (
      <Skeleton className="h-[200px] rounded-2xl border border-slate-800/50 bg-slate-900/50" />
    );
  }
  if (!data?.length) return null;

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-slate-900/40 to-cyan-500/5 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Recycle className="h-4 w-4 text-emerald-400" />
        <h2 className="text-lg font-semibold text-white">{t("title")}</h2>
        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          {data.length}
        </Badge>
      </div>
      <p className="mb-4 text-xs text-slate-400">{t("subtitle")}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((c) => {
          const isPending = pendingId === c.contentId;
          return (
            <div
              key={c.contentId}
              className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/60"
            >
              {c.thumbnailUrl ? (
                <div className="relative aspect-video w-full bg-slate-800">
                  <Image
                    src={c.thumbnailUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                </div>
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-slate-800 text-xs text-slate-500">
                  {c.type}
                </div>
              )}
              <div className="space-y-2 p-3">
                <p className="line-clamp-2 text-xs text-slate-300">
                  {c.caption ?? "—"}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                    {(c.bestEngagement * 100).toFixed(1)}%
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {c.totalViews.toLocaleString()}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span>{c.influencerName}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                  disabled={recycle.isPending && isPending}
                  onClick={() => {
                    setPendingId(c.contentId);
                    recycle.mutate({ sourceContentId: c.contentId });
                  }}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {isPending ? t("recycling") : t("recycle")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
