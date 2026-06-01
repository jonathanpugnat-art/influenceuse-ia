"use client";

import { Users, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";

export function WizardCollisionBanner({
  fingerprint,
  onReroll,
  compact = false,
}: {
  fingerprint?: string;
  onReroll?: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("wizard");

  const collisionQuery = trpc.influencer.checkAppearanceCollision.useQuery(
    { fingerprint: fingerprint ?? "" },
    {
      enabled: Boolean(fingerprint?.trim()),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    }
  );

  const hasCollision = collisionQuery.data?.hasCollision ?? false;
  const collisionCount = collisionQuery.data?.count ?? 0;

  if (!hasCollision) return null;

  return (
    <div
      className={
        compact
          ? "flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
          : "mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"
      }
    >
      <Users className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-200">
          {collisionCount === 1
            ? t("collisionTitleOne")
            : t("collisionTitleMany", { count: collisionCount })}
        </p>
        <p className="mt-1 text-xs text-amber-200/80">{t("collisionHint")}</p>
        {onReroll && (
          <button
            type="button"
            onClick={onReroll}
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-500/30"
          >
            <Sparkles className="h-3 w-3" />
            {t("collisionReroll")}
          </button>
        )}
      </div>
    </div>
  );
}
