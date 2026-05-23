"use client";

import { useMemo } from "react";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { buildGenerationPreviewLines } from "@/lib/photo-content-context";
import type { PhotoParams } from "@/hooks/use-photo-creator";

export function PhotoGenerationPreview({ params }: { params: PhotoParams }) {
  const t = useTranslations("content");
  const lines = useMemo(
    () =>
      buildGenerationPreviewLines({
        scene: params.scene,
        sceneDescription: params.sceneDescription,
        pose: params.pose,
        outfit: params.outfit,
        expression: params.expression,
        photoStyle: params.photoStyle,
        timeOfDay: params.timeOfDay,
        location: params.location,
        customPrompt: params.customPrompt,
      }),
    [params]
  );

  const labelForKey = (key: string) => {
    switch (key) {
      case "scene":
        return t("previewScene");
      case "pose":
        return t("previewPose");
      case "location":
        return t("location");
      case "outfit":
        return t("outfit");
      case "expression":
        return t("expression");
      case "style":
        return t("photoStyle");
      case "extra":
        return t("previewExtra");
      default:
        return key;
    }
  };

  if (!params.sceneDescription?.trim() && !params.pose) {
    return null;
  }

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-violet-300">
        <Eye className="h-3.5 w-3.5" />
        {t("generationPreviewTitle")}
      </div>
      <dl className="space-y-1.5">
        {lines.map((line) => (
          <div key={line.key} className="grid grid-cols-[5.5rem_1fr] gap-2 text-xs">
            <dt className="text-slate-500">{labelForKey(line.key)}</dt>
            <dd className="text-slate-200 leading-snug">{line.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-slate-600">{t("generationPreviewHint")}</p>
    </div>
  );
}
