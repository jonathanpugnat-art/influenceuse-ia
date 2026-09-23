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
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useInfluencers } from "@/hooks/use-influencers";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateCurrentPlan } from "@/hooks/use-current-plan";
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
  allowedRemixDurations,
  remixMaxDurationSec,
  REMIX_ALLOWED_MIME_TYPES,
  REMIX_MAX_SOURCE_BYTES,
  REMIX_TIER_VALUES,
  REMIX_TIERS,
  clampRemixDuration,
  estimateRemixCreditsForTier,
  resolveRemixOembedProvider,
  validateRemixSource,
  type RemixDuration,
  type RemixOrientation,
  type RemixTier,
} from "@/lib/remix-config";
import { formatGenerationErrorForUser } from "@/lib/generation-errors";
import {
  identityHintState,
  identityPackUnavailableCopy,
  identityPreviewRefetchInterval,
  resolveDisplayedIdentityPackStatus,
  settleIdentityRetryWatch,
  IDENTITY_RETRY_WATCH_MS,
  type IdentityRetryWatch,
} from "@/lib/remix-identity-hint";
import { CREDIT_COSTS } from "@/lib/constants";

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
  const [orientation, setOrientation] = useState<RemixOrientation>("video");
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

  const allowedDurations = useMemo(
    () => allowedRemixDurations(orientation),
    [orientation]
  );
  const maxSourceSec = remixMaxDurationSec(orientation);

  useEffect(() => {
    if (!allowedDurations.includes(requestedDuration)) {
      setRequestedDuration(allowedDurations[allowedDurations.length - 1]);
    }
  }, [allowedDurations, requestedDuration]);

  const effectiveDuration = useMemo(
    () =>
      clampRemixDuration(
        requestedDuration,
        source?.durationSec ?? null,
        orientation
      ),
    [requestedDuration, source?.durationSec, orientation]
  );
  const totalCredits = useMemo(
    () => estimateRemixCreditsForTier(tier, effectiveDuration),
    [tier, effectiveDuration]
  );

  const sourceIssue = useMemo(() => {
    if (!source) return null;
    return validateRemixSource(
      {
        mimeType: source.mimeType,
        sizeBytes: source.sizeBytes,
        durationSec: source.durationSec,
        url: source.url,
      },
      orientation
    );
  }, [source, orientation]);

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
  const invalidatePlan = useInvalidateCurrentPlan();
  const createRemix = trpc.remix.createRemix.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Remix lancé — ${result.cost} crédits mis en attente. Génération en cours…`
      );
      setActiveJobId(result.jobId);
      utils.remix.listRemixes.invalidate();
      // The server side already held `result.cost` credits; the sidebar
      // was still showing the pre-hold balance until the next natural
      // refetch (QA saw 4618.3 after a 100-credit hold). Refetch the same
      // billing.getCurrentPlan query the sidebar reads from.
      invalidatePlan();
    },
    onError: (err) => {
      toast.error(err.message || "Impossible de lancer le remix.");
    },
  });

  const handleFileSelected = useCallback(async (file: File) => {
    const issue = validateRemixSource(
      {
        mimeType: file.type,
        sizeBytes: file.size,
        durationSec: null,
        url: "https://placeholder",
      },
      orientation
    );
    if (issue) {
      toast.error(issue.message);
      return;
    }

    // Probe duration client-side via <video> element.
    const durationSec = await probeVideoDuration(file);
    const durationIssue = validateRemixSource(
      {
        mimeType: file.type,
        sizeBytes: file.size,
        durationSec,
        url: "https://placeholder",
      },
      orientation
    );
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
  }, [orientation]);

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
      characterOrientation: orientation,
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
    orientation,
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
          Remix viral V2
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Refais un TikTok ou un Reel avec ton personnage
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Uploade un clip TikTok / Reel : ton personnage verrouillé rejoue le
          mouvement. On cascade Kling Motion Control, Viggle puis Wan replace
          selon la disponibilité (corps entier jusqu&apos;à 30 s, caméra
          jusqu&apos;à 10 s). L&apos;identité vient de tes portraits déjà
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

          <IdentityHealthHint influencerId={influencerId} />

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
            maxDurationSec={maxSourceSec}
            onFile={handleFileSelected}
            onClear={() => setSource(null)}
          />

          <OrientationPicker value={orientation} onChange={setOrientation} />

          <div className="grid gap-4 sm:grid-cols-2">
            <TierPicker value={tier} onChange={setTier} />
            <DurationPicker
              value={requestedDuration}
              onChange={setRequestedDuration}
              allowed={allowedDurations}
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
                Envoi du remix…
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

function IdentityHealthHint(props: { influencerId: string }) {
  const utils = trpc.useUtils();
  const invalidatePlan = useInvalidateCurrentPlan();
  const influencerIdRef = useRef(props.influencerId);
  influencerIdRef.current = props.influencerId;

  // Armed when regenerate returns, before scheduleAfter writes `generating`.
  // A ref so refetchInterval sees it on the invalidate that follows, without
  // waiting for a React commit. State drives the optimistic waiting banner.
  const retryWatchRef = useRef<IdentityRetryWatch | null>(null);
  const [retryWatch, setRetryWatch] = useState<IdentityRetryWatch | null>(
    null
  );
  const [inflight, setInflight] = useState<
    ReadonlyMap<string, "generate" | "regenerate">
  >(() => new Map());

  const setWatch = useCallback((next: IdentityRetryWatch | null) => {
    retryWatchRef.current = next;
    setRetryWatch(next);
  }, []);

  const markInflight = useCallback(
    (influencerId: string, kind: "generate" | "regenerate") => {
      setInflight((prev) => {
        const next = new Map(prev);
        next.set(influencerId, kind);
        return next;
      });
    },
    []
  );

  const clearInflight = useCallback((influencerId: string) => {
    setInflight((prev) => {
      if (!prev.has(influencerId)) return prev;
      const next = new Map(prev);
      next.delete(influencerId);
      return next;
    });
  }, []);

  const query = trpc.remix.identityPreview.useQuery(
    { influencerId: props.influencerId },
    {
      enabled: Boolean(props.influencerId),
      staleTime: 30_000,
      // Poll while the pack is building, and also during the gap after a
      // retry returns — the row can still read `failed` until scheduleAfter
      // flips it to `generating`. Without the watch, that first refetch
      // stops polling and the banner stays on retry.
      refetchInterval: (q) =>
        identityPreviewRefetchInterval({
          status: q.state.data?.identityPackStatus,
          watch: retryWatchRef.current,
          influencerId: props.influencerId,
          now: Date.now(),
        }),
    }
  );

  useEffect(() => {
    const next = settleIdentityRetryWatch({
      watch: retryWatchRef.current,
      influencerId: props.influencerId,
      status: query.data?.identityPackStatus,
      now: Date.now(),
    });
    if (next !== retryWatchRef.current) {
      retryWatchRef.current = next;
      setRetryWatch(next);
    }
  }, [props.influencerId, query.data?.identityPackStatus]);

  useEffect(() => {
    if (!retryWatch) return;
    const remaining =
      IDENTITY_RETRY_WATCH_MS - (Date.now() - retryWatch.startedAt);
    const timer = window.setTimeout(() => {
      const current = retryWatchRef.current;
      if (
        !current ||
        current.influencerId !== retryWatch.influencerId ||
        current.startedAt !== retryWatch.startedAt
      ) {
        return;
      }
      retryWatchRef.current = null;
      setRetryWatch(null);
    }, Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [retryWatch]);

  const generateMutation = trpc.influencer.generateIdentityPack.useMutation();
  const regenerateMutation =
    trpc.influencer.regenerateIdentityPack.useMutation();

  const notifyIfCurrent = useCallback(
    (influencerId: string, kind: "success" | "info" | "error", message: string) => {
      if (influencerIdRef.current !== influencerId) return;
      if (kind === "success") toast.success(message);
      else if (kind === "info") toast.info(message);
      else toast.error(message);
    },
    []
  );

  const startGenerate = useCallback(() => {
    const influencerId = props.influencerId;
    markInflight(influencerId, "generate");
    generateMutation.mutate(
      { influencerId },
      {
        onSuccess: () => {
          clearInflight(influencerId);
          notifyIfCurrent(
            influencerId,
            "success",
            "Pack d'identité prêt — le remix ancre maintenant le visage sur les 4 angles."
          );
          void utils.remix.identityPreview.invalidate({ influencerId });
          invalidatePlan();
        },
        onError: (err) => {
          clearInflight(influencerId);
          notifyIfCurrent(
            influencerId,
            "error",
            formatGenerationErrorForUser(err.message)
          );
        },
      }
    );
  }, [
    clearInflight,
    generateMutation,
    invalidatePlan,
    markInflight,
    notifyIfCurrent,
    props.influencerId,
    utils,
  ]);

  const startRegenerate = useCallback(() => {
    const influencerId = props.influencerId;
    markInflight(influencerId, "regenerate");
    regenerateMutation.mutate(
      { influencerId },
      {
        onSuccess: () => {
          clearInflight(influencerId);
          setWatch({ influencerId, startedAt: Date.now() });
          notifyIfCurrent(
            influencerId,
            "info",
            "Relance du pack d'identité — on retente les angles en arrière-plan."
          );
          void utils.remix.identityPreview.invalidate({ influencerId });
        },
        onError: (err) => {
          clearInflight(influencerId);
          notifyIfCurrent(
            influencerId,
            "error",
            formatGenerationErrorForUser(err.message)
          );
        },
      }
    );
  }, [
    clearInflight,
    markInflight,
    notifyIfCurrent,
    props.influencerId,
    regenerateMutation,
    setWatch,
    utils,
  ]);

  const data = query.data;
  if (!data) return null;

  const displayedStatus = resolveDisplayedIdentityPackStatus({
    status: data.identityPackStatus,
    watch: retryWatch,
    influencerId: props.influencerId,
    now: Date.now(),
  });
  const state = identityHintState({
    ...data,
    identityPackStatus: displayedStatus,
  });
  const inflightHere = inflight.get(props.influencerId);
  const isGenerating = state.kind === "generating" || inflightHere != null;

  switch (state.kind) {
    case "no_frontal":
      return (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Ce personnage n&apos;a pas encore de portrait de référence.
            Termine l&apos;assistant de création avant de lancer un remix —
            sinon le rendu perdra le visage.
          </span>
        </div>
      );

    case "generating":
      return (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <div className="flex items-start gap-2">
            <Loader2 className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin" />
            <span>
              Ton pack d&apos;identité (profil, 3/4, corps entier) est en
              cours de génération. Attends qu&apos;il soit prêt pour un
              rendu net — le bandeau passera au vert automatiquement.
            </span>
          </div>
          <button
            type="button"
            disabled
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-100/80 opacity-70"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            Génération du pack en cours…
          </button>
        </div>
      );

    case "failed":
      return (
        <div className="flex flex-col gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              La génération du pack d&apos;identité (profil, 3/4, corps
              entier) a échoué. Relance-la — les crédits ne sont pas
              redéduits pour ce retry.
            </span>
          </div>
          <button
            type="button"
            disabled={isGenerating}
            onClick={startRegenerate}
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-md border border-red-400/40 bg-red-500/20 px-2.5 py-1 text-[11px] font-medium text-red-50 transition-colors hover:bg-red-500/30",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
          >
            {inflightHere === "regenerate" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Relance en cours…
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                Réessayer la génération
              </>
            )}
          </button>
        </div>
      );

    case "missing":
      return (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Aucune photo secondaire (profil, 3/4, corps entier) n&apos;est
              disponible pour ce personnage. Le remix reste possible mais la
              fidélité corps entier sera moins bonne — génère le pack
              d&apos;identité pour ancrer le visage.
            </span>
          </div>
          <button
            type="button"
            disabled={isGenerating}
            onClick={startGenerate}
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-md border border-amber-400/50 bg-amber-500/25 px-2.5 py-1 text-[11px] font-medium text-amber-50 transition-colors hover:bg-amber-500/35",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
          >
            {inflightHere === "generate" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Génération du pack…
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                Générer le pack d&apos;identité — {CREDIT_COSTS.IDENTITY_PACK}{" "}
                crédits
              </>
            )}
          </button>
        </div>
      );

    case "unavailable":
      return (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{identityPackUnavailableCopy(state.reason)}</span>
        </div>
      );

    case "ok":
      return (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200/90">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Portrait + {state.referenceCount} photo
            {state.referenceCount > 1 ? "s" : ""} de référence détectées — le
            moteur ancre le visage avec ces stills (fidélité meilleure, pas
            de garantie biométrique).
          </span>
        </div>
      );

    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
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
  maxDurationSec: number;
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
                3 à {props.maxDurationSec}s · max{" "}
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

function OrientationPicker(props: {
  value: RemixOrientation;
  onChange: (v: RemixOrientation) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">Type de clip</Label>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            {
              id: "video" as const,
              title: "Corps entier / fitness",
              hint: "Suit le clip · jusqu'à 30 s",
            },
            {
              id: "image" as const,
              title: "Caméra / portrait",
              hint: "Suit le cadre · jusqu'à 10 s",
            },
          ] as const
        ).map((opt) => {
          const active = props.value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => props.onChange(opt.id)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors",
                active
                  ? "border-fuchsia-400 bg-fuchsia-500/10"
                  : "border-border bg-background/40 hover:border-fuchsia-400/40"
              )}
            >
              <span className="text-sm font-medium text-foreground">
                {opt.title}
              </span>
              <span className="text-xs text-muted-foreground">{opt.hint}</span>
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
  allowed: readonly RemixDuration[];
  effective: RemixDuration;
  sourceDurationSec: number | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">Durée</Label>
      <div
        className={cn(
          "grid gap-2",
          props.allowed.length > 3 ? "grid-cols-4" : "grid-cols-2"
        )}
      >
        {props.allowed.map((d) => {
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

  const invalidatePlan = useInvalidateCurrentPlan();
  const listData = list.data;
  const jobs = listData ?? [];

  // Watch the active job: when the reconcile poll flips it to a terminal
  // status the credit hold has been finalised (COMPLETED) or refunded
  // (REFUNDED / FAILED). Force a refetch of the same billing query the
  // sidebar reads from — otherwise QA sees the pre-hold balance stick.
  const activeStatus = useMemo(() => {
    if (!props.activeJobId || !listData) return null;
    return listData.find((j) => j.id === props.activeJobId)?.status ?? null;
  }, [listData, props.activeJobId]);
  const lastInvalidatedStatus = useRef<string | null>(null);
  useEffect(() => {
    if (!activeStatus) {
      lastInvalidatedStatus.current = null;
      return;
    }
    const isTerminal =
      activeStatus === "COMPLETED" ||
      activeStatus === "REFUNDED" ||
      activeStatus === "FAILED";
    if (isTerminal && lastInvalidatedStatus.current !== activeStatus) {
      lastInvalidatedStatus.current = activeStatus;
      invalidatePlan();
    }
  }, [activeStatus, invalidatePlan]);

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
    engineLabel: string;
    falRequestIdShort: string | null;
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
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("border-0 text-[10px]", statusMeta.color)}>
            {statusMeta.label}
          </Badge>
          <Badge
            variant="secondary"
            className="border border-border/60 bg-background/60 text-[10px] font-medium text-foreground"
          >
            {job.engineLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {job.durationSec}s · {job.creditsCharged} crédits
          </span>
          {job.falRequestIdShort && (
            <span
              className="font-mono text-[10px] text-muted-foreground/70"
              title="Identifiant de requête fournisseur (debug)"
            >
              {job.falRequestIdShort}
            </span>
          )}
        </div>
        {job.error && (
          <div className="mt-1 truncate text-xs text-red-400">
            {formatGenerationErrorForUser(job.error)}
          </div>
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
