"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";

export function CalendarAgentPanelWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("calendar");
  const locale = useLocale() as "fr" | "en";
  const searchParams = useSearchParams();
  const filterInfluencerId = searchParams.get("influencer") ?? undefined;

  const open = useCalendarAgentStore((s) => s.isOpen);
  const [influencerId, setInfluencerId] = useState(filterInfluencerId ?? "");
  const executedPlanKeyRef = useRef<string | null>(null);

  const { data: influencersData } = trpc.influencer.getAll.useQuery(
    { limit: 50 },
    { placeholderData: (prev) => prev }
  );
  const influencers = influencersData?.influencers ?? [];
  const activeInfluencerId = filterInfluencerId ?? influencerId;

  useEffect(() => {
    if (filterInfluencerId) {
      setInfluencerId(filterInfluencerId);
    }
  }, [filterInfluencerId]);

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
    onSuccess: (res) => {
      toast.success(t("planSuccess", { count: res.postsCreated }));
      utils.publish.getCalendarEvents.invalidate();
      appendAssistant(res.summary);
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
      });
    },
    [planMutation]
  );

  useEffect(() => {
    if (!lastTurn?.readyToExecute || !lastTurn.executionParams) return;
    executePlan(lastTurn.executionParams);
  }, [lastTurn, executePlan]);

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
      <div className="rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-500/10 to-pink-500/5 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-rose-300/90">
          {t("planTitle")}
        </p>
        <p className="mt-2 text-[11px] leading-snug text-neutral-300">
          {executionParams.days}j × {executionParams.postsPerDay}/j ·{" "}
          {executionParams.platforms.join(" + ")}
          {executionParams.vibe ? ` · ${executionParams.vibe}` : ""}
        </p>
        <button
          type="button"
          disabled={isExecuting}
          onClick={() => executePlan(executionParams)}
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all",
            isExecuting
              ? "cursor-wait bg-neutral-800 text-neutral-400"
              : "bg-gradient-to-r from-rose-500 to-pink-600 shadow-lg shadow-rose-500/20 hover:opacity-95"
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
              {t("planSubmit")}
              <span className="text-xs font-normal text-rose-100/80">
                {planCost} crédits
              </span>
            </>
          )}
        </button>
      </div>
    ) : !activeInfluencerId ? (
      <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-3">
        <p className="text-[11px] text-neutral-400">{t("planInfluencer")}</p>
        <Select value={influencerId} onValueChange={setInfluencerId}>
          <SelectTrigger className="mt-2 h-9 border-neutral-800/60 bg-neutral-900/50 text-sm text-white">
            <SelectValue placeholder={t("planInfluencerPlaceholder")} />
          </SelectTrigger>
          <SelectContent className="border-neutral-800 bg-neutral-950">
            {influencers.map((inf) => (
              <SelectItem
                key={inf.id}
                value={inf.id}
                className="text-neutral-300"
              >
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
          "flex shrink-0 flex-col overflow-hidden border-neutral-800/60 bg-neutral-950/60 transition-[width,opacity,margin] duration-300",
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
            emptyTitle={
              locale === "fr"
                ? "Planifie ton mois en une phrase"
                : "Plan your month in one sentence"
            }
            emptyHint={
              locale === "fr"
                ? "Ex. 3 posts/semaine ce mois, vibe été, fitness sur Instagram"
                : "E.g. 3 posts/week this month, summer vibe, fitness on Instagram"
            }
            inputPlaceholder={
              locale === "fr"
                ? "Décris ton plan éditorial…"
                : "Describe your editorial plan…"
            }
            thinkingLabel={locale === "fr" ? "Réflexion…" : "Thinking…"}
            className="min-h-[min(720px,calc(100vh-12rem))] border-r-0 lg:sticky lg:top-24"
          />
        ) : null}
      </aside>
    </div>
  );
}
