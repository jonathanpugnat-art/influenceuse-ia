"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";

import { IconArrowLeft, IconCheck, IconCopy, IconDownload, IconPlay } from "@/components/icons";
import { IdentityBadge } from "@/components/identity-badge";
import { UpsellInline } from "@/components/upsell-inline";
import { useJobStatus } from "@/components/use-job-status";
import { FORMATS } from "@/lib/formats";
import { emitCreditsChanged, useCredits } from "@/lib/hooks/use-credits";
import type { Reel } from "@/lib/reels";

function nextFormatId(currentId: string | null, key: string): string | null {
  const forward = key === "ArrowDown" || key === "ArrowRight";
  const backward = key === "ArrowUp" || key === "ArrowLeft";
  if (!forward && !backward) return null;
  const index = Math.max(0, FORMATS.findIndex((format) => format.id === currentId));
  const next = FORMATS[(index + (forward ? 1 : -1) + FORMATS.length) % FORMATS.length];
  return next?.id ?? null;
}

type PostCreatorProps = {
  characterId: string;
  name: string;
  formatId?: string;
  reel?: Reel | null;
};

type Source =
  | { kind: "format"; id: string }
  | { kind: "reel"; id: string; tag: string };

const views = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

export function PostCreator({ characterId, name, formatId, reel }: PostCreatorProps) {
  const [source, setSource] = useState<Source | null>(
    reel ? { kind: "reel", id: reel.id, tag: reel.hashtag } : formatId ? { kind: "format", id: formatId } : null,
  );
  const [postId, setPostId] = useState<string | null>(null);
  const [imagePostId, setImagePostId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [mediaKind, setMediaKind] = useState<"image" | "video">("image");
  const [status, setStatus] = useState<"idle" | "generating" | "animating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [lastIdentityStatus, setLastIdentityStatus] = useState<
    "pending" | "fidele" | "proche" | "derive" | "non_mesure" | null
  >(null);
  const { job } = useJobStatus(jobId);
  const postCredits = useCredits("post");
  const videoCredits = useCredits("video");
  const isVideoJob = status === "animating" || job?.kind === "video";
  const { balance, cost, affordable, enforced } = isVideoJob ? videoCredits : postCredits;

  useEffect(() => {
    if (!job) return;
    if (job.status === "succeeded" && job.postId) {
      setPostId(job.postId);
      if (job.kind === "video") {
        setMediaKind("video");
      } else {
        setMediaKind("image");
        setImagePostId(job.postId);
        setLastIdentityStatus(job.identityStatus ?? null);
      }
      setJobId(null);
      setStatus("idle");
      emitCreditsChanged();
      return;
    }
    if (job.status === "failed" || job.status === "timed_out" || job.status === "canceled") {
      setError(
        job.errorMessage ??
          (job.kind === "video" ? "La vidéo n’a pas pu être créée." : "Le post n’a pas pu être créé."),
      );
      if (job.kind !== "video") {
        setImagePostId(null);
        setPostId(null);
      }
      setJobId(null);
      setStatus("idle");
      emitCreditsChanged();
    }
  }, [job]);

  async function generate(next: Source, options?: { regenOfPostId?: string }) {
    if (enforced && !postCredits.affordable) {
      setShowUpsell(true);
      setError("Crédits insuffisants.");
      return;
    }
    setSource(next);
    setStatus("generating");
    setError(null);
    setShowUpsell(false);
    setPostId(null);
    setImagePostId(null);
    setMediaKind("image");
    setJobId(null);
    setCaption("");
    setLastIdentityStatus(null);
    try {
      const response = await fetch(`/api/characters/${characterId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(next.kind === "reel"
            ? { reelId: next.id, tag: next.tag }
            : { formatId: next.id }),
          ...(options?.regenOfPostId ? { regenOfPostId: options.regenOfPostId } : {}),
        }),
      });
      const payload = (await response.json()) as {
        id?: string;
        postId?: string;
        jobId?: string;
        caption?: string;
        error?: string;
        code?: string;
        balance?: number;
        cost?: number;
      };
      if (response.status === 402 || payload.code === "insufficient_credits") {
        setShowUpsell(true);
        setError(payload.error ?? "Crédits insuffisants.");
        setStatus("idle");
        emitCreditsChanged();
        return;
      }
      if (response.status === 202 && payload.jobId && payload.postId) {
        setJobId(payload.jobId);
        setPostId(payload.postId);
        setImagePostId(payload.postId);
        emitCreditsChanged();
        return;
      }
      if (!response.ok || !payload.id) {
        setError(payload.error ?? "Le post n’a pas pu être créé.");
        setStatus("idle");
        return;
      }
      setPostId(payload.id);
      setImagePostId(payload.id);
      setMediaKind("image");
      setCaption(payload.caption ?? "");
      setStatus("idle");
      emitCreditsChanged();
    } catch (cause) {
      console.error(cause);
      setError("Le post n’a pas pu être créé.");
      setStatus("idle");
    }
  }

  async function animateVideo() {
    const sourcePostId = imagePostId ?? (mediaKind === "image" ? postId : null);
    if (!sourcePostId) return;
    if (enforced && !videoCredits.affordable) {
      setShowUpsell(true);
      setError("Crédits insuffisants pour une vidéo.");
      return;
    }
    setStatus("animating");
    setError(null);
    setShowUpsell(false);
    setJobId(null);
    try {
      const response = await fetch(
        `/api/characters/${characterId}/posts/${sourcePostId}/video`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        postId?: string;
        jobId?: string;
        error?: string;
        code?: string;
      };
      if (response.status === 402 || payload.code === "insufficient_credits") {
        setShowUpsell(true);
        setError(payload.error ?? "Crédits insuffisants.");
        setStatus("idle");
        emitCreditsChanged();
        return;
      }
      if (!response.ok || !payload.jobId || !payload.postId) {
        setError(payload.error ?? "La vidéo n’a pas pu être créée.");
        setStatus("idle");
        return;
      }
      setPostId(payload.postId);
      setMediaKind("video");
      setJobId(payload.jobId);
      emitCreditsChanged();
    } catch (cause) {
      console.error(cause);
      setError("La vidéo n’a pas pu être créée.");
      setStatus("idle");
    }
  }

  const mediaUrl = postId
    ? `/api/characters/${characterId}/posts/${postId}`
    : `/api/characters/${characterId}/face`;
  const busy = status === "generating" || status === "animating";
  const canAnimate =
    Boolean(imagePostId ?? (postId && mediaKind === "image")) && status === "idle";
  const selectedFormatId = source?.kind === "format" ? source.id : null;
  const selectedLabel =
    source?.kind === "reel"
      ? `Reel #${source.tag}`
      : FORMATS.find((format) => format.id === selectedFormatId)?.label ?? null;
  const progressLabel =
    busy && job
      ? `${status === "animating" ? "Vidéo" : "Génération"} · ${Math.round(job.elapsedMs / 1000)} s${
          job.etaMs != null ? ` · ~${Math.round(job.etaMs / 1000)} s restantes` : ""
        }`
      : status === "animating"
        ? "La vidéo se forme…"
        : status === "generating"
          ? "Le post se forme…"
          : null;

  function onFormatKey(event: KeyboardEvent<HTMLButtonElement>) {
    const nextId = nextFormatId(selectedFormatId, event.key);
    if (!nextId) return;
    event.preventDefault();
    const target = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
      `[data-format="${nextId}"]`,
    );
    target?.focus();
  }

  return (
    <main className="grid min-h-[100dvh] md:grid-cols-[24rem_minmax(0,1fr)]">
      <section className="flex flex-col bg-panel px-5 py-6 md:border-r md:border-line md:px-6 md:py-8">
        <Link
          href={`/personnages/${characterId}`}
          className="shift ring-focus inline-flex items-center gap-2 self-start rounded-md text-sm text-mute hover:text-ink"
        >
          <IconArrowLeft size={16} />
          {name}
        </Link>

        <h1 className="font-display mt-6 text-3xl font-medium tracking-tight">Un post</h1>
        <p className="mt-2 text-sm text-pretty text-mute">
          Choisis ce qu’elle refait. Le visage, les cheveux et l’âge ne bougent pas.
        </p>
        <p className="telemetry mt-3 text-[0.625rem] text-dim">
          Post {postCredits.cost} · vidéo {videoCredits.cost} · solde {balance}
          {enforced && !affordable ? " · recharger requis" : ""}
        </p>
        {showUpsell ? <div className="mt-4"><UpsellInline balance={balance} cost={cost} /></div> : null}

        {reel ? (
          <div className="mt-8 rounded-sm border border-line bg-raise p-4">
            <p className="text-xs font-medium tracking-wide text-lime uppercase">Reel source</p>
            <div className="mt-3 flex gap-3">
              {reel.thumbnail ? (
                <img
                  src={reel.thumbnail}
                  alt=""
                  width={90}
                  height={160}
                  className="aspect-[9/16] w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex aspect-[9/16] w-14 shrink-0 items-center justify-center rounded-lg bg-white/6 text-dim">
                  <IconPlay size={16} />
                </div>
              )}
              <div className="min-w-0">
                <p className="tabular text-sm">
                  {views.format(reel.plays)} vues · #{reel.hashtag}
                </p>
                <p className="mt-1 line-clamp-3 text-sm text-mute">{reel.caption || `@${reel.owner}`}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy || (enforced && !postCredits.affordable)}
              onClick={() => generate({ kind: "reel", id: reel.id, tag: reel.hashtag })}
              className="btn btn-primary ring-focus mt-4 w-full"
            >
              {busy && source?.kind === "reel"
                ? "Le post se forme…"
                : postId && source?.kind === "reel"
                  ? "Refaire encore"
                  : `Refaire avec ${name}`}
            </button>
          </div>
        ) : null}

        <p className="mt-8 text-sm text-mute">{reel ? "Ou un format" : "Format"}</p>
        <div className="mt-2 flex flex-col gap-1" role="radiogroup" aria-label="Format">
          {FORMATS.map((format, index) => {
            const selected = selectedFormatId === format.id;
            const tabbable = selected || (selectedFormatId === null && index === 0);
            return (
              <button
                key={format.id}
                type="button"
                role="radio"
                data-format={format.id}
                aria-checked={selected}
                tabIndex={tabbable ? 0 : -1}
                disabled={busy || (enforced && !postCredits.affordable)}
                onClick={() => generate({ kind: "format", id: format.id })}
                onKeyDown={onFormatKey}
                className={`shift ring-focus flex items-start justify-between gap-3 rounded-sm px-3.5 py-3 text-left disabled:opacity-40 ${
                  selected ? "bg-lime-soft" : "hover:bg-white/5"
                }`}
              >
                <span className="min-w-0">
                  <span className={`block text-base font-medium ${selected ? "text-lime" : "text-ink"}`}>
                    {format.label}
                  </span>
                  <span className="mt-0.5 block text-sm text-pretty text-mute">{format.reach}</span>
                </span>
                <span
                  className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-none border ${
                    selected ? "border-lime bg-lime text-stage" : "border-white/15"
                  }`}
                >
                  {selected ? <IconCheck size={12} strokeWidth={2.4} /> : null}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-6 min-h-5 text-sm text-mute" aria-live="polite">
          {error ?? ""}
        </p>
      </section>

      <section className="stage-glow flex flex-col items-center justify-center px-6 py-10 md:py-12">
        <div className="flex w-full max-w-md flex-col items-center">
          <p className="tabular flex items-center gap-2 text-sm text-mute">
            <span
              className={`inline-block size-1.5 rounded-none ${busy ? "pulse-soft bg-lime" : postId ? "bg-lime" : "bg-dim"}`}
            />
            {progressLabel
              ? progressLabel
              : postId
                ? `${mediaKind === "video" ? "Vidéo prête" : "Post prêt"}${
                    selectedLabel ? ` · ${selectedLabel}` : ""
                  }`
                : "Visage verrouillé"}
          </p>
          <div className="bezel relative mt-5 w-full max-w-md shadow-stage">
            <div className="bezel-core">
              {mediaKind === "video" && postId ? (
                <video
                  key={mediaUrl}
                  src={mediaUrl}
                  controls
                  playsInline
                  autoPlay
                  loop
                  muted
                  className={`face-in aspect-[3/4] max-h-[62vh] w-full object-cover ${busy ? "opacity-40" : ""}`}
                />
              ) : (
                <img
                  key={mediaUrl}
                  src={mediaUrl}
                  alt={postId ? `Post de ${name}` : `Visage de ${name}`}
                  width={768}
                  height={1024}
                  className={`face-in aspect-[3/4] max-h-[62vh] w-full object-cover ${busy ? "opacity-40" : ""}`}
                />
              )}
            </div>
            {mediaKind === "image" ? (
              <IdentityBadge
                score={job?.identityScore}
                status={job?.identityStatus ?? lastIdentityStatus}
              />
            ) : null}
          </div>

          {postId ? (
            <div className="panel mt-6 w-full p-5">
              {caption ? <p className="text-sm text-pretty leading-relaxed">{caption}</p> : null}
              <div className={`flex flex-wrap items-center gap-3 ${caption ? "mt-4" : ""}`}>
                <a
                  href={`/api/characters/${characterId}/posts/${postId}?download=1`}
                  download
                  className="btn btn-primary ring-focus pl-4 pr-2"
                >
                  Télécharger
                  <span className="btn-icon">
                    <IconDownload size={14} />
                  </span>
                </a>
                {canAnimate ? (
                  <button
                    type="button"
                    onClick={() => void animateVideo()}
                    disabled={enforced && !videoCredits.affordable}
                    className="btn btn-ghost ring-focus"
                  >
                    <IconPlay size={16} />
                    Animer · {videoCredits.cost} crédits
                  </button>
                ) : null}
                {mediaKind === "image" &&
                postId &&
                source &&
                (lastIdentityStatus === "derive" || lastIdentityStatus === "proche") ? (
                  <button
                    type="button"
                    disabled={busy || (enforced && !postCredits.affordable)}
                    onClick={() => void generate(source, { regenOfPostId: postId })}
                    className="btn btn-ghost ring-focus"
                  >
                    Relancer
                  </button>
                ) : null}
                {caption ? <CopyCaption caption={caption} /> : null}
              </div>
            </div>
          ) : (
            <p className="mt-6 max-w-xs text-center text-sm text-pretty text-mute">
              {busy
                ? status === "animating"
                  ? "Jusqu’à 3 minutes."
                  : "Quelques secondes."
                : "Le post apparaît ici, prêt à télécharger avec sa légende."}
            </p>
          )}
          <p className="sr-only" aria-live="polite">
            {busy
              ? status === "animating"
                ? "La vidéo se forme…"
                : "Le post se forme…"
              : postId
                ? mediaKind === "video"
                  ? "La vidéo est prête."
                  : "Le post est prêt."
                : ""}
          </p>
        </div>
      </section>
    </main>
  );
}

function CopyCaption({ caption }: { caption: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (cause) {
      console.error(cause);
    }
  }

  return (
    <button type="button" onClick={copy} className="btn btn-ghost ring-focus">
      {copied ? <IconCheck size={18} className="text-lime" /> : <IconCopy size={18} />}
      {copied ? "Légende copiée" : "Copier la légende"}
    </button>
  );
}
