"use client";

import { useTranslations } from "next-intl";
import {
  getPhotoIntentMessage,
  type PhotoIntentIssue,
} from "@/lib/photo-intent-validation";

export function PhotoIntentNotice({
  warnings,
  softened,
  locale,
}: {
  warnings: PhotoIntentIssue[];
  softened: boolean;
  locale: "fr" | "en";
}) {
  const t = useTranslations("content");
  if (!warnings.length && !softened) return null;

  return (
    <div className="space-y-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-100/95">
      {warnings.map((issue) => (
        <p key={issue.code}>{getPhotoIntentMessage(issue, locale)}</p>
      ))}
      {softened ? <p>{t("promptSoftenedBanner")}</p> : null}
    </div>
  );
}
