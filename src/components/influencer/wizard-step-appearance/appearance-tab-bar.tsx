"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function AppearanceTabBar({
  appearanceTab,
  onTabChange,
}: {
  appearanceTab: "gallery" | "customize";
  onTabChange: (tab: "gallery" | "customize") => void;
}) {
  const t = useTranslations("wizard");

  return (
    <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
      {(["gallery", "customize"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onTabChange(tab)}
          aria-pressed={appearanceTab === tab}
          className={cn(
            "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            appearanceTab === tab
              ? "bg-foreground/10 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab === "gallery" ? t("galleryTab") : t("customizeTab")}
        </button>
      ))}
    </div>
  );
}
