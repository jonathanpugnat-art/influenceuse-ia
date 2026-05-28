"use client";

import Image from "next/image";
import Link from "next/link";
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
      <div className="border-t border-slate-800/60 bg-slate-900/40 px-4 py-3">
        <p className="text-center text-xs text-slate-500">{t("studioGridSelectInfluencer")}</p>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-slate-800/60 bg-slate-900/50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t("studioGridTitle")}
        </p>
        <Link
          href={`/influencers/${influencerId}?tab=calendar`}
          className="text-[11px] text-violet-400 hover:text-violet-300"
        >
          {t("studioGridCalendar")}
        </Link>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {isLoading
          ? Array.from({ length: GRID_SLOTS }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-md bg-slate-800/60"
              />
            ))
          : items.map((item) => {
              const thumb = item.mediaUrls?.[0];
              return (
                <div
                  key={item.id}
                  className="relative aspect-square overflow-hidden rounded-md border border-slate-700/50 bg-slate-800"
                  title={item.caption ?? undefined}
                >
                  {thumb ? (
                    <Image src={thumb} alt="" fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] text-slate-600">
                      …
                    </div>
                  )}
                  <span
                    className={cn(
                      "absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center text-[8px] font-medium",
                      item.status === "PUBLISHED" && "text-emerald-400",
                      item.status === "SCHEDULED" && "text-blue-400",
                      item.status === "READY" && "text-violet-300"
                    )}
                  >
                    {item.status === "PUBLISHED"
                      ? "✓"
                      : item.status === "SCHEDULED"
                        ? "⏱"
                        : "•"}
                  </span>
                </div>
              );
            })}
        {!isLoading &&
          Array.from({ length: placeholders }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="aspect-square rounded-md border border-dashed border-slate-700/40 bg-slate-900/30"
            />
          ))}
      </div>
      <p className="mt-2 text-[10px] text-slate-600">{t("studioGridHint")}</p>
    </div>
  );
}
