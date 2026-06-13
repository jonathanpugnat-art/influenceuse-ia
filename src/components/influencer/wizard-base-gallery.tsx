"use client";

import Image from "next/image";
import { Check, Sparkles, ImageOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Niche =
  | "FASHION"
  | "FITNESS"
  | "LIFESTYLE"
  | "TRAVEL"
  | "TECH"
  | "GAMING"
  | "ADULT"
  | "FOOD";

/**
 * Sprint B — base portrait gallery (wizard step 2 default tab).
 * Lets the user pick a pre-generated, on-brand base instead of generating
 * from scratch. Degrades gracefully (empty state → Customize tab) when the
 * catalog has no rows for the current niche.
 */
export function WizardBaseGallery({
  niche,
  gender,
  includeNsfw,
  brief,
  selectedUrl,
  onSelect,
}: {
  niche: string;
  gender: "female" | "male" | "nonbinary";
  includeNsfw: boolean;
  brief?: string;
  selectedUrl?: string;
  onSelect: (url: string) => void;
}) {
  const t = useTranslations("wizard");

  const validNiche = (
    [
      "FASHION",
      "FITNESS",
      "LIFESTYLE",
      "TRAVEL",
      "TECH",
      "GAMING",
      "ADULT",
      "FOOD",
    ] as const
  ).includes(niche as Niche)
    ? (niche as Niche)
    : null;

  const { data, isLoading } = trpc.basePortrait.list.useQuery(
    {
      niche: (validNiche ?? "LIFESTYLE") as Niche,
      gender,
      includeNsfw,
      brief: brief?.trim() || undefined,
    },
    { enabled: Boolean(validNiche) }
  );

  const portraits = data?.portraits ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">
          {t("galleryTitle")}
        </h3>
        <p className="mt-1 text-sm text-slate-400">{t("galleryHint")}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-800/50 bg-slate-800/20 py-16 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("galleryLoading")}
        </div>
      ) : portraits.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800/50 bg-slate-800/20 px-6 py-16 text-center">
          <ImageOff className="h-10 w-10 text-slate-600" />
          <p className="text-sm font-medium text-slate-300">
            {t("galleryEmpty")}
          </p>
          <p className="max-w-xs text-xs text-slate-500">
            {t("galleryEmptyHint")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {portraits.map((p) => {
            const isSelected = selectedUrl === p.imageUrl;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.imageUrl)}
                aria-pressed={isSelected}
                className={cn(
                  "group relative aspect-[3/4] overflow-hidden rounded-2xl border-2 transition-all",
                  isSelected
                    ? "border-violet-500 shadow-lg shadow-violet-500/25"
                    : "border-transparent hover:border-slate-600"
                )}
              >
                <Image
                  src={p.thumbnailUrl || p.imageUrl}
                  alt={`${p.ethnicity} · ${p.bodyType}`}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  unoptimized
                />

                {p.recommended && !isSelected && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-violet-600/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                    <Sparkles className="h-3 w-3" />
                    {t("galleryRecommended")}
                  </span>
                )}

                {isSelected && (
                  <span className="absolute inset-0 flex items-center justify-center bg-violet-600/30">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-white">
                      <Check className="h-5 w-5" />
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedUrl && portraits.some((p) => p.imageUrl === selectedUrl) && (
        <p className="text-center text-xs font-medium text-emerald-300">
          {t("gallerySelected")}
        </p>
      )}
    </div>
  );
}
