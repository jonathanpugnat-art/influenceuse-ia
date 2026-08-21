"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Film,
  Loader2,
  Play,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  SEEDANCE_ALLOWED_DURATIONS,
  SEEDANCE_ALLOWED_RESOLUTIONS,
  type SeedanceDuration,
  type SeedanceResolution,
} from "@/lib/seedance-config";

interface SeedanceStudioProps {
  influencerId: string;
  influencerName: string;
}

const POLL_INTERVAL_MS = 5_000;

const RESOLUTION_LABELS: Record<SeedanceResolution, string> = {
  "480p": "480p · brouillon",
  "720p": "720p · qualité HD",
};

const RESOLUTION_HINTS: Record<SeedanceResolution, string> = {
  "480p": "Plus rapide, idéal pour tester la scène.",
  "720p": "Recommandé pour la publication.",
};

type SceneJob = {
  id: string;
  status: string;
  durationSec: number;
  resolution: string;
  creditsCharged: number;
  outputVideoUrl: string | null;
  error: string | null;
  prompt: string;
  createdAt: Date | string;
};

export function SeedanceStudio({
  influencerId,
  influencerName,
}: SeedanceStudioProps) {
  const [scenePrompt, setScenePrompt] = useState("");
  const [duration, setDuration] = useState<SeedanceDuration>(15);
  const [resolution, setResolution] = useState<SeedanceResolution>("720p");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [confirmingBigCost, setConfirmingBigCost] = useState(false);

  const pricing = trpc.seedance.pricing.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const list = trpc.seedance.listScenes.useQuery(
    { influencerId, limit: 8 },
    { refetchInterval: activeJobId ? POLL_INTERVAL_MS : false }
  );

  const activeQuery = trpc.seedance.getScene.useQuery(
    { jobId: activeJobId ?? "" },
    {
      enabled: Boolean(activeJobId),
      refetchInterval: (query) => {
        const data = query.state.data as SceneJob | undefined;
        if (!data) return POLL_INTERVAL_MS;
        return data.status === "PENDING" || data.status === "IN_PROGRESS"
          ? POLL_INTERVAL_MS
          : false;
      },
    }
  );

  const utils = trpc.useUtils();

  const totalCredits = useMemo(() => {
    if (!pricing.data) return 0;
    const row = pricing.data.matrix.find(
      (m) => m.resolution === resolution && m.durationSec === duration
    );
    return row?.credits ?? 0;
  }, [duration, pricing.data, resolution]);

  const create = trpc.seedance.createScene.useMutation({
    onSuccess: (res) => {
      setActiveJobId(res.jobId);
      setConfirmingBigCost(false);
      utils.seedance.listScenes.invalidate({ influencerId });
      utils.billing?.getUsage?.invalidate?.();
      toast.success(
        `Scène lancée — ${res.cost} crédits retenus (remboursés en cas d'échec).`
      );
    },
    onError: (err) => {
      setConfirmingBigCost(false);
      toast.error(err.message || "Impossible de lancer la scène Seedance.");
    },
  });

  useEffect(() => {
    const s = activeQuery.data?.status;
    if (s === "COMPLETED" || s === "REFUNDED" || s === "FAILED") {
      utils.seedance.listScenes.invalidate({ influencerId });
    }
  }, [activeQuery.data?.status, influencerId, utils]);

  const trimmed = scenePrompt.trim();
  const canSubmit =
    trimmed.length >= 3 && !create.isPending && Boolean(pricing.data);

  const submit = () => {
    if (!canSubmit) return;
    // 30s picks are the "explicit choice" per PRD — surface a cost
    // confirmation step so the user can't burn 540/1080 credits by
    // accident.
    if (duration === 30 && !confirmingBigCost) {
      setConfirmingBigCost(true);
      return;
    }
    create.mutate({
      influencerId,
      scenePrompt: trimmed,
      duration,
      resolution,
      generateAudio,
      quotedCredits: totalCredits,
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Film className="h-5 w-5 text-fuchsia-300" />
          <h2 className="text-base font-semibold text-foreground">
            Décris la scène
          </h2>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-300">
              Prompt scène (@Image1 = le personnage)
            </Label>
            <Textarea
              value={scenePrompt}
              onChange={(e) => setScenePrompt(e.target.value)}
              rows={4}
              placeholder={`Ex : ${influencerName} traverse un café ensoleillé, regarde vers la caméra, natural motion. "J'adore ce lundi matin."`}
              maxLength={1200}
              className="min-h-[120px]"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {scenePrompt.length} / 1200 caractères · les dialogues entre
              guillemets seront synchronisés avec l&apos;audio natif.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DurationPicker value={duration} onChange={setDuration} />
            <ResolutionPicker value={resolution} onChange={setResolution} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-4 py-3">
            <div>
              <Label className="text-sm">Audio natif (voix + ambiance)</Label>
              <p className="text-[11px] text-muted-foreground">
                Seedance génère la piste audio en même temps que la vidéo.
                Coupe si tu comptes ré-doubler ensuite.
              </p>
            </div>
            <Switch
              checked={generateAudio}
              onCheckedChange={setGenerateAudio}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-transparent p-5">
        <div className="text-[11px] uppercase tracking-wider text-fuchsia-300">
          Coût estimé
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">
            {totalCredits}
          </span>
          <span className="text-sm text-muted-foreground">crédits</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {duration}s · {resolution} ·{" "}
          {pricing.data?.creditsPerSec[resolution] ?? 0} cr/s · retenus à
          l&apos;envoi, remboursés en cas d&apos;échec.
        </div>

        {duration === 30 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            Une prise 30&nbsp;s consomme le maximum de crédits Seedance. Choix
            explicite requis avant de lancer.
          </div>
        )}

        {confirmingBigCost ? (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
            <span>
              Confirme : <b>{totalCredits} crédits</b> pour {duration}s en{" "}
              {resolution}. Refund automatique en cas d&apos;échec.
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConfirmingBigCost(false)}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                className="bg-fuchsia-500 hover:bg-fuchsia-400"
                onClick={submit}
                disabled={create.isPending}
              >
                {create.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Envoi…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Oui, générer {totalCredits} cr
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className={cn(
              "mt-4 w-full justify-center bg-fuchsia-500 text-white hover:bg-fuchsia-400 focus-visible:ring-fuchsia-500",
              !canSubmit && "cursor-not-allowed opacity-60"
            )}
          >
            {create.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi à Seedance…
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Générer — {totalCredits} crédits
              </>
            )}
          </Button>
        )}
      </div>

      {pricing.data && (
        <PricingTable
          pricing={pricing.data}
          highlight={{ resolution, durationSec: duration }}
        />
      )}

      {activeQuery.data && (
        <JobCard job={activeQuery.data as SceneJob} highlighted />
      )}

      {list.data && list.data.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Dernières scènes
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {list.data
              .filter((j) => j.id !== activeJobId)
              .map((j) => (
                <JobCard
                  key={j.id}
                  job={j as SceneJob}
                  onOpen={() => setActiveJobId(j.id)}
                />
              ))}
          </div>
        </div>
      )}

      {list.data && list.data.length === 0 && !activeJobId && (
        <Alert>
          <AlertTitle>Aucune scène pour ce personnage</AlertTitle>
          <AlertDescription>
            Lance ta première prise en 10, 15 ou 30 secondes. Le visage reste
            verrouillé sur ton pack identité (@Image1…) — pas besoin
            d&apos;uploader une vidéo source (c&apos;est le remix qui fait
            ça).
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function DurationPicker(props: {
  value: SeedanceDuration;
  onChange: (v: SeedanceDuration) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-slate-300">Durée</Label>
      <div className="grid grid-cols-3 gap-2">
        {SEEDANCE_ALLOWED_DURATIONS.map((d) => {
          const active = props.value === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => props.onChange(d)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-fuchsia-400 bg-fuchsia-500/10 text-foreground"
                  : "border-border bg-background/40 text-foreground hover:border-fuchsia-400/40"
              )}
            >
              {d}s
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResolutionPicker(props: {
  value: SeedanceResolution;
  onChange: (v: SeedanceResolution) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-slate-300">Résolution</Label>
      <div className="grid grid-cols-2 gap-2">
        {SEEDANCE_ALLOWED_RESOLUTIONS.map((r) => {
          const active = props.value === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => props.onChange(r)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
                active
                  ? "border-fuchsia-400 bg-fuchsia-500/10"
                  : "border-border bg-background/40 hover:border-fuchsia-400/40"
              )}
            >
              <span className="text-sm font-medium text-foreground">
                {RESOLUTION_LABELS[r]}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {RESOLUTION_HINTS[r]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PricingTable(props: {
  pricing: {
    matrix: Array<{
      resolution: SeedanceResolution;
      durationSec: SeedanceDuration;
      credits: number;
    }>;
    creditsPerSec: Record<SeedanceResolution, number>;
  };
  highlight: { resolution: SeedanceResolution; durationSec: SeedanceDuration };
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Barème Seedance
        </p>
        <span className="text-[10px] text-muted-foreground">
          crédits par seconde
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-background/60 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Résolution</th>
              <th className="px-3 py-2 font-medium">cr/s</th>
              <th className="px-3 py-2 font-medium">10s</th>
              <th className="px-3 py-2 font-medium">15s</th>
              <th className="px-3 py-2 font-medium">30s</th>
            </tr>
          </thead>
          <tbody>
            {SEEDANCE_ALLOWED_RESOLUTIONS.map((r) => (
              <tr
                key={r}
                className="border-t border-border text-foreground/90"
              >
                <td className="px-3 py-2 font-medium">{r}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {props.pricing.creditsPerSec[r]}
                </td>
                {([10, 15, 30] as const).map((d) => {
                  const cell = props.pricing.matrix.find(
                    (m) => m.resolution === r && m.durationSec === d
                  );
                  const active =
                    props.highlight.resolution === r &&
                    props.highlight.durationSec === d;
                  return (
                    <td
                      key={d}
                      className={cn(
                        "px-3 py-2",
                        active &&
                          "bg-fuchsia-500/15 font-semibold text-fuchsia-100"
                      )}
                    >
                      {cell?.credits ?? "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobCard({
  job,
  onOpen,
  highlighted,
}: {
  job: SceneJob;
  onOpen?: () => void;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-xs",
        highlighted
          ? "border-fuchsia-500/40 bg-fuchsia-500/5"
          : "border-slate-800 bg-slate-900/40"
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-slate-200">
          {new Date(job.createdAt).toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
        <StatusBadge status={job.status} />
      </div>
      <p className="line-clamp-2 text-slate-400">{job.prompt}</p>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {job.durationSec}s · {job.resolution} · {job.creditsCharged} crédits
      </div>
      {job.status === "COMPLETED" && job.outputVideoUrl && (
        <video
          controls
          src={job.outputVideoUrl}
          className="mt-2 aspect-[9/16] w-40 rounded-lg bg-black"
        />
      )}
      {(job.status === "REFUNDED" || job.status === "FAILED") && job.error && (
        <p className="mt-2 text-red-300">{job.error}</p>
      )}
      {(job.status === "PENDING" || job.status === "IN_PROGRESS") && (
        <p className="mt-2 flex items-center gap-1.5 text-fuchsia-300">
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

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "PENDING":
    case "IN_PROGRESS":
      return (
        <Badge className="bg-fuchsia-500/20 text-fuchsia-200">En cours</Badge>
      );
    case "COMPLETED":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-300">Prêt</Badge>
      );
    case "FAILED":
      return <Badge className="bg-red-500/20 text-red-300">Échec</Badge>;
    case "REFUNDED":
      return <Badge className="bg-red-500/20 text-red-300">Remboursé</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}
