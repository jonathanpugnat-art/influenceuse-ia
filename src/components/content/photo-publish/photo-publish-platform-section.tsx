"use client";

import Link from "next/link";
import { Info, Instagram } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import {
  InstagramIcon,
  TikTokIcon,
  OnlyFansIcon,
} from "@/components/ui/social-icons";
import { cn } from "@/lib/utils";
import type { PhotoPublishFlowState } from "@/hooks/photo-studio";

export function PhotoPublishPlatformSection({
  flow,
}: {
  flow: PhotoPublishFlowState;
}) {
  const t = useTranslations("content");
  const {
    params,
    platforms,
    instagramSelected,
    instagramCheck,
    publishReminders,
    togglePlatform,
  } = flow;

  return (
    <div className="space-y-2">
      <Label className="text-xs text-slate-400">Plateformes</Label>
      <div className="space-y-1.5">
        <PlatformCard
          icon={<InstagramIcon className="h-4 w-4 text-pink-400" />}
          name="Instagram"
          selected={platforms.includes("INSTAGRAM")}
          onToggle={() => togglePlatform("INSTAGRAM")}
        />
        <PlatformCard
          icon={<TikTokIcon className="h-4 w-4 text-white" />}
          name="TikTok"
          selected={platforms.includes("TIKTOK")}
          onToggle={() => togglePlatform("TIKTOK")}
        />
        <PlatformCard
          icon={<OnlyFansIcon className="h-4 w-4 text-blue-400" />}
          name="OnlyFans"
          selected={platforms.includes("ONLYFANS")}
          onToggle={() => togglePlatform("ONLYFANS")}
          note="Export ZIP — publication manuelle"
        />
      </div>

      {platforms.includes("ONLYFANS") && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5 text-[11px] text-blue-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
          <p className="leading-snug">
            OnlyFans n&apos;a pas d&apos;API publique. Nous générons un ZIP avec
            vos médias et un guide ; vous publierez manuellement sur votre compte
            OF.
          </p>
        </div>
      )}

      {instagramSelected && params.influencerId && (
        <div className="flex items-start gap-2 rounded-lg border border-pink-500/25 bg-pink-500/5 p-2.5 text-[11px] text-pink-100/90">
          <Instagram className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-400" />
          <div className="space-y-1.5">
            <p className="leading-snug">{t("publishInstagramApiHint")}</p>
            {instagramCheck && !instagramCheck.ok && (
              <Link
                href={`/influencers/${params.influencerId}?tab=social`}
                className="inline-flex font-medium text-pink-300 underline-offset-2 hover:underline"
              >
                {t("publishConnectInstagram")}
              </Link>
            )}
          </div>
        </div>
      )}

      {publishReminders.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-slate-700/60 bg-slate-800/30 p-2.5">
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
            <Info className="h-3.5 w-3.5" />
            {t("publishSoftRemindersTitle")}
          </div>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-slate-500">
            {publishReminders.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PlatformCard({
  icon,
  name,
  selected,
  onToggle,
  note,
}: {
  icon: React.ReactNode;
  name: string;
  selected: boolean;
  onToggle: () => void;
  note?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all",
        selected
          ? "border-violet-500/50 bg-violet-500/10"
          : "border-slate-800/50 bg-slate-800/20 hover:border-slate-700"
      )}
    >
      {icon}
      <div className="flex-1">
        <span
          className={cn(
            "text-xs font-medium",
            selected ? "text-white" : "text-slate-400"
          )}
        >
          {name}
        </span>
        {note && <p className="text-[9px] text-slate-600">{note}</p>}
      </div>
      <div
        className={cn(
          "h-4 w-4 rounded-md border-2 transition-all",
          selected
            ? "border-violet-500 bg-violet-500"
            : "border-slate-600 bg-transparent"
        )}
      >
        {selected && (
          <svg viewBox="0 0 16 16" className="h-full w-full text-white">
            <path
              fill="currentColor"
              d="M6.5 12.5l-4-4 1.5-1.5L6.5 9.5l6-6L14 5z"
            />
          </svg>
        )}
      </div>
    </button>
  );
}
