"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Mic, Library, Link2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SourceMode = "library" | "url" | "generate";

export function ReelAudioPanel({
  influencerId,
  script,
  audioUrl,
  onAudioUrlChange,
}: {
  influencerId: string;
  script: string;
  audioUrl: string;
  onAudioUrlChange: (url: string) => void;
}) {
  const t = useTranslations("content");
  const [mode, setMode] = useState<SourceMode>("generate");

  const speechConfig = trpc.content.speechConfig.useQuery();
  const audioAssets = trpc.mediaLibrary.list.useQuery(
    { kind: "AUDIO", influencerId: influencerId || undefined, limit: 30 },
    { enabled: Boolean(influencerId) }
  );

  const generateVoice = trpc.content.generateReelNarration.useMutation({
    onSuccess: (r) => {
      onAudioUrlChange(r.audioUrl);
      toast.success(t("reelVoiceGenerated"));
    },
    onError: (e) => toast.error(e.message),
  });

  const modes: { id: SourceMode; label: string; icon: typeof Mic }[] = useMemo(
    () => [
      ...(speechConfig.data?.available
        ? [{ id: "generate" as const, label: t("reelAudioTabGenerate"), icon: Sparkles }]
        : []),
      { id: "library", label: t("reelAudioTabLibrary"), icon: Library },
      { id: "url", label: t("reelAudioTabUrl"), icon: Link2 },
    ],
    [speechConfig.data?.available, t]
  );

  const effectiveMode =
    modes.find((m) => m.id === mode)?.id ?? modes[0]?.id ?? "url";

  const selectedFromLibrary = audioAssets.data?.find((a) => a.url === audioUrl);

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/8 to-slate-900/20 p-3">
      <div className="flex items-start gap-2">
        <Mic className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-amber-100/90">{t("reelAudioTitle")}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            {t("reelAudioSubtitle")}
          </p>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-900/60 p-0.5">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
              effectiveMode === m.id
                ? "bg-amber-500/20 text-amber-200"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            <m.icon className="h-3 w-3" />
            {m.label}
          </button>
        ))}
      </div>

      {effectiveMode === "generate" && speechConfig.data?.available && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500">{t("reelAudioGenerateHint")}</p>
          <Button
            type="button"
            size="sm"
            disabled={generateVoice.isPending || script.trim().length < 10}
            onClick={() =>
              generateVoice.mutate({
                script: script.trim(),
                language: "fr",
              })
            }
            className="w-full bg-amber-600/90 hover:bg-amber-600"
          >
            {generateVoice.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {t("reelAudioGenerateBtn", {
              cost: String(speechConfig.data.creditCost),
            })}
          </Button>
        </div>
      )}

      {effectiveMode === "library" && (
        <div className="space-y-2">
          {!influencerId ? (
            <p className="text-[11px] text-slate-500">{t("selectInfluencerFirst")}</p>
          ) : audioAssets.isLoading ? (
            <p className="text-[11px] text-slate-500">{t("reelAudioLoading")}</p>
          ) : (audioAssets.data?.length ?? 0) === 0 ? (
            <p className="text-[11px] text-slate-500">
              {t("reelAudioLibraryEmpty")}{" "}
              <Link href="/library" className="text-violet-400 hover:underline">
                {t("reelAudioLibraryLink")}
              </Link>
            </p>
          ) : (
            <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-800/60 bg-slate-950/40 p-1">
              {audioAssets.data!.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => onAudioUrlChange(asset.url)}
                    className={cn(
                      "w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      audioUrl === asset.url
                        ? "bg-amber-500/15 text-amber-200"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                    )}
                  >
                    {asset.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {effectiveMode === "url" && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-slate-500">{t("reelAudioUrlLabel")}</Label>
          <Input
            value={audioUrl}
            onChange={(e) => onAudioUrlChange(e.target.value)}
            placeholder={t("reelAudioPlaceholder")}
            className="h-9 border-slate-700 bg-slate-900/50 text-sm text-white"
          />
        </div>
      )}

      {audioUrl.trim() && (
        <p className="truncate text-[10px] text-emerald-500/90">
          {selectedFromLibrary ? selectedFromLibrary.name : t("reelAudioReady")}
        </p>
      )}
    </div>
  );
}
