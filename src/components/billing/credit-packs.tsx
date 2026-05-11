"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Zap, Rocket } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PackId = "small" | "medium" | "large";

const PACK_ICONS: Record<PackId, typeof Sparkles> = {
  small: Sparkles,
  medium: Zap,
  large: Rocket,
};

const PACK_GRADIENTS: Record<PackId, string> = {
  small: "from-cyan-500/10 to-blue-500/10 border-cyan-500/30",
  medium: "from-violet-500/10 to-fuchsia-500/10 border-violet-500/30",
  large: "from-orange-500/10 to-red-500/10 border-orange-500/30",
};

/**
 * Credit pack purchase grid (Sprint 7). Shown on the /billing page next to
 * the subscription cards. Lets a user top-up their credit budget without
 * upgrading tier.
 */
export function CreditPacks() {
  const t = useTranslations("billing.creditPacks");
  const { data: packs, isLoading } = trpc.billing.listCreditPacks.useQuery();
  const [pendingId, setPendingId] = useState<PackId | null>(null);

  const purchase = trpc.billing.purchaseCredits.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: () => {
      setPendingId(null);
    },
  });

  if (isLoading || !packs?.length) return null;

  const visible = packs.filter((p) => p.available);
  if (!visible.length) return null;

  return (
    <Card className="border-slate-800/60 bg-slate-900/40 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{t("title")}</h3>
        <p className="mt-1 text-sm text-slate-400">{t("subtitle")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {visible.map((pack) => {
          const Icon = PACK_ICONS[pack.id as PackId];
          const grad = PACK_GRADIENTS[pack.id as PackId];
          const isPending = pendingId === pack.id;
          return (
            <div
              key={pack.id}
              className={cn(
                "relative overflow-hidden rounded-xl border bg-gradient-to-br p-4",
                grad
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-white" />
                <p className="font-semibold text-white">{t(`${pack.id}.name`)}</p>
              </div>
              <p className="mt-3 text-3xl font-bold text-white">
                +{pack.credits.toLocaleString()}
              </p>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {t("creditsLabel")}
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {pack.priceEur}€
              </p>
              <p className="text-xs text-slate-400">{t("oneTime")}</p>
              <Button
                className="mt-4 w-full"
                disabled={purchase.isPending && isPending}
                onClick={() => {
                  setPendingId(pack.id as PackId);
                  purchase.mutate({ packId: pack.id as PackId });
                }}
              >
                {isPending ? t("redirecting") : t("buy")}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
