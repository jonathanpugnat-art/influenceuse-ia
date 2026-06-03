"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  Send,
  Sparkles,
  Users,
  Shirt,
  ImageIcon,
  Coins,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { type InfluencerGender } from "@/lib/photo-niche-defaults";
import { hasUserSceneDescription } from "@/lib/photo-scene-user";
import { CREDIT_COSTS } from "@/lib/constants";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

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
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {looks.map((look) => {
        const label = lookLabel(look, locale);
        return (
          <button
            key={look.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(look.id)}
            className={cn(
              "group overflow-hidden rounded-xl border border-neutral-700/80 bg-neutral-900/60 text-left transition-all hover:border-rose-400/50 hover:shadow-lg hover:shadow-rose-500/10",
              disabled && "pointer-events-none opacity-50"
            )}
          >
            <div className="relative aspect-[4/3] bg-neutral-800">
              {look.previewSrc ? (
                <Image
                  src={look.previewSrc}
                  alt=""
                  fill
                  className="object-cover transition-transform group-hover:scale-[1.03]"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-3xl">
                  {look.emoji}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-transparent to-transparent" />
              <span className="absolute bottom-2 left-2 right-2 text-xs font-medium text-white">
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
    <div className="mt-3 flex flex-wrap gap-2">
      {outfits.map((outfit) => (
        <button
          key={outfit}
          type="button"
          disabled={disabled}
          onClick={() => onPick(outfit)}
          className={cn(
            "rounded-full border border-neutral-700 bg-neutral-900/80 px-3 py-1.5 text-left text-xs text-neutral-200 transition-colors hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-rose-100",
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/30 to-pink-500/20 ring-1 ring-rose-400/30">
        <Sparkles className="h-4 w-4 text-rose-300" />
      </div>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-neutral-800/80 bg-neutral-900/70 px-3 py-2.5">
        <p className="text-sm leading-relaxed text-neutral-100">{message.text}</p>
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
      <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-50">
        {text}
      </div>
    </div>
  );
}

export function PhotoStudioAgentPanel() {
  const t = useTranslations("content");
  const locale = useLocale() as "fr" | "en";
  const { params, updateParams, requestGenerate, isGenerating } =
    usePhotoCreator();

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [showBrief, setShowBrief] = useState(false);
  const [assistantTurnCount, setAssistantTurnCount] = useState(0);
  const [pendingLookId, setPendingLookId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.photoAgent.chatTurn.useMutation();

  const { data: influencersData } = trpc.influencer.getAll.useQuery(
    { limit: 50 },
    { placeholderData: (prev) => prev }
  );
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

  const resetConversation = useCallback(() => {
    setMessages([]);
    setShowBrief(false);
    setAssistantTurnCount(0);
    setPendingLookId(null);
    setInput("");
  }, []);

  useEffect(() => {
    resetConversation();
  }, [params.influencerId, resetConversation]);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, showBrief]);

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
    }) => {
      if (!hasInfluencer) {
        toast.error(t("selectInfluencerFirst"));
        return;
      }

      try {
        const result = await chatMutation.mutateAsync({
          locale,
          gender,
          userMessage: opts.userMessage,
          selectedLookId: opts.selectedLookId ?? pendingLookId ?? undefined,
          selectedOutfit: opts.selectedOutfit,
          assistantTurnCount,
          history: historyForApi,
        });
        appendAssistant(result);
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

    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "user", text },
    ]);
    setInput("");
    await runAgentTurn({ userMessage: text });
  };

  const handlePickLook = async (lookId: string) => {
    if (chatMutation.isPending) return;
    const look = getLookById(lookId);
    if (!look) return;

    setPendingLookId(lookId);
    updateParams(applyStudioLook(lookId, gender, params.sceneDetail));

    const label = lookLabel(look, locale);
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "user", text: label },
    ]);

    await runAgentTurn({ selectedLookId: lookId });
  };

  const handlePickOutfit = async (outfit: string) => {
    if (chatMutation.isPending) return;
    updateParams({ outfit });

    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "user", text: outfit },
    ]);

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
    requestGenerate();
  };

  const busy = chatMutation.isPending;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-r border-neutral-800/60 bg-neutral-950/40">
      {/* Header */}
      <div className="shrink-0 border-b border-neutral-800/60 px-4 py-4">
        <h1 className="text-lg font-bold text-white">{t("studioTitle")}</h1>
        <p className="mt-0.5 text-xs text-neutral-500">{t("agentSubtitle")}</p>
      </div>

      {/* Zone 1 — Influencer */}
      <div className="shrink-0 space-y-3 border-b border-neutral-800/60 px-4 py-4">
        {influencers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-700 p-4 text-center">
            <Users className="mx-auto h-6 w-6 text-neutral-600" />
            <p className="mt-2 text-xs text-neutral-500">{t("createFirstInfluencer")}</p>
            <Link
              href="/influencers/new"
              className="mt-2 inline-block text-xs text-rose-400 hover:text-rose-300"
            >
              {t("createLink")}
            </Link>
          </div>
        ) : (
          <Select
            value={params.influencerId}
            onValueChange={(v) => updateParams({ influencerId: v })}
          >
            <SelectTrigger className="h-10 border-neutral-800/60 bg-neutral-900/50 text-white">
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

        {selected && portraitUrl && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5">
            <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg border border-rose-400/30">
              <Image src={portraitUrl} alt="" fill className="object-cover" unoptimized />
            </div>
            <p className="text-[11px] text-neutral-400">{t("studioDnaLocked")}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 rounded-xl border border-neutral-800/60 bg-neutral-900/40 px-3 py-2">
          <Label className="text-xs text-neutral-300">{t("faceReferenceLabel")}</Label>
          <Switch
            checked={params.useFaceReference}
            disabled={!portraitUrl || params.contentMode === "NSFW"}
            onCheckedChange={(v) =>
              updateParams({
                useFaceReference: v,
                sceneFirst: v ? params.sceneFirst : false,
              })
            }
          />
        </div>
      </div>

      {/* Zone 2 — Chat */}
      <div
        ref={threadRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin"
      >
        {!hasInfluencer ? (
          <p className="text-center text-xs text-neutral-500">{t("agentPickInfluencer")}</p>
        ) : messages.length === 0 ? (
          <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/30 p-4 text-center">
            <Sparkles className="mx-auto h-5 w-5 text-rose-400/80" />
            <p className="mt-2 text-sm text-neutral-200">{t("agentWelcome")}</p>
            <p className="mt-1 text-xs text-neutral-500">{t("agentWelcomeHint")}</p>
          </div>
        ) : (
          messages.map((msg) =>
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
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-400" />
            {t("agentThinking")}
          </div>
        )}
      </div>

      {/* Chat input */}
      <div className="shrink-0 border-t border-neutral-800/60 px-4 py-3">
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
            className="min-w-0 flex-1 rounded-xl border border-neutral-800/60 bg-neutral-900/60 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-rose-400/40 focus:outline-none focus:ring-1 focus:ring-rose-400/30 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!hasInfluencer || !input.trim() || busy || showBrief}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Zone 3 — Brief summary */}
      {showBrief && (
        <div className="shrink-0 border-t border-neutral-800/60 bg-neutral-900/50 px-4 py-4">
          <div className="rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-500/10 to-pink-500/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-rose-300/90">
              {t("agentBriefTitle")}
            </p>

            <div className="mt-3 space-y-2">
              {selectedLook && (
                <div className="flex items-start gap-2 text-sm text-neutral-100">
                  <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  <span>
                    <span className="text-neutral-500">{t("agentBriefLook")}: </span>
                    {lookLabel(selectedLook, locale)}
                  </span>
                </div>
              )}
              {params.outfit.trim() && (
                <div className="flex items-start gap-2 text-sm text-neutral-100">
                  <Shirt className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  <span>
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
                "mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all",
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
          </div>
        </div>
      )}
    </div>
  );
}
