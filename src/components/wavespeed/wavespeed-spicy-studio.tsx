"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Play, ShieldAlert, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatGenerationErrorForUser } from "@/lib/generation-errors";
import {
  WAVESPEED_MISSING_KEY_MESSAGE,
  type WavespeedSpicyPricingSnapshot,
} from "@/lib/wavespeed-spicy-config";
import { trpc } from "@/lib/trpc";

interface WavespeedSpicyStudioProps {
  influencerId: string;
  influencerName: string;
  influencerIsNsfw: boolean;
}

const POLL_INTERVAL_MS = 5_000;

type AdultJob = {
  id: string;
  status: string;
  durationSec: number;
  resolution: string;
  creditsCharged: number;
  outputVideoUrl: string | null;
  error: string | null;
  prompt: string;
  isSynthetic: boolean;
  createdAt: Date | string;
};

export function WavespeedSpicyStudio({
  influencerId,
  influencerName,
  influencerIsNsfw,
}: WavespeedSpicyStudioProps) {
  const availability = trpc.wavespeedSpicy.availability.useQuery(undefined, {
    staleTime: 60_000,
  });

  if (availability.isLoading || !availability.data?.reachable) {
    return null;
  }
  if (!availability.data.planAllowed || !availability.data.pricing) {
    return null;
  }

  return (
    <WavespeedSpicyStudioInner
      influencerId={influencerId}
      influencerName={influencerName}
      influencerIsNsfw={influencerIsNsfw}
      configured={availability.data.configured}
      pricing={availability.data.pricing}
    />
  );
}

