"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  CheckCircle2,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

interface BatchReviewPanelProps {
  batchId: string | null;
  onClose: () => void;
  onApproved?: () => void;
}

/**
 * S5 — Validate an editorial lot before image batch generation.
 */
export function BatchReviewPanel({
  batchId,
  onClose,
  onApproved,
}: BatchReviewPanelProps) {
  const t = useTranslations("calendar.batchReview");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dfnLocale = locale === "fr" ? fr : enUS;
  const utils = trpc.useUtils();

  const query = trpc.content.listBatchContents.useQuery(
    { batchId: batchId! },
    { enabled: Boolean(batchId) }
  );

  const pendingDrafts = useMemo(
    () =>
      (query.data?.contents ?? []).filter(
        (c) => c.status === "DRAFT" && !c.approvedForBatch
      ),
    [query.data?.contents]
  );

  const pendingIds = useMemo(
    () => pendingDrafts.map((c) => c.id),
    [pendingDrafts]
  );
  const pendingKey = pendingIds.join(",");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncedKey, setSyncedKey] = useState("");

  const approveMut = trpc.content.approveBatch.useMutation({
    onSuccess: (res) => {
      toast.success(t("approveSuccess", { count: res.approved }));
      utils.content.listBatches.invalidate();
      utils.publish.getCalendarEvents.invalidate();
      onApproved?.();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const discardMut = trpc.content.discardBatchContents.useMutation({
    onSuccess: (res) => {
      toast.success(t("discardSuccess", { count: res.discarded }));
      utils.content.listBatchContents.invalidate({ batchId: batchId! });
      utils.content.listBatches.invalidate();
      utils.publish.getCalendarEvents.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (query.data && pendingKey !== syncedKey) {
    setSyncedKey(pendingKey);
    setSelected(new Set(pendingIds));
  }

  if (!batchId) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(pendingDrafts.map((c) => c.id)));
  const selectNone = () => setSelected(new Set());

  const handleApprove = () => {
    if (selected.size === 0) {
      toast.error(t("errorNoneSelected"));
      return;
    }
    approveMut.mutate({
      batchId,
      contentIds: [...selected],
    });
  };

  const handleDiscardUnselected = () => {
    const toDiscard = pendingDrafts
      .filter((c) => !selected.has(c.id))
      .map((c) => c.id);
    if (toDiscard.length === 0) {
      toast.info(t("nothingToDiscard"));
      return;
    }
    discardMut.mutate({ batchId, contentIds: toDiscard });
  };

  return (
    <div className="rounded-2xl border border-border/60 border-l-2 border-l-rose-400/70 bg-card/60 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {query.data?.name
              ? t("subtitleNamed", { name: query.data.name })
              : t("subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          aria-label={t("close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {query.isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      ) : pendingDrafts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={selectAll}
              className="font-medium text-rose-400 hover:underline"
            >
              {t("selectAll")}
            </button>
            <span className="text-muted-foreground/50">·</span>
            <button
              type="button"
              onClick={selectNone}
              className="text-muted-foreground hover:underline"
            >
              {t("selectNone")}
            </button>
            <span className="ml-auto text-muted-foreground">
              {t("selectedCount", {
                selected: selected.size,
                total: pendingDrafts.length,
              })}
            </span>
          </div>

          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {pendingDrafts.map((post) => {
              const isOn = selected.has(post.id);
              return (
                <button
                  key={post.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isOn}
                  onClick={() => toggle(post.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    isOn
                      ? "border-rose-400/50 bg-rose-500/5"
                      : "border-border bg-background/40 opacity-70 hover:opacity-100"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                        isOn
                          ? "border-rose-400 bg-rose-500 text-white"
                          : "border-muted-foreground/50"
                      )}
                    >
                      {isOn ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] text-muted-foreground"
                        >
                          {post.type === "REEL"
                            ? tCommon("reel")
                            : tCommon("photo")}
                        </Badge>
                        {post.trendItemId ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 text-[10px] text-emerald-300"
                          >
                            {t("trendAnchored")}
                          </Badge>
                        ) : null}
                        {post.scheduledAt ? (
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(post.scheduledAt), "EEE d MMM · HH:mm", {
                              locale: dfnLocale,
                            })}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {post.hook ?? t("noHook")}
                      </p>
                      {post.concept ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {post.concept}
                        </p>
                      ) : null}
                      {post.caption ? (
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/70">
                          {post.caption}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={discardMut.isPending || approveMut.isPending}
              onClick={handleDiscardUnselected}
            >
              {discardMut.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t("discardUnselected")}
            </Button>
            <Button
              size="sm"
              disabled={
                selected.size === 0 ||
                approveMut.isPending ||
                discardMut.isPending
              }
              onClick={handleApprove}
            >
              {approveMut.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t("approveAndGenerate", { count: selected.size })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
