"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  countScriptWords,
  estimateTalkingHeadCredits,
  estimateTalkingHeadDurationSec,
  validateTalkingHeadScript,
} from "@/lib/talking-head";
import { MAX_TALKING_HEAD_SEC, MAX_TALKING_HEAD_WORDS } from "@/lib/constants";
import type { TalkingHeadJob } from "@/generated/prisma/client";

interface TalkingHeadStudioProps {
  influencerId: string;
}

const POLL_INTERVAL_MS = 4500;

export function TalkingHeadStudio({ influencerId }: TalkingHeadStudioProps) {
  const [script, setScript] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const voice = trpc.talkingHead.getVoice.useQuery({ influencerId });
  const config = trpc.talkingHead.getConfig.useQuery();
  const jobs = trpc.talkingHead.listJobs.useQuery(
    { influencerId, limit: 6 },
    { refetchInterval: activeJobId ? POLL_INTERVAL_MS : false }
  );
  const activeJob = trpc.talkingHead.getJob.useQuery(
    { jobId: activeJobId ?? "" },
    {
      enabled: Boolean(activeJobId),
      refetchInterval: (query) => {
        const data = query.state.data as TalkingHeadJob | undefined;
        if (!data) return POLL_INTERVAL_MS;
        return data.status === "PROCESSING" || data.status === "PENDING"
          ? POLL_INTERVAL_MS
          : false;
      },
    }
  );

  const utils = trpc.useUtils();
  const startMutation = trpc.talkingHead.startJob.useMutation({
    onSuccess: (res) => {
      setActiveJobId(res.jobId);
      utils.talkingHead.listJobs.invalidate({ influencerId });
      utils.billing?.getUsage?.invalidate?.();
      toast.success(`Génération lancée — coût : ${res.estimatedCost} crédits.`);
    },
    onError: (err) => toast.error(err.message),
  });

  const validation = useMemo(() => validateTalkingHeadScript(script), [script]);
  const durationSec = useMemo(() => estimateTalkingHeadDurationSec(script), [script]);
  const words = countScriptWords(script);
  const cost = useMemo(() => estimateTalkingHeadCredits(durationSec), [durationSec]);

  const readyToGenerate =
    validation.ok &&
    Boolean(voice.data?.voiceId) &&
    Boolean(voice.data?.consentAt) &&
    (config.data?.hedraConfigured ?? false) &&
    !startMutation.isPending;

  useEffect(() => {
    if (activeJob.data?.status === "COMPLETED" || activeJob.data?.status === "REFUNDED") {
      utils.talkingHead.listJobs.invalidate({ influencerId });
    }
  }, [activeJob.data?.status, influencerId, utils]);

  if (config.isLoading || voice.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!config.data?.hedraConfigured) {
    return (
      <Alert>
        <AlertTitle>Talking-head indisponible</AlertTitle>
        <AlertDescription>
          HEDRA_API_KEY manquant sur ce serveur. Ajoute la clé Hedra (compte Creator/Pro) pour lancer
          la génération avatar.
        </AlertDescription>
      </Alert>
    );
  }

  const noVoice = !voice.data?.voiceId;
  const noConsent = voice.data?.voiceId && !voice.data.consentAt;

  return (
    <div className="space-y-4">
      {noVoice && (
        <Alert>
          <AlertTitle>Configure d&apos;abord la voix</AlertTitle>
          <AlertDescription>
            Le personnage doit avoir une voix (clone ou bibliothèque) avant de lire un script. Utilise
            le panneau ci-dessus.
          </AlertDescription>
        </Alert>
      )}
      {noConsent && (
        <Alert>
          <AlertTitle>Consentement manquant</AlertTitle>
          <AlertDescription>
            Réenregistre la voix pour cocher le consentement voix synthétique.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-300">
          Script — 80 mots max, ~{MAX_TALKING_HEAD_SEC}s
        </label>
        <Textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={5}
          placeholder="Écris ce que le personnage doit dire face caméra…"
          maxLength={2000}
          className="min-h-[140px]"
        />
        <div className="flex items-center justify-between text-xs">
          <span
            className={
              words > MAX_TALKING_HEAD_WORDS ? "text-red-400" : "text-slate-500"
            }
          >
            {words} / {MAX_TALKING_HEAD_WORDS} mots · ~{durationSec.toFixed(1)}s audio
          </span>
          <Badge variant="secondary" className="bg-slate-800/60">
            <Sparkles className="mr-1 h-3 w-3 text-violet-400" />
            {cost} crédits
          </Badge>
        </div>
        {!validation.ok && script.trim() && (
          <p className="text-xs text-red-400">{validation.error}</p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
        <span>
          9:16 · 720p · Hedra {config.data.modelSlug} · Voix{" "}
          {voice.data?.voiceLabel ?? "personnage"}
        </span>
        <Button
          type="button"
          disabled={!readyToGenerate}
          onClick={() =>
            startMutation.mutate({
              influencerId,
              script,
              language: (voice.data?.voiceLanguage as "fr" | "en" | undefined) ?? "fr",
            })
          }
        >
          {startMutation.isPending && (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          )}
          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
          Générer ({cost} crédits)
        </Button>
      </div>

      {activeJob.data && <JobCard job={activeJob.data} highlighted />}

      {jobs.data && jobs.data.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Générations récentes
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {jobs.data
              .filter((j) => j.id !== activeJobId)
              .map((j) => (
                <JobCard key={j.id} job={j} onOpen={() => setActiveJobId(j.id)} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function JobCard({
  job,
  onOpen,
  highlighted,
}: {
  job: TalkingHeadJob;
  onOpen?: () => void;
  highlighted?: boolean;
}) {
  const status = job.status;
  return (
    <div
      className={`rounded-xl border p-3 text-xs ${
        highlighted
          ? "border-violet-500/40 bg-violet-500/5"
          : "border-slate-800 bg-slate-900/40"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-slate-200">
          {new Date(job.createdAt).toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
        <StatusBadge status={status} />
      </div>
      <p className="line-clamp-2 text-slate-400">{job.script}</p>
      {job.status === "COMPLETED" && job.videoUrl && (
        <video
          controls
          src={job.videoUrl}
          poster={job.thumbnailUrl ?? undefined}
          className="mt-2 aspect-[9/16] w-40 rounded-lg bg-black"
        />
      )}
      {job.status === "REFUNDED" && job.error && (
        <p className="mt-2 text-red-300">{job.error}</p>
      )}
      {job.status === "PROCESSING" && (
        <p className="mt-2 flex items-center gap-1.5 text-violet-300">
          <Loader2 className="h-3 w-3 animate-spin" />
          Génération en cours…
        </p>
      )}
      {onOpen && (
        <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs" onClick={onOpen}>
          Revoir
        </Button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: TalkingHeadJob["status"] }) {
  switch (status) {
    case "PENDING":
    case "PROCESSING":
      return (
        <Badge className="bg-violet-500/20 text-violet-300">En cours</Badge>
      );
    case "COMPLETED":
      return <Badge className="bg-emerald-500/20 text-emerald-300">Prêt</Badge>;
    case "FAILED":
      return <Badge className="bg-red-500/20 text-red-300">Échec</Badge>;
    case "REFUNDED":
      return <Badge className="bg-red-500/20 text-red-300">Remboursé</Badge>;
    default: {
      const _exhaustive: never = status;
      return <Badge>{String(_exhaustive)}</Badge>;
    }
  }
}
