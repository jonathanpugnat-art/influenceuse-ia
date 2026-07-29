"use client";

import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { AgentPanel } from "@/components/shared/agent-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgent } from "@/hooks/use-agent";
import { useCalendarAgentStore } from "@/hooks/use-calendar-agent-store";
import { CREDIT_COSTS } from "@/lib/constants";
import { trpc } from "@/lib/trpc";
import { useInfluencers } from "@/hooks/use-influencers";
import { cn } from "@/lib/utils";

export function CalendarAgentPanelWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "fr" | "en";
  const searchParams = useSearchParams();
  const filterInfluencerId = searchParams.get("influencer") ?? undefined;

  const open = useCalendarAgentStore((s) => s.isOpen);
  const setReviewBatchId = useCalendarAgentStore((s) => s.setReviewBatchId);
  const [influencerId, setInfluencerId] = useState("");
  const executedPlanKeyRef = useRef<string | null>(null);

  const { data: influencersData } = useInfluencers({ limit: 50 }, { placeholderData: (prev) => prev });
  const influencers = influencersData?.influencers ?? [];
  const activeInfluencerId = filterInfluencerId ?? influencerId;

  const utils = trpc.useUtils();

  const {
    messages,
    isLoading,
    send,
    appendAssistant,
    quickReplies,
    lastTurn,
  } = useAgent({
    domain: "calendar",
    context: {
      locale,
      influencerId: activeInfluencerId || undefined,
    },
  });

  const planMutation = trpc.content.generateContentPlan.useMutation({
    onSuccess: (res, variables) => {
      const anchors = res.trendAnchorsUsed ?? 0;
      toast.success(
        anchors > 0
          ? t("planSuccessReviewAnchored", {
              count: res.postsCreated,
              anchors,
            })
          : t("planSuccessReview", { count: res.postsCreated })
      );
      utils.publish.getCalendarEvents.invalidate();
      utils.content.listBatches.invalidate();
      setReviewBatchId(res.batchId);
      const planLanguage = variables.language ?? locale;
      const summaryPrefix =
        planLanguage === "fr" ? "Résumé du plan :\n\n" : "Plan summary:\n\n";
      const anchorHint =
        anchors > 0
          ? planLanguage === "fr"
            ? `\n\n${anchors} formats trends scrapés ancrés dans le mois.`
            : `\n\n${anchors} scraped trend formats anchored in the month.`
          : "";
      const reviewHint =
        planLanguage === "fr"
          ? "\n\nValide le lot ci-dessous avant de générer les images."
          : "\n\nReview the batch below before generating images.";
      appendAssistant(
        `${summaryPrefix}${res.summary}${anchorHint}${reviewHint}`
      );
    },
    onError: (err) => {
      toast.error(err.message || t("planError"));
      executedPlanKeyRef.current = null;
    },
  });

  const executePlan = useCallback(
    (params: NonNullable<typeof lastTurn>["executionParams"]) => {
      if (!params || planMutation.isPending) return;

      const key = JSON.stringify(params);
      if (executedPlanKeyRef.current === key) return;
      executedPlanKeyRef.current = key;

      planMutation.mutate({
        influencerId: params.influencerId,
        days: params.days,
        postsPerDay: params.postsPerDay,
        platforms: params.platforms,
        language: params.language,
        goals: params.goals,
        startDate: params.startDate,
        useTrendAnchors: true,
      });
    },
    [planMutation]
  );

  // Manual confirm only — no auto-execute (S5 lot validation).

  const executionParams = lastTurn?.executionParams;
  const totalPosts = executionParams
    ? executionParams.days * executionParams.postsPerDay
    : 0;
  const planCost = executionParams
    ? +(CREDIT_COSTS.CONTENT_PLAN_PER_POST * totalPosts).toFixed(2)
    : 0;
  const isExecuting = planMutation.isPending;

  const bottomSlot =
    lastTurn?.readyToExecute && executionParams ? (
      <div className="rounded-xl border border-border/60 border-l-2 border-l-rose-400/70 bg-muted/30 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-rose-300">
          {t("planTitle")}
        </p>
        <p className="mt-2 text-[11px] leading-snug text-foreground/80">
          {executionParams.days}j × {executionParams.postsPerDay}/j ·{" "}
          {executionParams.platforms.join(" + ")}
          {executionParams.vibe ? ` · ${executionParams.vibe}` : ""}
        </p>
        <button
          type="button"
          disabled={isExecuting}
          onClick={() => executePlan(executionParams)}
          className={cn(
            "mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-colors",
            isExecuting
              ? "cursor-wait bg-muted text-muted-foreground"
              : "bg-foreground text-background hover:bg-foreground/90"
          )}
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("planSubmitting")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {t("planSubmitReview")}
              <span className="text-xs font-normal opacity-70">
                {planCost} {tCommon("credits")}
              </span>
            </>
          )}
        </button>
      </div>
    ) : !activeInfluencerId ? (
      <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
        <p className="text-[11px] text-muted-foreground">{t("planInfluencer")}</p>
        <Select value={influencerId} onValueChange={setInfluencerId}>
          <SelectTrigger className="mt-2 h-9 text-sm">
            <SelectValue placeholder={t("planInfluencerPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {influencers.map((inf) => (
              <SelectItem key={inf.id} value={inf.id}>
                {inf.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) : undefined;

  return (
    <div className="flex flex-col lg:flex-row lg:items-stretch lg:gap-0">
      <div className="min-w-0 flex-1">{children}</div>

      <aside
        className={cn(
          "flex shrink-0 flex-col overflow-hidden border-border/60 bg-background/60 transition-[width,opacity,margin] duration-300",
          open
            ? "mt-6 w-full border-t opacity-100 lg:mt-0 lg:w-[360px] lg:border-l lg:border-t-0"
            : "pointer-events-none mt-0 w-0 border-0 opacity-0"
        )}
        aria-hidden={!open}
      >
        {open ? (
          <AgentPanel
            domain="calendar"
            messages={messages}
            onSend={send}
            isLoading={isLoading || isExecuting}
            quickReplies={quickReplies}
            bottomSlot={bottomSlot}
            emptyTitle={t("agentEmptyTitle")}
            emptyHint={t("agentEmptyHint")}
            inputPlaceholder={t("agentInputPlaceholder")}
            thinkingLabel={t("agentThinking")}
            className="min-h-[min(720px,calc(100vh-12rem))] border-r-0 lg:sticky lg:top-24"
          />
        ) : null}
      </aside>
    </div>
  );
}
