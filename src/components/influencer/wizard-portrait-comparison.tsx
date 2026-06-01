"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Desktop-friendly 2×2 comparison grid for the 4 wizard portraits. */
export function WizardPortraitComparison({
  urls,
  selectedIndex,
  onSelect,
}: {
  urls: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const t = useTranslations("wizard");

  if (urls.length === 0) return null;

  return (
    <div className="hidden lg:block">
      <p className="mb-3 text-xs font-medium text-slate-400">
        {t("portraitCompareHint")}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "group relative aspect-[3/4] overflow-hidden rounded-2xl border-2 transition-all",
              selectedIndex === i
                ? "border-violet-500 shadow-lg shadow-violet-500/25 ring-2 ring-violet-500/30"
                : "border-slate-800 opacity-80 hover:border-violet-500/50 hover:opacity-100"
            )}
          >
            <Image
              src={url}
              alt={t("variantAlt", { index: i + 1 })}
              fill
              className="object-cover transition-transform group-hover:scale-[1.02]"
              unoptimized
            />
            <span
              className={cn(
                "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
                selectedIndex === i
                  ? "bg-violet-500 text-white"
                  : "bg-black/50 text-slate-200"
              )}
            >
              {i + 1}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
