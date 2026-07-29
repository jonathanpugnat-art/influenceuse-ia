"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "aura-publish-failures-dismissed-at";

function loadDismissedAt(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Bannière « publication échouée » du calendrier. Le cron publish marque les
 * échecs en DB mais n'a aucun canal de notification : sans cette bannière,
 * un token Meta expiré = post silencieusement jamais publié. Dismissable —
 * mais réapparaît si un échec plus récent que le dismiss survient.
 */
export function PublishFailuresBanner({
  onOpenContent,
}: {
  onOpenContent?: (contentId: string) => void;
}) {
  const t = useTranslations("calendar.publishFailures");
  const { data } = trpc.publish.recentPublishFailures.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const [dismissedAt, setDismissedAt] = useState<number>(loadDismissedAt);

  const failures = (data ?? []).filter(
    (f) => new Date(f.createdAt).getTime() > dismissedAt
  );
  if (failures.length === 0) return null;

  const dismiss = () => {
    const now = Date.now();
    window.localStorage.setItem(DISMISS_KEY, String(now));
    setDismissedAt(now);
  };

  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <h2 className="text-sm font-semibold text-foreground">
            {t("title", { count: failures.length })}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          onClick={dismiss}
          aria-label={t("dismiss")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ul className="mt-3 space-y-2">
        {failures.map((f) => (
          <li
            key={f.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/80"
          >
            <span className="font-medium">{f.content.influencer.name}</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="uppercase text-muted-foreground">
              {f.platform}
            </span>
            {f.error ? (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span className="line-clamp-1 max-w-[420px] text-muted-foreground">
                  {f.error}
                </span>
              </>
            ) : null}
            {onOpenContent ? (
              <button
                type="button"
                className="text-red-300 underline-offset-2 hover:underline"
                onClick={() => onOpenContent(f.content.id)}
              >
                {t("view")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
