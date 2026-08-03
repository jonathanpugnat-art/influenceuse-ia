"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  Send,
  Sparkles,
  Shirt,
  ImageIcon,
  Coins,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import {
  applyStudioLook,
  getStudioLook,
  PHOTO_STUDIO_LOOKS,
} from "@/lib/photo-studio-looks";
import {
  getLookById,
  lookLabel,
  type PhotoAgentTurnOutput,
} from "@/lib/photo-studio-agent";
import { viralBriefFromTrendPick, type TrendTopPick } from "@/lib/viral-brief";
import { type InfluencerGender } from "@/lib/photo-niche-defaults";
import { hasUserSceneDescription } from "@/lib/photo-scene-user";
import { CREDIT_COSTS } from "@/lib/constants";
import { trpc } from "@/lib/trpc";
import { useInfluencers } from "@/hooks/use-influencers";
import { cn } from "@/lib/utils";
import {
  ContentLanePicker,
  ContentLaneBadge,
} from "@/components/content/content-lane-picker";
import {
  getPhotoIntentMessage,
  validatePhotoIntent,
} from "@/lib/photo-intent-validation";

const MAX_VISIBLE_MESSAGES = 3;

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  lookIds?: string[];
  outfits?: string[];
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function LookChoiceCards({
  lookIds,
  locale,
  disabled,
  onPick,
}: {
  lookIds: string[];
  locale: string;
  disabled?: boolean;
  onPick: (lookId: string) => void;
}) {
  const looks = lookIds
    .map((id) => getLookById(id))
    .filter(Boolean) as typeof PHOTO_STUDIO_LOOKS;

  if (!looks.length) return null;

  return (
    <div className="mt-2 grid grid-cols-3 gap-1.5">
      {looks.map((look) => {
        const label = lookLabel(look, locale);
        return (
          <button
            key={look.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(look.id)}
            className={cn(
              "group overflow-hidden rounded-lg border border-neutral-700/80 bg-neutral-900/60 text-left transition-all hover:border-rose-400/50",
              disabled && "pointer-events-none opacity-50"
            )}
          >
            <div className="relative aspect-[4/3] bg-neutral-800">
              {look.previewSrc ? (
                <Image
                  src={look.previewSrc}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xl">
                  {look.emoji}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-transparent to-transparent" />
              <span className="absolute bottom-1 left-1 right-1 truncate text-[10px] font-medium text-white">
                {look.emoji} {label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function OutfitChoicePills({
  outfits,
  disabled,
  onPick,
}: {
  outfits: string[];
  disabled?: boolean;
  onPick: (outfit: string) => void;
}) {
  if (!outfits.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {outfits.map((outfit) => (
        <button
          key={outfit}
          type="button"
          disabled={disabled}
          onClick={() => onPick(outfit)}
          className={cn(
            "max-w-full truncate rounded-full border border-neutral-700 bg-neutral-900/80 px-2.5 py-1 text-left text-[11px] text-neutral-200 transition-colors hover:border-rose-400/60 hover:bg-rose-500/10",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          {outfit}
        </button>
      ))}
    </div>
  );
}

function AssistantBubble({
  message,
  locale,
  busy,
  onPickLook,
  onPickOutfit,
}: {
  message: UiMessage;
  locale: string;
  busy?: boolean;
  onPickLook: (lookId: string) => void;
  onPickOutfit: (outfit: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/30 to-pink-500/20 ring-1 ring-rose-400/30">
        <Sparkles className="h-3.5 w-3.5 text-rose-300" />
      </div>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-neutral-800/80 bg-neutral-900/70 px-2.5 py-2">
        <p className="text-xs leading-relaxed text-neutral-100">{message.text}</p>
        {message.lookIds?.length ? (
          <LookChoiceCards
            lookIds={message.lookIds}
            locale={locale}
            disabled={busy}
            onPick={onPickLook}
          />
        ) : null}
        {message.outfits?.length ? (
          <OutfitChoicePills
            outfits={message.outfits}
            disabled={busy}
            onPick={onPickOutfit}
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

export function PhotoStudioAgentPanel() {
  const t = useTranslations("content");
  const locale = useLocale() as "fr" | "en";
  const { params, updateParams, requestGenerate, isGenerating, applyViralBrief } =
    usePhotoCreator();

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [showBrief, setShowBrief] = useState(false);
  const [assistantTurnCount, setAssistantTurnCount] = useState(0);
  const [pendingLookId, setPendingLookId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.agent.chatTurn.useMutation();

  const { data: topTrendsData } = trpc.trends.getTopForInfluencer.useQuery(
    { influencerId: params.influencerId, limit: 3 },
    { enabled: Boolean(params.influencerId) }
  );
  const topTrends = topTrendsData?.items ?? [];

  const { data: influencersData } = useInfluencers({ limit: 50 }, { placeholderData: (prev) => prev });
  const influencers = influencersData?.influencers ?? [];
  const selected = influencers.find((i) => i.id === params.influencerId);
  const gender = (selected?.gender as InfluencerGender | undefined) ?? "female";
  const portraitUrl =
    selected?.baseImageUrl?.trim() || selected?.avatarUrl?.trim() || null;
  const hasInfluencer = Boolean(params.influencerId);

  const selectedLook = params.lookId ? getStudioLook(params.lookId) : undefined;
  const composeCost = params.numberOfImages * CREDIT_COSTS.PHOTO;
  const canGenerate =
    hasInfluencer &&
    Boolean(params.outfit.trim()) &&
    hasUserSceneDescription(params.sceneDescription) &&
    !isGenerating;

  const visibleMessages = useMemo(
    () => messages.slice(-MAX_VISIBLE_MESSAGES),
    [messages]
  );

  const conversationKey = `${params.influencerId ?? ""}:${params.contentMode}`;
  const [storedConversationKey, setStoredConversationKey] =
    useState(conversationKey);

  if (conversationKey !== storedConversationKey) {
    setStoredConversationKey(conversationKey);
    setMessages([]);
    setShowBrief(false);
    setAssistantTurnCount(0);
    setPendingLookId(null);
    setInput("");
  }

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [visibleMessages, chatMutation.isPending]);

  const historyForApi = useMemo(
    () => messages.map((m) => ({ role: m.role, content: m.text })),
    [messages]
  );

  const appendAssistant = useCallback((result: PhotoAgentTurnOutput) => {
    setMessages((prev) => [
      ...prev,
      {
        id: newId(),
        role: "assistant",
        text: result.message,
        lookIds: result.suggestedLookIds.length
          ? result.suggestedLookIds
          : undefined,
        outfits: result.suggestedOutfits.length
          ? result.suggestedOutfits
          : undefined,
      },
    ]);
    setAssistantTurnCount((c) => c + 1);
    if (result.showBrief) setShowBrief(true);
  }, []);

  const runAgentTurn = useCallback(
    async (opts: {
      userMessage?: string;
      selectedLookId?: string;
      selectedOutfit?: string;
      selectedTrendId?: string;
    }) => {
      if (!hasInfluencer) {
        toast.error(t("selectInfluencerFirst"));
        return;
      }

      try {
        const result = await chatMutation.mutateAsync({
          domain: "photo",
          messages: historyForApi,
          context: {
            influencerId: params.influencerId,
            locale,
            gender,
            assistantTurnCount,
            selectedLookId: opts.selectedLookId ?? pendingLookId ?? undefined,
            selectedOutfit: opts.selectedOutfit,
            contentMode: params.contentMode,
            userMessage: opts.userMessage,
            selectedTrendId: opts.selectedTrendId,
          },
        });
        const photoResult = result.photoAgentResult;
        if (!photoResult) {
          toast.error(t("agentError"));
          return;
        }
        appendAssistant(photoResult);
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("agentError");
        toast.error(msg);
      }
    },
    [
      appendAssistant,
      assistantTurnCount,
      chatMutation,
      gender,
      hasInfluencer,
      historyForApi,
      locale,
      pendingLookId,
      params.contentMode,
      params.influencerId,
      t,
    ]
  );

  const handleSend = async () => {
    const text = input.trim();
    if (!text || chatMutation.isPending) return;
    if (!hasInfluencer) {
      toast.error(t("selectInfluencerFirst"));
      return;
    }

    setMessages((prev) => [...prev, { id: newId(), role: "user", text }]);
    setInput("");
    await runAgentTurn({ userMessage: text });
  };

  const handlePickTrend = async (pick: TrendTopPick) => {
    if (chatMutation.isPending || !params.influencerId) return;
    const brief = viralBriefFromTrendPick(pick, "studio_agent");
    applyViralBrief(brief, params.influencerId);
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "user", text: pick.title },
    ]);
    await runAgentTurn({ selectedTrendId: pick.id });
  };

  const handlePickLook = async (lookId: string) => {
    if (chatMutation.isPending) return;
    const look = getLookById(lookId);
    if (!look) return;

    setPendingLookId(lookId);
    updateParams(applyStudioLook(lookId, gender, params.sceneDetail, params.contentMode));

    const label = lookLabel(look, locale);
    setMessages((prev) => [...prev, { id: newId(), role: "user", text: label }]);

    await runAgentTurn({ selectedLookId: lookId });
  };

  const handlePickOutfit = async (outfit: string) => {
    if (chatMutation.isPending) return;
    updateParams({ outfit });

    setMessages((prev) => [...prev, { id: newId(), role: "user", text: outfit }]);

    await runAgentTurn({
      selectedLookId: pendingLookId ?? params.lookId ?? undefined,
      selectedOutfit: outfit,
    });
  };

  const handleGenerate = () => {
    if (!canGenerate) {
      if (!params.outfit.trim()) toast.error(t("studioOutfitEmpty"));
      else if (!hasUserSceneDescription(params.sceneDescription))
        toast.error(t("studioSceneEmpty"));
      else toast.error(t("selectInfluencerFirst"));
      return;
    }

    const issues = validatePhotoIntent({
      contentMode: params.contentMode,
      sceneDescription: params.sceneDescription,
      outfit: params.outfit,
      scene: params.scene,
      locale,
    });
    const warnings = issues.filter((i) => i.severity === "warning");
    for (const issue of warnings) {
      toast.warning(getPhotoIntentMessage(issue, locale), { duration: 7000 });
    }
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      toast.error(getPhotoIntentMessage(errors[0]!, locale));
      return;
    }

    requestGenerate();
  };

  const busy = chatMutation.isPending;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-neutral-800/60 bg-neutral-950/40">
      {/* Zone 1 — Influencer (~120px, no scroll) */}
      <div className="flex min-h-[120px] shrink-0 flex-col justify-center gap-2 overflow-hidden border-b border-neutral-800/60 px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-white">{t("studioTitle")}</p>
          <div className="flex items-center gap-2">
            {hasInfluencer ? <ContentLaneBadge /> : null}
            {selected && portraitUrl ? (
              <div className="relative h-8 w-7 shrink-0 overflow-hidden rounded-md border border-rose-400/30">
                <Image src={portraitUrl} alt="" fill className="object-cover" unoptimized />
              </div>
            ) : null}
          </div>
        </div>

        {influencers.length === 0 ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-neutral-700 px-2 py-1.5">
            <p className="truncate text-[11px] text-neutral-500">{t("createFirstInfluencer")}</p>
            <Link href="/influencers/new" className="shrink-0 text-[11px] text-rose-400">
              {t("createLink")}
            </Link>
          </div>
        ) : (
          <Select
            value={params.influencerId}
            onValueChange={(v) => updateParams({ influencerId: v })}
          >
            <SelectTrigger className="h-9 border-neutral-800/60 bg-neutral-900/50 text-sm text-white">
              <SelectValue placeholder={t("selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent className="border-neutral-800 bg-neutral-950">
              {influencers.map((inf) => (
                <SelectItem key={inf.id} value={inf.id} className="text-neutral-300">
                  {inf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasInfluencer ? (
          <ContentLanePicker variant="studio" showSceneFirst={false} />
        ) : null}

        {hasInfluencer && topTrends.length > 0 ? (
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
              {t("studioTrendsTitle")}
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
              {topTrends.map((trend) => (
                <button
                  key={trend.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void handlePickTrend(trend)}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                    params.trendItemId === trend.id
                      ? "border-rose-400/60 bg-rose-500/15 text-rose-100"
                      : "border-neutral-700 bg-neutral-900/80 text-neutral-300 hover:border-rose-400/40"
                  )}
                >
                  {trend.title.length > 36 ? `${trend.title.slice(0, 34)}…` : trend.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Zone 2 — Chat thread (flex-1, internal scroll, last 3 messages) */}
      <div
        ref={threadRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 scrollbar-thin"
      >
        <div className="flex min-h-full flex-col justify-end space-y-2.5">
          {!hasInfluencer ? (
            <p className="text-center text-xs text-neutral-500">{t("agentPickInfluencer")}</p>
          ) : visibleMessages.length === 0 ? (
            <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/30 p-3 text-center">
              <Sparkles className="mx-auto h-4 w-4 text-rose-400/80" />
              <p className="mt-1.5 text-xs text-neutral-200">{t("agentWelcome")}</p>
              <p className="mt-0.5 text-[10px] text-neutral-500">{t("agentWelcomeHint")}</p>
            </div>
          ) : (
            visibleMessages.map((msg) =>
              msg.role === "user" ? (
                <UserBubble key={msg.id} text={msg.text} />
              ) : (
                <AssistantBubble
                  key={msg.id}
                  message={msg}
                  locale={locale}
                  busy={busy}
                  onPickLook={handlePickLook}
                  onPickOutfit={handlePickOutfit}
                />
              )
            )
          )}

          {busy && (
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin text-rose-400" />
              {t("agentThinking")}
            </div>
          )}
        </div>
      </div>

      {/* Footer — input + brief (fixed, always visible) */}
      <div className="shrink-0 border-t border-neutral-800/60 bg-neutral-950/80">
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
              disabled={!hasInfluencer || busy || showBrief}
              placeholder={t("agentInputPlaceholder")}
              className="min-w-0 flex-1 rounded-xl border border-neutral-800/60 bg-neutral-900/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-rose-400/40 focus:outline-none focus:ring-1 focus:ring-rose-400/30 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!hasInfluencer || !input.trim() || busy || showBrief}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="border-t border-neutral-800/40 px-4 py-3">
          <div
            className={cn(
              "rounded-xl border p-3 transition-colors",
              showBrief
                ? "border-rose-500/25 bg-gradient-to-br from-rose-500/10 to-pink-500/5"
                : "border-neutral-800/60 bg-neutral-900/40"
            )}
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-rose-300/90">
              {t("agentBriefTitle")}
            </p>
            {params.trendContext?.title ? (
              <p className="mt-1 text-[10px] text-amber-200/90">
                {t("studioTrendInspired", { title: params.trendContext.title })}
              </p>
            ) : null}

            {showBrief ? (
              <>
                <div className="mt-2 space-y-1.5">
                  {selectedLook && (
                    <div className="flex items-start gap-2 text-xs text-neutral-100">
                      <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                      <span className="min-w-0 truncate">
                        <span className="text-neutral-500">{t("agentBriefLook")}: </span>
                        {lookLabel(selectedLook, locale)}
                      </span>
                    </div>
                  )}
                  {params.outfit.trim() && (
                    <div className="flex items-start gap-2 text-xs text-neutral-100">
                      <Shirt className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                      <span className="min-w-0 truncate">
                        <span className="text-neutral-500">{t("agentBriefOutfit")}: </span>
                        {params.outfit}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className={cn(
                    "mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all",
                    canGenerate
                      ? "bg-gradient-to-r from-rose-500 to-pink-600 shadow-lg shadow-rose-500/20 hover:opacity-95"
                      : "cursor-not-allowed bg-neutral-800 text-neutral-500"
                  )}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("generatingInfluencer")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {t("generatePostBtn")}
                      <span className="flex items-center gap-1 text-xs font-normal text-rose-100/80">
                        <Coins className="h-3 w-3" />
                        {composeCost} {t("creditUnit")}
                        {composeCost > 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <p className="mt-2 text-[11px] leading-snug text-neutral-500">
                {t("agentBriefPending")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
