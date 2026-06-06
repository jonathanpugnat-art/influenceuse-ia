"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { type AgentDomain, type AgentMessage } from "@/lib/agent-core";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_MESSAGES = 3;

export type AgentPanelProps = {
  domain: AgentDomain;
  messages: AgentMessage[];
  onSend: (text: string) => void | Promise<void>;
  isLoading: boolean;
  bottomSlot?: ReactNode;
  quickReplies?: string[];
  disabled?: boolean;
  inputPlaceholder?: string;
  emptyTitle?: string;
  emptyHint?: string;
  thinkingLabel?: string;
  className?: string;
};

function ChoicePills({
  choices,
  disabled,
  onPick,
}: {
  choices: string[];
  disabled?: boolean;
  onPick: (choice: string) => void;
}) {
  if (!choices.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {choices.map((choice) => (
        <button
          key={choice}
          type="button"
          disabled={disabled}
          onClick={() => onPick(choice)}
          className={cn(
            "max-w-full truncate rounded-full border border-neutral-700 bg-neutral-900/80 px-2.5 py-1 text-left text-[11px] text-neutral-200 transition-colors hover:border-rose-400/60 hover:bg-rose-500/10",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          {choice}
        </button>
      ))}
    </div>
  );
}

function AssistantBubble({
  message,
  busy,
  onPickChoice,
}: {
  message: AgentMessage;
  busy?: boolean;
  onPickChoice: (choice: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/30 to-pink-500/20 ring-1 ring-rose-400/30">
        <Sparkles className="h-3.5 w-3.5 text-rose-300" />
      </div>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-neutral-800/80 bg-neutral-900/70 px-2.5 py-2">
        <p className="text-xs leading-relaxed text-neutral-100">{message.content}</p>
        {message.choices?.length ? (
          <ChoicePills
            choices={message.choices}
            disabled={busy}
            onPick={onPickChoice}
          />
        ) : null}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] truncate rounded-2xl rounded-tr-md border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-50">
        {text}
      </div>
    </div>
  );
}

export function AgentPanel({
  domain,
  messages,
  onSend,
  isLoading,
  bottomSlot,
  quickReplies = [],
  disabled = false,
  inputPlaceholder = "Écris ton message…",
  emptyTitle = "Comment puis-je t'aider ?",
  emptyHint = "Décris ce que tu veux créer ou planifier.",
  thinkingLabel = "Réflexion…",
  className,
}: AgentPanelProps) {
  const [input, setInput] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  const visibleMessages = messages.slice(-MAX_VISIBLE_MESSAGES);
  const busy = isLoading || disabled;

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [visibleMessages, isLoading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await onSend(text);
  };

  const handleQuickReply = async (reply: string) => {
    if (busy) return;
    await onSend(reply);
  };

  return (
    <div
      data-agent-domain={domain}
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-neutral-800/60 bg-neutral-950/40",
        className
      )}
    >
      <div
        ref={threadRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 scrollbar-thin"
      >
        <div className="flex min-h-full flex-col justify-end space-y-2.5">
          {visibleMessages.length === 0 ? (
            <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/30 p-3 text-center">
              <Sparkles className="mx-auto h-4 w-4 text-rose-400/80" />
              <p className="mt-1.5 text-xs text-neutral-200">{emptyTitle}</p>
              <p className="mt-0.5 text-[10px] text-neutral-500">{emptyHint}</p>
            </div>
          ) : (
            visibleMessages.map((msg, index) =>
              msg.role === "user" ? (
                <UserBubble key={`${msg.timestamp}-${index}`} text={msg.content} />
              ) : (
                <AssistantBubble
                  key={`${msg.timestamp}-${index}`}
                  message={msg}
                  busy={busy}
                  onPickChoice={handleQuickReply}
                />
              )
            )
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin text-rose-400" />
              {thinkingLabel}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-neutral-800/60 bg-neutral-950/80">
        {quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-neutral-800/40 px-4 py-2">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                disabled={busy}
                onClick={() => void handleQuickReply(reply)}
                className={cn(
                  "max-w-full truncate rounded-full border border-neutral-700/80 bg-neutral-900/70 px-2.5 py-1 text-[11px] text-neutral-200 transition-colors hover:border-rose-400/50 hover:bg-rose-500/10",
                  busy && "pointer-events-none opacity-50"
                )}
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        <div className="px-4 py-2.5">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              disabled={busy}
              placeholder={inputPlaceholder}
              className="min-w-0 flex-1 rounded-xl border border-neutral-800/60 bg-neutral-900/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-rose-400/40 focus:outline-none focus:ring-1 focus:ring-rose-400/30 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={busy || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {bottomSlot ? (
          <div className="border-t border-neutral-800/40 px-4 py-3">{bottomSlot}</div>
        ) : null}
      </div>
    </div>
  );
}
