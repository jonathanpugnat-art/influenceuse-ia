"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Camera, Sparkles, CheckCircle2 } from "lucide-react";

/**
 * Hero product preview — the "face → feed" React loop.
 *
 * Left: the reference portrait, labeled as the Wizard output.
 * Right: a 3-tile phone feed that cycles through generated scenes,
 *        one new tile appearing every ~1.6s, then holds.
 *
 * Kept as a pure React/CSS component so autoplay works on iOS (no
 * <video>). Respects `prefers-reduced-motion` — reduced users see all
 * three tiles at once with no animation.
 */

type Scene = {
  src: string;
  captionKey:
    | "showcaseCaptionGym"
    | "showcaseCaptionCafe"
    | "showcaseCaptionMirror"
    | "showcaseCaptionRestaurant"
    | "showcaseCaptionTokyo"
    | "showcaseCaptionNyc";
  handle: string;
  likes: string;
};

const SCENES: Scene[] = [
  {
    src: "/landing/showcase/luna-gym.jpg",
    captionKey: "showcaseCaptionGym",
    handle: "@luna.lifestyle",
    likes: "12.4K",
  },
  {
    src: "/landing/showcase/luna-cafe.jpg",
    captionKey: "showcaseCaptionCafe",
    handle: "@luna.lifestyle",
    likes: "8.9K",
  },
  {
    src: "/landing/showcase/luna-mirror.jpg",
    captionKey: "showcaseCaptionMirror",
    handle: "@luna.lifestyle",
    likes: "15.7K",
  },
];

const CYCLE_MS = 1600;

export function HeroPreview() {
  const t = useTranslations("landing");
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(0);

  // If the user prefers reduced motion we short-circuit at render time and
  // show every tile; otherwise cycle one tile in every ~1.6s, then hold.
  // Deriving `shownCount` from `reduced` (instead of setting state inside
  // the effect) keeps the render deterministic and satisfies React 19's
  // "no cascading setState in effects" rule.
  useEffect(() => {
    if (reduced) return;
    if (visible >= SCENES.length) return;
    const id = window.setTimeout(
      () => setVisible((v) => Math.min(v + 1, SCENES.length)),
      CYCLE_MS,
    );
    return () => window.clearTimeout(id);
  }, [visible, reduced]);

  const shownCount = reduced ? SCENES.length : visible;
  const rendering = !reduced && shownCount < SCENES.length;

  return (
    <div
      className="relative isolate mx-auto w-full max-w-5xl"
      aria-label={t("previewLabel")}
    >
      {/* Frame — Linear/Vercel-style device chrome */}
      <div className="relative rounded-[28px] border border-white/[0.08] bg-white/[0.02] p-3 shadow-[0_40px_120px_-40px_rgba(126,74,255,0.45)] backdrop-blur-sm md:p-4">
        {/* Window bar */}
        <div className="mb-3 flex items-center gap-3 px-2">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-black/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white/40 md:inline-flex">
            <span className="size-1.5 rounded-full bg-emerald-400/70" />
            {t("previewLabel")}
          </div>
          <div className="ml-auto hidden items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/40 md:flex">
            <span className="opacity-60">{t("previewStep1")}</span>
            <span className="opacity-30">→</span>
            <span className="text-white/70">{t("previewStep2")}</span>
            <span className="opacity-30">→</span>
            <span className="opacity-60">{t("previewStep3")}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-4">
          {/* Reference portrait pane */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-black">
            <div className="relative aspect-[4/5] w-full">
              <Image
                src="/landing/influencers/luna.jpg"
                alt="Reference portrait — Luna"
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover"
                priority
              />
              {/* Grid overlay */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(color-mix(in oklch, var(--aurora) 14%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--aurora) 14%, transparent) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                  maskImage:
                    "radial-gradient(ellipse at 50% 40%, transparent 30%, black 75%)",
                }}
              />
              {/* Face-lock brackets */}
              <div className="pointer-events-none absolute left-1/2 top-[38%] size-32 -translate-x-1/2 -translate-y-1/2 md:size-40">
                <span className="absolute left-0 top-0 h-4 w-4 border-l border-t border-aurora" />
                <span className="absolute right-0 top-0 h-4 w-4 border-r border-t border-aurora" />
                <span className="absolute bottom-0 left-0 h-4 w-4 border-b border-l border-aurora" />
                <span className="absolute bottom-0 right-0 h-4 w-4 border-b border-r border-aurora" />
              </div>
              {/* Top eyebrow */}
              <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-white/80 backdrop-blur">
                  <Camera className="size-3" />
                  {t("previewSubjectLabel")}
                </span>
              </div>
              {/* Bottom face-lock chip */}
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-aurora/40 bg-aurora/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-aurora backdrop-blur">
                  <span className="size-1.5 rounded-full bg-aurora shadow-[0_0_8px_var(--aurora)]" />
                  face-lock
                </span>
                <span className="rounded-full border border-white/10 bg-black/50 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-white/50 backdrop-blur">
                  {t("previewStep1")}
                </span>
              </div>
            </div>
          </div>

          {/* Generated feed pane */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[oklch(0.06_0.008_285)]">
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-white/80">
                <Sparkles className="size-3.5 text-aurora" />
                {t("previewFeedLabel")}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/40">
                {rendering ? (
                  <>
                    <span className="relative flex size-1.5">
                      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
                      <span className="relative size-1.5 rounded-full bg-emerald-400" />
                    </span>
                    {t("previewLiveTag")} · {shownCount + 1}/{SCENES.length}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3 text-emerald-400" />
                    {SCENES.length}/{SCENES.length}
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 md:gap-3">
              {SCENES.map((scene, i) => {
                const isVisible = i < shownCount;
                const isRendering = i === shownCount && rendering;
                return (
                  <div
                    key={scene.src}
                    className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-white/[0.05] bg-black"
                  >
                    {isVisible ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 1.04 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.55,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="absolute inset-0"
                      >
                        <Image
                          src={scene.src}
                          alt={t(scene.captionKey)}
                          fill
                          sizes="(min-width: 768px) 20vw, 33vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-2">
                          <div className="flex items-center justify-between text-[10px] text-white/85">
                            <span className="truncate font-medium">
                              {scene.handle}
                            </span>
                            <span className="ml-2 shrink-0 font-mono uppercase tracking-widest text-white/50">
                              {scene.likes}
                            </span>
                          </div>
                        </div>
                        <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-white/70 backdrop-blur">
                          {t("previewCreditsTag")}
                        </span>
                      </motion.div>
                    ) : (
                      <RenderingTile pulse={isRendering} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Publish bar */}
            <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-2.5">
              <div className="flex items-center gap-2 text-[11px] text-white/50">
                <span className="font-mono uppercase tracking-widest">
                  {t("previewStep3")}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <PlatformDot label="IG" />
                <PlatformDot label="TT" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aurora glow, single accent only */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 mx-auto h-64 max-w-4xl rounded-full bg-aurora-deep opacity-25 blur-3xl"
      />
    </div>
  );
}

function RenderingTile({ pulse }: { pulse: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[linear-gradient(135deg,_oklch(0.14_0.02_290)_0%,_oklch(0.1_0.01_285)_100%)]">
      {pulse && (
        <>
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
          />
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-aurora/70" />
            <span className="relative size-1.5 rounded-full bg-aurora" />
          </span>
        </>
      )}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(400%);
          }
        }
      `}</style>
    </div>
  );
}

function PlatformDot({ label }: { label: string }) {
  return (
    <span className="inline-flex size-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] font-mono text-[9px] uppercase tracking-widest text-white/60">
      {label}
    </span>
  );
}
