"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { AgentPanel } from "@/components/shared/agent-panel";
import { useAgent } from "@/hooks/use-agent";
import { useTrendsAgentStore } from "@/hooks/use-trends-agent-store";
import { type AgentMessage } from "@/lib/agent-core";
import { cn } from "@/lib/utils";

export function TrendsAgentPanel({
  influencerId,
  className,
}: {
  influencerId?: string;
  className?: string;
}) {
  const t = useTranslations("trends");
  const locale = useLocale() as "fr" | "en";
  const router = useRouter();
  const open = useTrendsAgentStore((s) => s.isOpen);

  const { messages, isLoading, send, quickReplies } = useAgent({
    domain: "trends",
    context: {
      locale,
      influencerId: influencerId || undefined,
    },
  });

  const handlePickChoice = async (choice: string, message: AgentMessage) => {
    const action = message.trendStudioActions?.find((a) => a.label === choice);
    if (action && influencerId) {
      const qs = new URLSearchParams({
        influencer: influencerId,
        trendItemId: action.trendId,
      });
      const path =
        action.studio === "reel" ? "/content/reel" : "/content/photo";
      router.push(`${path}?${qs.toString()}`);
      return;
    }
    await send(choice);
  };

  if (!open) return null;

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-neutral-800/60 bg-neutral-950/60",
        className
      )}
    >
      <AgentPanel
        domain="trends"
        messages={messages}
        onSend={send}
        onPickChoice={handlePickChoice}
        isLoading={isLoading}
        quickReplies={quickReplies}
        emptyTitle={t("agentEmptyTitle")}
        emptyHint={t("agentEmptyHint")}
        inputPlaceholder={t("agentInputPlaceholder")}
        thinkingLabel={t("agentThinking")}
        className="min-h-[min(640px,calc(100vh-14rem))] border-r-0"
      />
    </aside>
  );
}

export function TrendsAgentPanelWrapper({
  children,
  influencerId,
}: {
  children: React.ReactNode;
  influencerId?: string;
}) {
  const open = useTrendsAgentStore((s) => s.isOpen);

  return (
    <div className="flex flex-col xl:flex-row xl:items-stretch">
      <div className="min-w-0 flex-1">{children}</div>
      <div
        className={cn(
          "overflow-hidden transition-[width,opacity,margin] duration-300",
          open
            ? "mt-6 w-full opacity-100 xl:mt-0 xl:w-[360px]"
            : "pointer-events-none mt-0 w-0 opacity-0"
        )}
        aria-hidden={!open}
      >
        <TrendsAgentPanel
          influencerId={influencerId}
          className="border-t border-neutral-800/60 xl:border-l xl:border-t-0"
        />
      </div>
    </div>
  );
}
