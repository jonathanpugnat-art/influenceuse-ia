"use client";

import { useCallback, useMemo, useState } from "react";
import {
  type AgentDomain,
  type AgentMessage,
  type AgentTurnOutput,
  toAgentChatHistory,
} from "@/lib/agent-core";
import { trpc } from "@/lib/trpc";

export type UseAgentOptions = {
  domain: AgentDomain;
  context?: Record<string, unknown>;
};

export function useAgent({ domain, context }: UseAgentOptions) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [lastTurn, setLastTurn] = useState<AgentTurnOutput | null>(null);

  const chatMutation = trpc.agent.chatTurn.useMutation();

  const quickReplies = useMemo(
    () => lastTurn?.quickReplies ?? [],
    [lastTurn?.quickReplies]
  );

  const clearSession = useCallback(() => {
    setMessages([]);
    setLastTurn(null);
  }, []);

  const appendAssistant = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatMutation.isPending) return;

      const userMessage: AgentMessage = {
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);

      try {
        const result = await chatMutation.mutateAsync({
          domain,
          messages: toAgentChatHistory(nextMessages),
          context,
        });

        setLastTurn(result);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.message,
            timestamp: Date.now(),
            choices: result.choices,
            trendStudioActions: result.trendStudioActions,
          },
        ]);
      } catch {
        setMessages((prev) => prev.slice(0, -1));
        throw new Error("Agent turn failed");
      }
    },
    [chatMutation, context, domain, messages]
  );

  return {
    messages,
    isLoading: chatMutation.isPending,
    send,
    clearSession,
    appendAssistant,
    quickReplies,
    lastTurn,
    error: chatMutation.error,
  };
}
