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
import { formatGenerationErrorForUser } from "@/lib/generation-errors";
import { trpc } from "@/lib/trpc";

interface SeedanceStudioProps {
  influencerId: string;
  influencerName: string;
}

const POLL_INTERVAL_MS = 5_000;

const RESOLUTION_LABELS: Record<string, string> = {
  "480p": "480p · brouillon",
  "720p": "720p · qualité HD",
};

const RESOLUTION_HINTS: Record<string, string> = {
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
  const [duration, setDuration] = useState(10);
  const [resolution, setResolution] = useState("720p");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [confirmingBigCost, setConfirmingBigCost] = useState(false);

  const pricing = trpc.seedance.pricing.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const isKling = pricing.data?.engine === "kling_o3_i2v";
  const allowedDurations = pricing.data?.allowedDurations ?? [5, 10, 15];
  const allowedResolutions = pricing.data?.allowedResolutions ?? [];
  const showResolution = allowedResolutions.length > 0;
  const pricingLabel = pricing.data?.label ?? "Vidéo scène (Kling)";

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

  useEffect(() => {
    if (!pricing.data) return;
    if (!pricing.data.allowedDurations.includes(duration)) {
      setDuration(pricing.data.defaultDurationSec);
    }
    if (
      pricing.data.allowedResolutions.length > 0 &&
      pricing.data.defaultResolution &&
      !pricing.data.allowedResolutions.includes(resolution)
    ) {
      setResolution(pricing.data.defaultResolution);
    }
  }, [duration, pricing.data, resolution]);

  const totalCredits = useMemo(() => {
    if (!pricing.data) return 0;
    if (pricing.data.engine === "kling_o3_i2v") {
      const row = pricing.data.matrix.find(
        (m) => m.durationSec === duration && m.generateAudio === generateAudio
      );
      return row?.credits ?? 0;
    }
    const row = pricing.data.matrix.find(
      (m) => m.resolution === resolution && m.durationSec === duration
    );
    return row?.credits ?? 0;
  }, [duration, generateAudio, pricing.data, resolution]);

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
      toast.error(err.message || "Impossible de lancer la vidéo scène.");
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
    if (duration === 30 && !confirmingBigCost) {
      setConfirmingBigCost(true);
      return;
    }
    create.mutate({
      influencerId,
      scenePrompt: trimmed,
      duration: duration as 5 | 10 | 15 | 30,
      resolution: (showResolution ? resolution : "720p") as "480p" | "720p",
      generateAudio,
      quotedCredits: totalCredits,
    });
  };

  const creditsPerSecLabel = isKling
    ? generateAudio
      ? pricing.data?.creditsPerSecAudioOn
      : pricing.data?.creditsPerSecAudioOff
    : pricing.data?.creditsPerSec[resolution];

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
              Prompt scène (portrait frontal du personnage)
            </Label>
            <Textarea
              value={scenePrompt}
              onChange={(e) => setScenePrompt(e.target.value)}
              rows={4}
              placeholder={`Ex : ${influencerName} traverse un café ensoleillé, regarde vers la caméra, natural motion.`}
              maxLength={1200}
              className="min-h-[120px]"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {scenePrompt.length} / 1200 caractères
            </p>
          </div>

          <div
            className={cn(
              "grid gap-3",
              showResolution ? "sm:grid-cols-2" : "sm:grid-cols-1"
            )}
          >
            <DurationPicker
              value={duration}
              options={allowedDurations}
              onChange={setDuration}
            />
            {showResolution && (
              <ResolutionPicker
                value={resolution}
                options={allowedResolutions}
                onChange={setResolution}
              />
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-4 py-3">
            <div>
              <Label className="text-sm">Audio natif (voix + ambiance)</Label>
              <p className="text-[11px] text-muted-foreground">
                {isKling
                  ? "Kling génère la piste audio en même temps que la vidéo. Coupe si tu comptes ré-doubler ensuite."
                  : "La piste audio est générée en même temps que la vidéo. Coupe si tu comptes ré-doubler ensuite."}
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
          {duration}s
          {showResolution ? ` · ${resolution}` : ""}
          {isKling ? ` · audio ${generateAudio ? "ON" : "OFF"}` : ""} ·{" "}
          {creditsPerSecLabel ?? 0} cr/s · retenus à l&apos;envoi, remboursés
          en cas d&apos;échec.
        </div>

        {duration === 30 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            Une prise 30&nbsp;s consomme le maximum de crédits. Choix
            explicite requis avant de lancer.
          </div>
        )}

        {confirmingBigCost ? (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
            <span>
              Confirme : <b>{totalCredits} crédits</b> pour {duration}s
              {showResolution ? ` en ${resolution}` : ""}. Refund automatique
              en cas d&apos;échec.
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
                Envoi…
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
          label={pricingLabel}
          engine={pricing.data.engine}
          pricing={pricing.data}
          highlight={{
            resolution,
            durationSec: duration,
            generateAudio,
          }}
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
            Lance ta première prise en 5, 10 ou 15 secondes. Le portrait
            frontal verrouille le personnage — pas besoin d&apos;uploader une
            vidéo source (c&apos;est le remix qui fait ça).
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
  value: number;
  options: number[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-slate-300">Durée</Label>
      <div className="grid grid-cols-3 gap-2">
        {props.options.map((d) => {
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
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-slate-300">Résolution</Label>
      <div className="grid grid-cols-2 gap-2">
        {props.options.map((r) => {
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
                {RESOLUTION_LABELS[r] ?? r}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {RESOLUTION_HINTS[r] ?? ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PricingTable(props: {
  label: string;
  engine: string;
  pricing: {
    matrix: Array<{
      resolution: string | null;
      durationSec: number;
      generateAudio: boolean;
      credits: number;
    }>;
    creditsPerSec: Record<string, number>;
    creditsPerSecAudioOff: number;
    creditsPerSecAudioOn: number;
    allowedDurations: number[];
    allowedResolutions: string[];
  };
  highlight: {
    resolution: string;
    durationSec: number;
    generateAudio: boolean;
  };
}) {
  if (props.engine === "kling_o3_i2v") {
    const audioRows = [
      {
        key: "off",
        label: "Audio OFF",
        generateAudio: false,
        perSec: props.pricing.creditsPerSecAudioOff,
      },
      {
        key: "on",
        label: "Audio ON",
        generateAudio: true,
        perSec: props.pricing.creditsPerSecAudioOn,
      },
    ] as const;
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Barème {props.label}
          </p>
          <span className="text-[10px] text-muted-foreground">
            durée × audio
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-background/60 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Audio</th>
                <th className="px-3 py-2 font-medium">cr/s</th>
                {props.pricing.allowedDurations.map((d) => (
                  <th key={d} className="px-3 py-2 font-medium">
                    {d}s
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audioRows.map((row) => (
                <tr
                  key={row.key}
                  className="border-t border-border text-foreground/90"
                >
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.perSec}
                  </td>
                  {props.pricing.allowedDurations.map((d) => {
                    const cell = props.pricing.matrix.find(
                      (m) =>
                        m.durationSec === d &&
                        m.generateAudio === row.generateAudio
                    );
                    const active =
                      props.highlight.durationSec === d &&
                      props.highlight.generateAudio === row.generateAudio;
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

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Barème {props.label}
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
              {props.pricing.allowedDurations.map((d) => (
                <th key={d} className="px-3 py-2 font-medium">
                  {d}s
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.pricing.allowedResolutions.map((r) => (
              <tr
                key={r}
                className="border-t border-border text-foreground/90"
              >
                <td className="px-3 py-2 font-medium">{r}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {props.pricing.creditsPerSec[r]}
                </td>
                {props.pricing.allowedDurations.map((d) => {
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
  const resolutionLabel =
    job.resolution === "standard" || !job.resolution
      ? null
      : job.resolution;
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
        {job.durationSec}s
        {resolutionLabel ? ` · ${resolutionLabel}` : ""} ·{" "}
        {job.creditsCharged} crédits
      </div>
      {job.status === "COMPLETED" && job.outputVideoUrl && (
        <video
          controls
          src={job.outputVideoUrl}
          className="mt-2 aspect-[9/16] w-40 rounded-lg bg-black"
        />
      )}
      {(job.status === "REFUNDED" || job.status === "FAILED") && job.error && (
        <p className="mt-2 text-red-300">
          {formatGenerationErrorForUser(job.error)}
        </p>
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
