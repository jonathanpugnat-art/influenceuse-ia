"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Loader2, Play, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Live progress panel for editorial batches (Phase 4).
 *
 * Lists the user's most recent ContentBatch rows with a per-batch progress
 * bar (DRAFT → GENERATING → READY/SCHEDULED). The cron route processes
 * batches automatically every minute, but the user can also trigger a
 * slice immediately via "Lancer maintenant".
 */
export function BatchProgressPanel() {
  const t = useTranslations("calendar.batch");
  const utils = trpc.useUtils();

  const { data: batches, isLoading } = trpc.content.listBatches.useQuery(
    { limit: 5 },
    { refetchInterval: 8_000 }
  );

  const processSlice = trpc.content.processBatchSlice.useMutation({
    onSuccess: (res) => {
      toast.success(
        t("sliceDone", {
          generated: res.generated,
          failed: res.failed,
          remaining: res.remaining,
        })
      );
      utils.content.listBatches.invalidate();
      utils.publish.getCalendarEvents.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const retry = trpc.content.retryBatchFailures.useMutation({
    onSuccess: (res) => {
      toast.success(t("retryDone", { count: res.reset }));
      utils.content.listBatches.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // While any batch is still draining, refresh more aggressively.
  const hasActive = (batches ?? []).some(
    (b) => (b.status?.draft ?? 0) + (b.status?.generating ?? 0) > 0
  );
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => {
      utils.content.listBatches.invalidate();
    }, 4_000);
    return () => clearInterval(id);
  }, [hasActive, utils]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
        </div>
      </div>
    );
  }

  if (!batches || batches.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{t("title")}</h3>
        <span className="text-xs text-slate-500">{t("subtitle")}</span>
      </div>

      <div className="space-y-3">
        {batches.map((batch) => {
          const s = batch.status;
          if (!s) return null;

          const total = s.total || 1;
          const done = s.ready + s.scheduled + s.published;
          const pct = Math.round((done / total) * 100);
          const isActive = s.draft > 0 || s.generating > 0;
          const isDone = !isActive && s.failed === 0 && done >= s.total;

          return (
            <div
              key={batch.id}
              className="rounded-xl border border-slate-800/50 bg-slate-950/50 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {batch.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {batch.influencer?.name ?? "—"} · {s.total} {t("posts")}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {s.failed > 0 && (
                    <button
                      type="button"
                      onClick={() => retry.mutate({ batchId: batch.id })}
                      disabled={retry.isPending}
                      className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3 w-3" />
                      {t("retry", { count: s.failed })}
                    </button>
                  )}
                  {isActive && (
                    <button
                      type="button"
                      onClick={() => processSlice.mutate({ batchId: batch.id })}
                      disabled={processSlice.isPending}
                      className="flex items-center gap-1 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
                    >
                      {processSlice.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      {t("runNow")}
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    isDone
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-violet-500 to-indigo-500"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{pct}%</span>
                {s.generating > 0 && (
                  <span className="flex items-center gap-1 text-violet-300">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {s.generating} {t("statuses.generating")}
                  </span>
                )}
                {s.draft > 0 && (
                  <span>
                    {s.draft} {t("statuses.draft")}
                  </span>
                )}
                {(s.ready > 0 || s.scheduled > 0) && (
                  <span className="flex items-center gap-1 text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    {s.ready + s.scheduled} {t("statuses.ready")}
                  </span>
                )}
                {s.failed > 0 && (
                  <span className="flex items-center gap-1 text-amber-300">
                    <AlertTriangle className="h-3 w-3" />
                    {s.failed} {t("statuses.failed")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
