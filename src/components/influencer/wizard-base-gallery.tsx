"use client";

import Image from "next/image";
import { Check, Sparkles, ImageOff, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Eyebrow, wizardCardClass } from "@/components/influencer/wizard-ui";
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
  const locale = useLocale();
  const language = locale === "en" ? "en" : "fr";

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
      locale: language,
    },
    { enabled: Boolean(validNiche) }
  );

  const portraits = data?.portraits ?? [];
  const auraRationale = data?.auraRationale;

  return (
    <div className="space-y-4">
      <div>
        <Eyebrow>{t("galleryTitle")}</Eyebrow>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{t("galleryHint")}</p>
        {auraRationale ? (
          <p className="mt-2 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-slate-400">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
            {auraRationale}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("galleryLoading")}
        </div>
      ) : portraits.length === 0 ? (
        <div className={cn(wizardCardClass, "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center")}>
          <ImageOff className="h-10 w-10 text-slate-600" />
          <p className="text-sm font-medium text-slate-400">
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
                    ? "border-white/40 shadow-lg shadow-white/5"
                    : "border-white/10 hover:border-white/25"
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
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                    <Sparkles className="h-3 w-3" />
                    {t("galleryRecommended")}
                  </span>
                )}

                {isSelected && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white">
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
        <p className="text-center text-xs font-medium text-slate-400">
          {t("gallerySelected")}
        </p>
      )}
    </div>
  );
}
