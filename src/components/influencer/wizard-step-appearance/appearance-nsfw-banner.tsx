"use client";

import { useTranslations } from "next-intl";

export function AppearanceNsfwBanner() {
  const t = useTranslations("wizard");

  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
      <p className="font-medium">{t("ofAppearanceBannerTitle")}</p>
      <p className="mt-1 text-xs text-blue-200/80">{t("ofAppearanceBannerHint")}</p>
    </div>
  );
}
