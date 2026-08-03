"use client";

import { useLocale } from "next-intl";
import { usePhotoGeneration } from "@/hooks/photo-studio";
import { PhotoPreviewClassicLayout } from "./photo-preview-classic-layout";
import { PhotoPreviewStudioLayout } from "./photo-preview-studio-layout";

export function PhotoPreview({
  isWelcomeFlow = false,
  layout = "classic",
}: {
  isWelcomeFlow?: boolean;
  layout?: "classic" | "studio";
}) {
  const locale = useLocale() as "fr" | "en";
  const gen = usePhotoGeneration(locale);

  if (layout === "studio") {
    return <PhotoPreviewStudioLayout gen={gen} locale={locale} />;
  }

  return (
    <PhotoPreviewClassicLayout
      gen={gen}
      locale={locale}
      isWelcomeFlow={isWelcomeFlow}
    />
  );
}
