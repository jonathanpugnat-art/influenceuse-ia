"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import {
  applyStudioLook,
  buildLookSceneDescription,
} from "@/lib/photo-studio-looks";

export function PhotoStudioDetailSection({
  disabled,
}: {
  disabled?: boolean;
}) {
  const t = useTranslations("content");
  const { params, updateParams } = usePhotoCreator();

  const onDetailChange = (detail: string) => {
    if (params.lookId) {
      updateParams({
        sceneDetail: detail,
        sceneDescription: buildLookSceneDescription(params.lookId, detail),
      });
      return;
    }
    updateParams({
      sceneDetail: detail,
      sceneDescription: detail,
      scene: "custom",
      instagramShot: false,
    });
  };

  const recap = params.lookId
    ? buildLookSceneDescription(params.lookId, params.sceneDetail)
    : params.sceneDescription;

  return (
    <div className="space-y-2 rounded-xl border border-slate-800/60 bg-slate-800/20 p-3">
      <Label className="text-xs text-slate-400">{t("studioDetailLabel")}</Label>
      <Input
        value={params.sceneDetail}
        disabled={disabled}
        onChange={(e) => onDetailChange(e.target.value)}
        placeholder={t("studioDetailPlaceholder")}
        className="h-10 border-slate-700/80 bg-slate-900/60 text-sm text-white placeholder:text-slate-600"
      />
      <p className="text-[10px] text-slate-500">{t("studioDetailHint")}</p>
      {recap.trim().length >= 8 && (
        <p className="text-[11px] leading-snug text-emerald-400/90">
          {t("studioSceneActive")}:{" "}
          <span className="text-emerald-200">
            {recap.length > 100 ? `${recap.slice(0, 97)}…` : recap}
          </span>
        </p>
      )}
    </div>
  );
}
