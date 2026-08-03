"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Clock, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const GRID_SLOTS = 6;

export function PhotoFeedGridStrip({ influencerId }: { influencerId?: string }) {
  const t = useTranslations("content");

  const { data, isLoading } = trpc.content.getAll.useQuery(
    {
      influencerId: influencerId || undefined,
      type: "PHOTO",
      page: 1,
      limit: GRID_SLOTS,
    },
    { enabled: Boolean(influencerId) }
  );

  const items = data?.contents ?? [];
  const placeholders = Math.max(0, GRID_SLOTS - items.length);

  if (!influencerId) {
    return (
      <div className="border-t border-border/60 bg-card/30 px-4 py-3">
        <p className="text-center text-xs text-muted-foreground">
          {t("studioGridSelectInfluencer")}
        </p>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-border/60 bg-card/40 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("studioGridTitle")}
        </p>
        <Link
          href={`/influencers/${influencerId}?tab=calendar`}
          className="text-[11px] font-medium text-rose-400 hover:text-rose-300"
        >
          {t("studioGridCalendar")}
        </Link>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {isLoading
          ? Array.from({ length: GRID_SLOTS }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-md bg-muted/60"
              />
            ))
          : items.map((item) => {
              const thumb = item.mediaUrls?.[0];
              const StatusIcon =
                item.status === "PUBLISHED"
                  ? Check
                  : item.status === "SCHEDULED"
                    ? Clock
                    : Circle;
              return (
                <div
                  key={item.id}
                  className="relative aspect-square overflow-hidden rounded-md border border-border/50 bg-muted"
                  title={item.caption ?? undefined}
                >
                  {thumb ? (
                    <Image src={thumb} alt="" fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] text-muted-foreground/60">
                      …
                    </div>
                  )}
                  <span
                    className={cn(
                      "absolute bottom-0 left-0 right-0 flex items-center justify-center bg-black/60 px-1 py-0.5",
                      item.status === "PUBLISHED" && "text-emerald-400",
                      item.status === "SCHEDULED" && "text-blue-400",
                      item.status === "READY" && "text-foreground/80"
                    )}
                  >
                    <StatusIcon className="h-2.5 w-2.5" />
                  </span>
                </div>
              );
            })}
        {!isLoading &&
          Array.from({ length: placeholders }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="aspect-square rounded-md border border-dashed border-border/40 bg-card/20"
            />
          ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground/70">{t("studioGridHint")}</p>
    </div>
  );
}
