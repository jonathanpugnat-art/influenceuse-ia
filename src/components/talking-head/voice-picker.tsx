"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mic, Play, Trash2, Upload, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";

interface VoicePickerProps {
  influencerId: string;
}

const LANGUAGES: Array<{ value: "fr" | "en" | "es" | "de" | "it"; label: string }> = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
];

export function VoicePicker({ influencerId }: VoicePickerProps) {
  const utils = trpc.useUtils();
  const voice = trpc.talkingHead.getVoice.useQuery({ influencerId });
  const config = trpc.talkingHead.getConfig.useQuery();

  const [mode, setMode] = useState<"clone" | "library">("clone");
  const [consent, setConsent] = useState(false);
  const [language, setLanguage] = useState<"fr" | "en" | "es" | "de" | "it">("fr");
  const [displayName, setDisplayName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedSampleUrl, setUploadedSampleUrl] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryGender, setLibraryGender] = useState<"male" | "female" | undefined>();
  const [selectedLibraryVoiceId, setSelectedLibraryVoiceId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cloneMutation = trpc.talkingHead.cloneVoice.useMutation({
    onSuccess: () => {
      toast.success("Voix clonée. Le personnage peut maintenant parler.");
      utils.talkingHead.getVoice.invalidate({ influencerId });
      setUploadedSampleUrl(null);
      setConsent(false);
      setDisplayName("");
    },
    onError: (err) => toast.error(err.message),
  });
  const libraryMutation = trpc.talkingHead.setLibraryVoice.useMutation({
    onSuccess: () => {
      toast.success("Voix bibliothèque sélectionnée.");
      utils.talkingHead.getVoice.invalidate({ influencerId });
      setConsent(false);
      setSelectedLibraryVoiceId(null);
    },
    onError: (err) => toast.error(err.message),
  });
  const clearMutation = trpc.talkingHead.clearVoice.useMutation({
    onSuccess: () => {
      toast.success("Voix retirée.");
      utils.talkingHead.getVoice.invalidate({ influencerId });
    },
    onError: (err) => toast.error(err.message),
  });
  const previewMutation = trpc.talkingHead.previewVoice.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const libraryQuery = trpc.talkingHead.listLibraryVoices.useQuery(
    {
      search: librarySearch || undefined,
      gender: libraryGender,
    },
    { enabled: mode === "library" && (config.data?.elevenLabsConfigured ?? false) }
  );

  const hasVoice = Boolean(voice.data?.voiceId);
  const elevenlabsReady = config.data?.elevenLabsConfigured ?? false;

  const canSubmitClone = useMemo(
    () => Boolean(uploadedSampleUrl && consent && elevenlabsReady && !cloneMutation.isPending),
    [uploadedSampleUrl, consent, elevenlabsReady, cloneMutation.isPending]
  );
  const canSubmitLibrary = useMemo(
    () =>
      Boolean(
        selectedLibraryVoiceId && consent && elevenlabsReady && !libraryMutation.isPending
      ),
    [selectedLibraryVoiceId, consent, elevenlabsReady, libraryMutation.isPending]
  );

  async function handleUpload(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/media/voice-sample", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload échoué (HTTP ${res.status}).`);
      }
      const json = (await res.json()) as { url: string };
      setUploadedSampleUrl(json.url);
      toast.success("Échantillon téléchargé. Prêt à cloner.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handlePreview() {
    try {
      const result = await previewMutation.mutateAsync({ influencerId });
      const audio = new Audio(
        `data:${result.contentType};base64,${result.audioBase64}`
      );
      audio.play().catch(() => {
        toast.error("Impossible de lire le preview (autoplay bloqué).");
      });
    } catch {
      // toast already shown
    }
  }

  if (voice.isLoading || config.isLoading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-slate-800/50 bg-slate-900/40 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!elevenlabsReady) {
    return (
      <Alert>
        <AlertTitle>Voix indisponible</AlertTitle>
        <AlertDescription>
          ELEVENLABS_API_KEY manquant sur ce serveur. Ajoute la clé (compte payant, licence commerciale
          incluse dès Starter) pour activer le clonage voix.
        </AlertDescription>
      </Alert>
    );
  }

  if (hasVoice) {
    const providerLabel =
      voice.data?.voiceProvider === "library"
        ? "Bibliothèque ElevenLabs"
        : "Clone Instant Voice";
    return (
      <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-emerald-300">Voix configurée</p>
            <p className="text-xs text-emerald-200/80">
              {voice.data?.voiceLabel ?? "Voix personnage"} · {providerLabel} · {voice.data?.voiceLanguage ?? "fr"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Volume2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Écouter 3s
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => clearMutation.mutate({ influencerId })}
              disabled={clearMutation.isPending}
              className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Retirer
            </Button>
          </div>
        </div>
        {voice.data?.consentAt && (
          <p className="text-[11px] text-emerald-200/70">
            Consentement voix synthétique enregistré le{" "}
            {new Date(voice.data.consentAt).toLocaleString("fr-FR")}.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-800/50 bg-slate-900/40 p-4">
      <div className="flex gap-2 rounded-lg bg-slate-800/40 p-1 text-xs">
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
            mode === "clone"
              ? "bg-slate-900 text-white shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => setMode("clone")}
        >
          Clone Instant Voice
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
            mode === "library"
              ? "bg-slate-900 text-white shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => setMode("library")}
        >
          Bibliothèque ElevenLabs
        </button>
      </div>

      {mode === "clone" ? (
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium text-slate-300">
              Échantillon voix (10–30s, MP3/WAV, ≤ 3 Mo)
            </Label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                )}
                {uploadedSampleUrl ? "Remplacer" : "Téléverser"}
              </Button>
              {uploadedSampleUrl && (
                <audio controls src={uploadedSampleUrl} className="h-8 flex-1" />
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Enregistre-toi (ou l&apos;ayant droit) en parlant clairement pendant 15–20 s. Aucun bruit de fond,
              une seule voix.
            </p>
          </div>
          <div>
            <Label htmlFor="voice-label" className="text-xs font-medium text-slate-300">
              Nom de la voix (optionnel)
            </Label>
            <Input
              id="voice-label"
              placeholder="ex. Aura Luna"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Rechercher (ex. warm, calm)"
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
            />
            <Select
              value={libraryGender ?? "any"}
              onValueChange={(v) =>
                setLibraryGender(v === "any" ? undefined : (v as "male" | "female"))
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Genre</SelectItem>
                <SelectItem value="female">Voix féminine</SelectItem>
                <SelectItem value="male">Voix masculine</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {libraryQuery.isLoading && (
            <div className="flex items-center justify-center py-6 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {libraryQuery.data && libraryQuery.data.length === 0 && (
            <p className="text-center text-xs text-slate-500">Aucune voix trouvée.</p>
          )}
          <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1">
            {libraryQuery.data?.map((v) => {
              const selected = selectedLibraryVoiceId === v.voiceId;
              return (
                <button
                  key={v.voiceId}
                  type="button"
                  onClick={() => {
                    setSelectedLibraryVoiceId(v.voiceId);
                    if (!displayName) setDisplayName(v.name);
                  }}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    selected
                      ? "border-violet-500/60 bg-violet-500/10"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-100">{v.name}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {[v.gender, v.language, v.description?.slice(0, 60)]
                        .filter(Boolean)
                        .join(" · ") || "Voix ElevenLabs"}
                    </p>
                  </div>
                  {v.previewUrl && (
                    <a
                      href={v.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-7 items-center gap-1 rounded-md border border-slate-700 px-2 text-[11px] text-slate-300"
                    >
                      <Play className="h-3 w-3" />
                      Preview
                    </a>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs font-medium text-slate-300">Langue</Label>
          <Select
            value={language}
            onValueChange={(v) => setLanguage(v as "fr" | "en" | "es" | "de" | "it")}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
        <span>
          Je confirme avoir <strong>le droit d&apos;utiliser</strong> cet échantillon (ma voix ou celle
          d&apos;une personne consentante — pas de célébrité, pas d&apos;usurpation). La voix générée
          sera synthétique et diffusée avec la mention prévue par la loi.
        </span>
      </label>

      <div className="flex justify-end">
        {mode === "clone" ? (
          <Button
            type="button"
            disabled={!canSubmitClone}
            onClick={() =>
              cloneMutation.mutate({
                influencerId,
                sampleUrl: uploadedSampleUrl!,
                displayName: displayName || undefined,
                language,
                consent: true,
              })
            }
          >
            {cloneMutation.isPending && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            <Mic className="mr-1.5 h-3.5 w-3.5" />
            Cloner la voix
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!canSubmitLibrary}
            onClick={() =>
              libraryMutation.mutate({
                influencerId,
                voiceId: selectedLibraryVoiceId!,
                displayName: displayName || undefined,
                language,
                consent: true,
              })
            }
          >
            {libraryMutation.isPending && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Utiliser cette voix
          </Button>
        )}
      </div>
    </div>
  );
}
