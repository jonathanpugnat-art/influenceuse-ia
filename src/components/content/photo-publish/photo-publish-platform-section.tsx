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
    contentKind,
    params,
    platforms,
    instagramSelected,
    tiktokSelected,
    instagramCheck,
    tiktokCheck,
    publishReminders,
    togglePlatform,
  } = flow;
  const showTikTok = contentKind === "REEL";

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{t("publishPlatformsLabel")}</Label>
      <div className="space-y-1.5">
        <PlatformCard
          icon={<InstagramIcon className="h-4 w-4 text-pink-400" />}
          name="Instagram"
          selected={platforms.includes("INSTAGRAM")}
          onToggle={() => togglePlatform("INSTAGRAM")}
        />
        {showTikTok && (
          <PlatformCard
            icon={<TikTokIcon className="h-4 w-4 text-white" />}
            name="TikTok"
            selected={platforms.includes("TIKTOK")}
            onToggle={() => togglePlatform("TIKTOK")}
          />
        )}
        <PlatformCard
          icon={<OnlyFansIcon className="h-4 w-4 text-blue-400" />}
          name="OnlyFans"
          selected={platforms.includes("ONLYFANS")}
          onToggle={() => togglePlatform("ONLYFANS")}
          note={t("publishOfZipNote")}
        />
      </div>

      {platforms.includes("ONLYFANS") && (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="leading-snug">{t("publishOfNoApi")}</p>
        </div>
      )}

      {instagramSelected && params.influencerId && (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
          <Instagram className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="space-y-1.5">
            <p className="leading-snug">{t("publishInstagramApiHint")}</p>
            {instagramCheck && !instagramCheck.ok && (
              <Link
                href={`/influencers/${params.influencerId}?tab=social`}
                className="inline-flex font-medium text-rose-400 underline-offset-2 hover:underline"
              >
                {t("publishConnectInstagram")}
              </Link>
            )}
          </div>
        </div>
      )}

      {tiktokSelected && params.influencerId && (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
          <TikTokIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="space-y-1.5">
            <p className="leading-snug">{t("publishTiktokApiHint")}</p>
            {tiktokCheck && !tiktokCheck.ok && (
              <Link
                href={`/influencers/${params.influencerId}?tab=social`}
                className="inline-flex font-medium text-rose-400 underline-offset-2 hover:underline"
              >
                {t("publishConnectTiktok")}
              </Link>
            )}
          </div>
        </div>
      )}

      {publishReminders.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-2.5">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            {t("publishSoftRemindersTitle")}
          </div>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground/80">
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
        "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
        selected
          ? "border-rose-400/50 bg-rose-500/5"
          : "border-border/50 bg-muted/20 hover:border-foreground/30"
      )}
    >
      {icon}
      <div className="flex-1">
        <span
          className={cn(
            "text-xs font-medium",
            selected ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {name}
        </span>
        {note && <p className="text-[9px] text-muted-foreground/70">{note}</p>}
      </div>
      <div
        className={cn(
          "h-4 w-4 rounded-md border-2 transition-colors",
          selected
            ? "border-rose-500 bg-rose-500"
            : "border-muted-foreground/50 bg-transparent"
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