function WavespeedSpicyStudioInner({
  influencerId,
  influencerName,
  influencerIsNsfw,
  configured,
  pricing,
}: {
  influencerId: string;
  influencerName: string;
  influencerIsNsfw: boolean;
  configured: boolean;
  pricing: WavespeedSpicyPricingSnapshot;
}) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(pricing.defaultDurationSec);
  const [resolution, setResolution] = useState(pricing.defaultResolution);
  const [consent, setConsent] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const list = trpc.wavespeedSpicy.listJobs.useQuery(
    { influencerId, limit: 6 },
    { refetchInterval: activeJobId ? POLL_INTERVAL_MS : false }
  );

  const activeQuery = trpc.wavespeedSpicy.getJob.useQuery(
    { jobId: activeJobId ?? "" },
    {
      enabled: Boolean(activeJobId),
      refetchInterval: (query) => {
        const data = query.state.data as AdultJob | undefined;
        if (!data) return POLL_INTERVAL_MS;
        return data.status === "PENDING" || data.status === "IN_PROGRESS"
          ? POLL_INTERVAL_MS
          : false;
      },
    }
  );

  const utils = trpc.useUtils();

  const totalCredits = useMemo(() => {
    const row = pricing.matrix.find(
      (m) => m.resolution === resolution && m.durationSec === duration
    );
    return row?.credits ?? 0;
  }, [duration, pricing.matrix, resolution]);

  const create = trpc.wavespeedSpicy.createJob.useMutation({
    onSuccess: (res) => {
      setActiveJobId(res.jobId);
      utils.wavespeedSpicy.listJobs.invalidate({ influencerId });
      utils.billing?.getUsage?.invalidate?.();
      toast.success(
        `Génération adulte lancée — ${res.cost} crédits retenus (remboursés en cas d'échec).`
      );
    },
    onError: (err) => {
      toast.error(
        err.message || WAVESPEED_MISSING_KEY_MESSAGE
      );
    },
  });

  useEffect(() => {
    const s = activeQuery.data?.status;
    if (s === "COMPLETED" || s === "REFUNDED" || s === "FAILED") {
      utils.wavespeedSpicy.listJobs.invalidate({ influencerId });
    }
  }, [activeQuery.data?.status, influencerId, utils]);

  const trimmed = prompt.trim();
  const canSubmit =
    trimmed.length >= 3 &&
    consent &&
    influencerIsNsfw &&
    !create.isPending;

  const submit = () => {
    if (!canSubmit) {
      if (!influencerIsNsfw) {
        toast.error(
          "Active le contenu adulte sur ce personnage avant de générer."
        );
        return;
      }
      if (!consent) {
        toast.error(
          "Coche la case de consentement (contenu synthétique, pas de personne réelle) avant de générer."
        );
        return;
      }
      return;
    }
    if (!configured) {
      toast.error(WAVESPEED_MISSING_KEY_MESSAGE);
      return;
    }
    create.mutate({
      influencerId,
      prompt: trimmed,
      duration,
      resolution,
      consentAccepted: true,
      quotedCredits: totalCredits,
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-5">
      <div className="flex items-center gap-2 text-slate-300">
        <ShieldAlert className="h-4 w-4" />
        <h2 className="text-sm font-semibold tracking-tight">
          Génération adulte (WaveSpeed)
        </h2>
        <Badge
          variant="outline"
          className="border-slate-700 text-[10px] uppercase text-slate-400"
        >
          Pro
        </Badge>
      </div>

      <Alert className="border-amber-500/25 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-300" />
        <AlertTitle className="text-amber-100">
          Conditions d&apos;utilisation — contenu synthétique
        </AlertTitle>
        <AlertDescription className="text-xs text-amber-100/80">
          Moteur adulte séparé (WaveSpeed Wan 2.2 Spicy). Kling / Seedance
          restent exclusivement SFW. Interdit : CSAM (mineurs), images
          intimes non consenties (NCII), personnes réelles sans
          autorisation. Toute sortie est marquée synthétique
          (is_synthetic).
        </AlertDescription>
      </Alert>

      {!configured && (
        <Alert className="border-red-500/30 bg-red-500/10">
          <AlertTitle>Configuration manquante</AlertTitle>
          <AlertDescription className="text-xs">
            {WAVESPEED_MISSING_KEY_MESSAGE}
          </AlertDescription>
        </Alert>
      )}

      {!influencerIsNsfw && (
        <p className="text-xs text-slate-400">
          Active le contenu adulte dans les réglages du personnage pour
          déverrouiller ce moteur.
        </p>
      )}

      <div className="space-y-3">
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-300">
            Prompt (image du personnage verrouillé)
          </Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            maxLength={1200}
            disabled={!influencerIsNsfw}
            placeholder={`Ex : ${influencerName} se tourne vers la caméra, mouvement naturel, lumière tamisée.`}
            className="min-h-[96px]"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium text-slate-300">Durée</Label>
            <div className="grid grid-cols-2 gap-2">
              {pricing.allowedDurations.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium",
                    duration === d
                      ? "border-slate-400 bg-slate-800 text-white"
                      : "border-slate-800 bg-slate-900/60 text-slate-300"
                  )}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium text-slate-300">
              Résolution
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {pricing.allowedResolutions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResolution(r)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium",
                    resolution === r
                      ? "border-slate-400 bg-slate-800 text-white"
                      : "border-slate-800 bg-slate-900/60 text-slate-300"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-3 text-xs text-slate-300">
          <Checkbox
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            className="mt-0.5"
          />
          <span>
            Je confirme que ce personnage est fictif / synthétique, que
            j&apos;ai 18 ans ou plus, et que je n&apos;utilise pas
            l&apos;image d&apos;une personne réelle sans autorisation. Je
            n&apos;envoie pas de CSAM ni de contenu NCII.
          </span>
        </label>
      </div>

      <div className="flex items-baseline gap-2 text-slate-200">
        <span className="text-2xl font-semibold">{totalCredits}</span>
        <span className="text-xs text-slate-500">
          crédits retenus · {duration}s · {resolution}
        </span>
      </div>

      <Button
        type="button"
        onClick={submit}
        disabled={configured ? !canSubmit : false}
        className="w-full justify-center bg-slate-200 text-slate-950 hover:bg-white"
      >
        {create.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Envoi…
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-4 w-4" />
            Générer — {totalCredits} crédits
          </>
        )}
      </Button>

      {activeQuery.data && <AdultJobCard job={activeQuery.data as AdultJob} highlighted />}

      {list.data && list.data.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {list.data
            .filter((j) => j.id !== activeJobId)
            .map((j) => (
              <AdultJobCard
                key={j.id}
                job={j as AdultJob}
                onOpen={() => setActiveJobId(j.id)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function AdultJobCard({
  job,
  onOpen,
  highlighted,
}: {
  job: AdultJob;
  onOpen?: () => void;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-xs",
        highlighted
          ? "border-slate-500 bg-slate-900"
          : "border-slate-800 bg-slate-950/60"
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-slate-300">
          {new Date(job.createdAt).toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
        <Badge variant="outline" className="text-[10px] text-slate-400">
          {job.status}
        </Badge>
      </div>
      <p className="line-clamp-2 text-slate-500">{job.prompt}</p>
      <div className="mt-1 text-[11px] text-slate-500">
        {job.durationSec}s · {job.resolution} · {job.creditsCharged} cr
        {job.isSynthetic ? " · synthétique" : ""}
      </div>
      {job.status === "COMPLETED" && job.outputVideoUrl && (
        <video
          controls
          src={job.outputVideoUrl}
          className="mt-2 aspect-[9/16] w-36 rounded-lg bg-black"
        />
      )}
      {(job.status === "REFUNDED" || job.status === "FAILED") && job.error && (
        <p className="mt-2 text-red-300">
          {formatGenerationErrorForUser(job.error)}
        </p>
      )}
      {(job.status === "PENDING" || job.status === "IN_PROGRESS") && (
        <p className="mt-2 flex items-center gap-1.5 text-slate-300">
          <Loader2 className="h-3 w-3 animate-spin" />
          Génération en cours…
        </p>
      )}
      {onOpen && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2 h-7 px-2 text-xs"
          onClick={onOpen}
        >
          <Play className="mr-1 h-3 w-3" />
          Revoir
        </Button>
      )}
    </div>
  );
}
