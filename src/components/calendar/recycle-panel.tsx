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
    return <Skeleton className="h-[200px] rounded-2xl" />;
  }
  if (!data?.length) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Recycle className="h-4 w-4 text-emerald-400" />
        <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
        <Badge variant="outline" className="text-muted-foreground">
          {data.length}
        </Badge>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{t("subtitle")}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((c) => {
          const isPending = pendingId === c.contentId;
          return (
            <div
              key={c.contentId}
              className="overflow-hidden rounded-xl border border-border/60 bg-card/60"
            >
              {c.thumbnailUrl ? (
                <div className="relative aspect-video w-full bg-muted">
                  <Image
                    src={c.thumbnailUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                </div>
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                  {c.type}
                </div>
              )}
              <div className="space-y-2 p-3">
                <p className="line-clamp-2 text-xs text-foreground/80">
                  {c.caption ?? "—"}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                    {(c.bestEngagement * 100).toFixed(1)}%
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {c.totalViews.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span>{c.influencerName}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
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
