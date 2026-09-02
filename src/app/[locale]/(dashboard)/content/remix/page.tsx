"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Upload,
  Video,
  Sparkles,
  Play,
  RefreshCw,
  Info,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useInfluencers } from "@/hooks/use-influencers";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REMIX_ALLOWED_DURATIONS,
  REMIX_ALLOWED_MIME_TYPES,
  REMIX_MAX_SOURCE_BYTES,
  REMIX_MAX_SOURCE_DURATION_SEC,
  REMIX_TIER_VALUES,
  REMIX_TIERS,
  clampRemixDuration,
  estimateRemixCreditsForTier,
  resolveRemixOembedProvider,
  validateRemixSource,
  type RemixDuration,
  type RemixTier,
} from "@/lib/remix-config";

interface UploadedSource {
  url: string;
  sizeBytes: number;
  mimeType: string;
  durationSec: number;
  fileName: string;
}

interface OembedPreview {
  title?: string;
  authorName?: string;
  providerName?: string;
  thumbnailUrl?: string;
  url?: string;
}

export default function RemixCreatorPage() {
  const { data: influencersData, isLoading: influencersLoading } =
    useInfluencers();
  const influencers = useMemo(
    () => influencersData?.influencers ?? [],
    [influencersData]
  );

  const [influencerId, setInfluencerId] = useState<string>("");
  const [tier, setTier] = useState<RemixTier>("standard");
  const [requestedDuration, setRequestedDuration] = useState<RemixDuration>(10);
  const [keepAudio, setKeepAudio] = useState(true);
  const [linkUrl, setLinkUrl] = useState("");
  const [oembedPreview, setOembedPreview] = useState<OembedPreview | null>(
    null
  );
  const [oembedLoading, setOembedLoading] = useState(false);
  const [source, setSource] = useState<UploadedSource | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!influencerId && influencers.length > 0) {
      setInfluencerId(influencers[0].id);
    }
  }, [influencers, influencerId]);

  const effectiveDuration = useMemo(
    () => clampRemixDuration(requestedDuration, source?.durationSec ?? null),
    [requestedDuration, source?.durationSec]
  );
  const totalCredits = useMemo(
    () => estimateRemixCreditsForTier(tier, effectiveDuration),
    [tier, effectiveDuration]
  );

  const sourceIssue = useMemo(() => {
    if (!source) return null;
    return validateRemixSource({
      mimeType: source.mimeType,
      sizeBytes: source.sizeBytes,
      durationSec: source.durationSec,
      url: source.url,
    });
  }, [source]);

  const linkProvider = useMemo(
    () => (linkUrl.trim() ? resolveRemixOembedProvider(linkUrl.trim()) : null),
    [linkUrl]
  );

  const oembedQuery = trpc.remix.oembedPreview.useQuery(
    { url: linkUrl.trim() },
    {
      enabled: Boolean(linkProvider) && linkUrl.trim().length > 8,
      staleTime: 5 * 60_000,
    }
  );

  useEffect(() => {
    setOembedLoading(oembedQuery.isFetching);
    if (oembedQuery.data?.available && oembedQuery.data.preview) {
      const p = oembedQuery.data.preview;
      setOembedPreview({
        title: p.title,
        authorName: p.authorName,
        providerName: p.providerName,
        thumbnailUrl: p.thumbnailUrl,
        url: p.url,
      });
    } else if (oembedQuery.data && !oembedQuery.data.available) {
      setOembedPreview(null);
    }
  }, [oembedQuery.data, oembedQuery.isFetching]);

  const utils = trpc.useUtils();
  const createRemix = trpc.remix.createRemix.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Remix lancé — ${result.cost} crédits mis en attente. Génération en cours…`
      );
      setActiveJobId(result.jobId);
      utils.remix.listRemixes.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Impossible de lancer le remix.");
    },
  });

  const handleFileSelected = useCallback(async (file: File) => {
    const issue = validateRemixSource({
      mimeType: file.type,
      sizeBytes: file.size,
      durationSec: null,
      url: "https://placeholder",
    });
    if (issue) {
      toast.error(issue.message);
      return;
    }

    // Probe duration client-side via <video> element.
    const durationSec = await probeVideoDuration(file);
    const durationIssue = validateRemixSource({
      mimeType: file.type,
      sizeBytes: file.size,
      durationSec,
      url: "https://placeholder",
    });
    if (durationIssue) {
      toast.error(durationIssue.message);
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/remix/source-upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: "Upload failed" })));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        ok: boolean;
        url: string;
        sizeBytes: number;
        mime: string;
      };
      setSource({
        url: data.url,
        sizeBytes: data.sizeBytes,
        mimeType: data.mime,
        durationSec,
        fileName: file.name,
      });
      toast.success("Clip source uploadé.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de l'upload du clip."
      );
    } finally {
      setUploading(false);
    }
  }, []);

  const submit = useCallback(() => {
    if (!influencerId) {
      toast.error("Choisis un personnage avant de générer.");
      return;
    }
    if (!source) {
      toast.error("Uploade un clip source avant de générer.");
      return;
    }
    if (sourceIssue) {
      toast.error(sourceIssue.message);
      return;
    }
    createRemix.mutate({
      influencerId,
      tier,
      sourceVideoUrl: source.url,
      sourceDurationSec: source.durationSec,
      sourceMimeType: source.mimeType,
      sourceSizeBytes: source.sizeBytes,
      duration: effectiveDuration,
      keepAudio,
      oembedPreview: oembedPreview ?? undefined,
    });
  }, [
    createRemix,
    effectiveDuration,
    influencerId,
    keepAudio,
    oembedPreview,
    source,
    sourceIssue,
    tier,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto flex max-w-5xl flex-col gap-6"
    >
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fuchsia-400">
          <Sparkles className="h-4 w-4" />
          Remix viral V1
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Refais un TikTok ou un Reel avec ton personnage
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Uploade un clip TikTok / Reel : ton personnage verrouillé rejoue le
          mouvement, en 9:16, 5 à 15 s. Kling O3 conserve la caméra et le
          timing de la source ; l&apos;identité vient de tes portraits déjà
          générés.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card/60 p-5">
          <InfluencerPicker
            influencers={influencers}
            isLoading={influencersLoading}
            value={influencerId}
            onChange={setInfluencerId}
          />

          <LinkPreviewField
            linkUrl={linkUrl}
            onLinkUrlChange={setLinkUrl}
            provider={linkProvider?.provider}
            preview={oembedPreview}
            loading={oembedLoading}
          />

          <DropZone
            source={source}
            uploading={uploading}
            onFile={handleFileSelected}
            onClear={() => setSource(null)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TierPicker value={tier} onChange={setTier} />
            <DurationPicker
              value={requestedDuration}
              onChange={setRequestedDuration}
              effective={effectiveDuration}
              sourceDurationSec={source?.durationSec ?? null}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-4 py-3">
            <div>
              <Label className="text-sm">Garder l&apos;audio source</Label>
              <p className="text-xs text-muted-foreground">
                Coupe la piste si tu comptes ajouter une voix ou une musique
                après.
              </p>
            </div>
            <Switch checked={keepAudio} onCheckedChange={setKeepAudio} />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5">
          <CostPreview
            tier={tier}
            duration={effectiveDuration}
            totalCredits={totalCredits}
          />

          <button
            type="button"
            onClick={submit}
            disabled={
              !influencerId ||
              !source ||
              !!sourceIssue ||
              createRemix.isPending ||
              uploading
            }
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg bg-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition-colors hover:bg-fuchsia-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:cursor-not-allowed disabled:bg-fuchsia-500/50"
            )}
          >
            {createRemix.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Envoi à Kling…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Générer — {totalCredits} crédits
              </>
            )}
          </button>

          {sourceIssue && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {sourceIssue.message}
            </div>
          )}

          <div className="rounded-lg border border-border bg-background/40 px-4 py-3 text-xs text-muted-foreground">
            <div className="mb-1 font-medium text-foreground">
              Comment ça marche
            </div>
            V1 : upload obligatoire. Les URLs TikTok / Instagram servent
            uniquement d&apos;aperçu (oEmbed public — titre + cover). On ne
            télécharge jamais le média chez eux.
          </div>

          <RecentJobs influencerId={influencerId} activeJobId={activeJobId} />
        </section>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function InfluencerPicker(props: {
  influencers: Array<{ id: string; name: string; avatarUrl: string | null }>;
  isLoading: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">Personnage</Label>
      {props.isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : props.influencers.length === 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Crée d&apos;abord un personnage — le remix se base sur ses portraits.
        </div>
      ) : (
        <Select value={props.value} onValueChange={props.onChange}>
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="Choisir un personnage" />
          </SelectTrigger>
          <SelectContent>
            {props.influencers.map((inf) => (
              <SelectItem key={inf.id} value={inf.id}>
                {inf.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function LinkPreviewField(props: {
  linkUrl: string;
  onLinkUrlChange: (v: string) => void;
  provider?: string;
  preview: OembedPreview | null;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <LinkIcon className="h-3.5 w-3.5" />
        Lien TikTok / Reel (aperçu seul)
      </Label>
      <Input
        type="url"
        placeholder="https://www.tiktok.com/@…/video/…"
        value={props.linkUrl}
        onChange={(e) => props.onLinkUrlChange(e.target.value)}
      />
      {props.loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Aperçu…
        </div>
      )}
      {props.preview && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-3">
          {props.preview.thumbnailUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={props.preview.thumbnailUrl}
              alt=""
              className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-slate-800">
              <Video className="h-6 w-6 text-slate-500" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-foreground">
              {props.preview.title ?? "Aperçu"}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {props.preview.authorName ?? props.preview.providerName}
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            Aperçu seul
          </Badge>
        </div>
      )}
      {props.linkUrl.trim() && !props.provider && (
        <div className="text-xs text-muted-foreground">
          Lien non reconnu — cet aperçu ne fonctionne que pour TikTok / Reel.
        </div>
      )}
    </div>
  );
}

function DropZone(props: {
  source: UploadedSource | null;
  uploading: boolean;
  onFile: (file: File) => void | Promise<void>;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void props.onFile(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">Clip source (MP4 / MOV)</Label>
      <input
        ref={inputRef}
        type="file"
        accept={REMIX_ALLOWED_MIME_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            void props.onFile(f);
            e.currentTarget.value = "";
          }
        }}
      />
      {props.source ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <Video className="h-6 w-6 text-emerald-300" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-foreground">
              {props.source.fileName}
            </div>
            <div className="text-xs text-muted-foreground">
              {Math.round(props.source.durationSec)}s ·{" "}
              {(props.source.sizeBytes / 1024 / 1024).toFixed(1)} Mo
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClear}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Remplacer
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-sm transition-colors",
            dragging
              ? "border-fuchsia-400/70 bg-fuchsia-500/5"
              : "border-border bg-background/30 hover:border-fuchsia-400/40"
          )}
        >
          {props.uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Upload en cours…</span>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <div className="text-foreground">
                Glisse ton MP4 / MOV ici ou clique pour choisir
              </div>
              <div className="text-xs text-muted-foreground">
                3 à {REMIX_MAX_SOURCE_DURATION_SEC}s · max{" "}
                {Math.floor(REMIX_MAX_SOURCE_BYTES / 1024 / 1024)} Mo
              </div>
            </>
          )}
        </button>
      )}
    </div>
  );
}

function TierPicker(props: {
  value: RemixTier;
  onChange: (v: RemixTier) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">Qualité</Label>
      <div className="grid grid-cols-2 gap-2">
        {REMIX_TIER_VALUES.map((t) => {
          const cfg = REMIX_TIERS[t];
          const active = props.value === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => props.onChange(t)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors",
                active
                  ? "border-fuchsia-400 bg-fuchsia-500/10"
                  : "border-border bg-background/40 hover:border-fuchsia-400/40"
              )}
            >
              <span className="text-sm font-medium text-foreground">
                {cfg.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {cfg.creditsPerSec} crédits / s
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DurationPicker(props: {
  value: RemixDuration;
  onChange: (v: RemixDuration) => void;
  effective: RemixDuration;
  sourceDurationSec: number | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">Durée</Label>
      <div className="grid grid-cols-3 gap-2">
        {REMIX_ALLOWED_DURATIONS.map((d) => {
          const disabled =
            props.sourceDurationSec !== null && d > props.sourceDurationSec + 1;
          const active = props.value === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => props.onChange(d)}
              disabled={disabled}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-fuchsia-400 bg-fuchsia-500/10 text-foreground"
                  : "border-border bg-background/40 text-foreground hover:border-fuchsia-400/40",
                disabled && "cursor-not-allowed opacity-40"
              )}
            >
              {d}s
            </button>
          );
        })}
      </div>
      {props.effective !== props.value && (
        <div className="text-xs text-amber-300">
          Durée limitée à {props.effective}s par la source.
        </div>
      )}
    </div>
  );
}

function CostPreview(props: {
  tier: RemixTier;
  duration: RemixDuration;
  totalCredits: number;
}) {
  return (
    <div className="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-transparent p-4">
      <div className="text-xs uppercase tracking-wider text-fuchsia-300">
        Coût estimé
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">
          {props.totalCredits}
        </span>
        <span className="text-sm text-muted-foreground">crédits</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {REMIX_TIERS[props.tier].label} · {props.duration}s ·{" "}
        {REMIX_TIERS[props.tier].creditsPerSec} cr/s · retenus à
        l&apos;envoi, remboursés en cas d&apos;échec.
      </div>
    </div>
  );
}

function RecentJobs(props: {
  influencerId: string;
  activeJobId: string | null;
}) {
  const list = trpc.remix.listRemixes.useQuery(
    { influencerId: props.influencerId || undefined, limit: 6 },
    {
      enabled: Boolean(props.influencerId),
      refetchInterval: props.activeJobId ? 4_000 : false,
    }
  );

  const jobs = list.data ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Derniers remixes
        </span>
        <button
          type="button"
          onClick={() => list.refetch()}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
          Rafraîchir
        </button>
      </div>
      {jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Aucun remix pour l&apos;instant.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow(props: {
  job: {
    id: string;
    status: string;
    durationSec: number;
    creditsCharged: number;
    outputVideoUrl: string | null;
    error: string | null;
  };
}) {
  const { job } = props;
  const statusMeta = STATUS_META[job.status] ?? STATUS_META.PENDING;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3">
      {job.outputVideoUrl ? (
        <a
          href={job.outputVideoUrl}
          target="_blank"
          rel="noreferrer"
          className="flex h-14 w-10 items-center justify-center rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700"
        >
          <Play className="h-5 w-5" />
        </a>
      ) : (
        <div className="flex h-14 w-10 items-center justify-center rounded-md bg-slate-800/60">
          {job.status === "IN_PROGRESS" ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : (
            <Video className="h-4 w-4 text-slate-500" />
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge className={cn("border-0 text-[10px]", statusMeta.color)}>
            {statusMeta.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {job.durationSec}s · {job.creditsCharged} crédits
          </span>
        </div>
        {job.error && (
          <div className="mt-1 truncate text-xs text-red-400">{job.error}</div>
        )}
      </div>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: "En attente", color: "bg-slate-600 text-slate-200" },
  IN_PROGRESS: { label: "En cours", color: "bg-amber-600 text-amber-100" },
  COMPLETED: { label: "Prêt", color: "bg-emerald-600 text-emerald-100" },
  FAILED: { label: "Échec", color: "bg-red-600 text-red-100" },
  REFUNDED: { label: "Remboursé", color: "bg-red-600/80 text-red-100" },
};

// ──────────────────────────────────────────────
// Helpers (client)
// ──────────────────────────────────────────────

/**
 * Probe a video file for its duration in seconds via an off-screen
 * `<video>` element. Falls back to 0 on failure (server will re-validate).
 */
function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.src = "";
    };
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      cleanup();
      resolve(d);
    };
    video.onerror = () => {
      cleanup();
      resolve(0);
    };
  });
}
