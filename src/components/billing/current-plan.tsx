"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ExternalLink, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const planBadgeStyles: Record<string, string> = {
  FREE: "border-slate-600 bg-slate-700/50 text-slate-300",
  PRO: "border-violet-500/50 bg-violet-500/20 text-violet-400",
  ENTERPRISE: "border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white",
};

export function CurrentPlan() {
  const { data, isLoading } = useCurrentPlan();
  const { data: usage } = trpc.billing.getUsage.useQuery();
  const portalMutation = trpc.billing.createPortalSession.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank"),
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6">
        <Skeleton className="h-6 w-32 bg-slate-800/50" />
        <Skeleton className="mt-4 h-4 w-48 bg-slate-800/50" />
        <Skeleton className="mt-4 h-3 w-full bg-slate-800/50" />
      </div>
    );
  }

  if (!data) return null;

  const pct = data.creditsLimit > 0
    ? Math.round((data.creditsUsed / data.creditsLimit) * 100)
    : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl">
      {/* Glow */}
      {data.plan !== "FREE" && (
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/10 blur-[80px]" />
      )}

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-4 flex-1">
          {/* Plan badge */}
          <div className="flex items-center gap-3">
            <Badge className={cn("px-3 py-1 text-sm font-semibold", planBadgeStyles[data.plan])}>
              {data.planName}
            </Badge>
            <span className="text-sm text-slate-400">{data.price}€/mois</span>
          </div>

          {/* Renewal date */}
          {data.renewalDate && (
            <p className="text-sm text-slate-400">
              Prochain renouvellement :{" "}
              <span className="text-white">
                {format(new Date(data.renewalDate), "d MMMM yyyy", { locale: fr })}
              </span>
            </p>
          )}

          {/* Credits bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Zap className="h-4 w-4 text-violet-400" />
                Crédits
              </span>
              <span className="font-medium text-white">
                {data.creditsUsed} / {data.creditsLimit === 999999 ? "∞" : data.creditsLimit}
              </span>
            </div>
            <Progress
              value={Math.min(pct, 100)}
              className="h-2 bg-slate-800"
            />
            <p className="text-xs text-slate-500">
              {data.creditsRemaining === 999999
                ? "Crédits illimités"
                : `${data.creditsRemaining} crédits restants`}
            </p>
          </div>

          {/* Breakdown */}
          {usage && (
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span>
                Photos:{" "}
                <span className="text-slate-300">{usage.breakdown.photos}</span>
              </span>
              <span>•</span>
              <span>
                Reels:{" "}
                <span className="text-slate-300">{usage.breakdown.reels}</span>
              </span>
              <span>•</span>
              <span>
                Captions:{" "}
                <span className="text-slate-300">{usage.breakdown.captions}</span>
              </span>
            </div>
          )}
        </div>

        {/* Manage button */}
        {data.stripeCustomerId && (
          <button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Gérer l&apos;abonnement
          </button>
        )}
      </div>
    </div>
  );
}

