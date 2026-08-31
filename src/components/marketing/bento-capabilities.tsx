"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Coins,
  Video,
  CalendarDays,
  Send,
  BarChart3,
  ScanFace,
} from "lucide-react";

/**
 * Bento grid — capabilities, not features.
 *
 * A tall face-lock hero tile on the left (spans two rows) anchors the eye,
 * then a mixed grid of five smaller tiles carries the rest of the story.
 * Copy uses product language (credits, wizard, face-lock, LoRA, IG/TikTok
 * APIs) — no "powerful / seamless / intuitive".
 */
export function BentoCapabilities() {
  const t = useTranslations("landing");

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-6 md:grid-rows-[repeat(4,minmax(0,1fr))]">
      {/* Tall face-lock feature tile */}
      <BentoTile
        className="md:col-span-3 md:row-span-4"
        title={t("bentoFaceTitle")}
        desc={t("bentoFaceDesc")}
        icon={ScanFace}
      >
        <FaceLockVisual />
      </BentoTile>

      {/* Video */}
      <BentoTile
        className="md:col-span-3 md:row-span-2"
        title={t("bentoVideoTitle")}
        desc={t("bentoVideoDesc")}
        icon={Video}
      >
        <VideoEnginesVisual />
      </BentoTile>

      {/* Credits */}
      <BentoTile
        className="md:col-span-2 md:row-span-2"
        title={t("bentoCreditsTitle")}
        desc={t("bentoCreditsDesc")}
        icon={Coins}
      >
        <CreditsVisual />
      </BentoTile>

      {/* Editorial plan */}
      <BentoTile
        className="md:col-span-1 md:row-span-2"
        title={t("bentoPlanTitle")}
        desc={t("bentoPlanDesc")}
        icon={CalendarDays}
        compact
      >
        <CalendarVisual />
      </BentoTile>

      {/* Publish */}
      <BentoTile
        className="md:col-span-3 md:row-span-2"
        title={t("bentoPublishTitle")}
        desc={t("bentoPublishDesc")}
        icon={Send}
      >
        <PublishVisual />
      </BentoTile>

      {/* Analytics — wide */}
      <BentoTile
        className="md:col-span-3 md:row-span-2"
        title={t("bentoAnalyticsTitle")}
        desc={t("bentoAnalyticsDesc")}
        icon={BarChart3}
      >
        <AnalyticsVisual />
      </BentoTile>
    </div>
  );
}

type IconType = React.ComponentType<{ className?: string }>;

function BentoTile({
  className = "",
  title,
  desc,
  icon: Icon,
  children,
  compact = false,
}: {
  className?: string;
  title: string;
  desc: string;
  icon: IconType;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-[oklch(0.08_0.008_285)] transition-colors hover:border-white/[0.12] ${className}`}
    >
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0">{children}</div>
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[oklch(0.08_0.008_285)] via-[oklch(0.08_0.008_285)]/40 to-transparent"
        />
      </div>
      <div
        className={`relative flex flex-col gap-1.5 ${compact ? "p-5" : "p-6"}`}
      >
        <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/45">
          <Icon className="size-3.5" />
        </div>
        <h3 className="text-[15px] font-semibold tracking-tight text-white">
          {title}
        </h3>
        <p className="text-[13px] leading-relaxed text-white/55">{desc}</p>
      </div>
    </motion.div>
  );
}

/* ----- Visuals ----- */

function FaceLockVisual() {
  return (
    <div className="relative h-full min-h-[280px] w-full md:min-h-[420px]">
      <Image
        src="/landing/influencers/luna.jpg"
        alt=""
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-cover object-[50%_30%]"
      />
      {/* Face-lock brackets */}
      <div className="pointer-events-none absolute left-1/2 top-[30%] size-40 -translate-x-1/2 -translate-y-1/2 md:size-52">
        <span className="absolute left-0 top-0 h-5 w-5 border-l border-t border-[oklch(0.85_0.14_310)]" />
        <span className="absolute right-0 top-0 h-5 w-5 border-r border-t border-[oklch(0.85_0.14_310)]" />
        <span className="absolute bottom-0 left-0 h-5 w-5 border-b border-l border-[oklch(0.85_0.14_310)]" />
        <span className="absolute bottom-0 right-0 h-5 w-5 border-b border-r border-[oklch(0.85_0.14_310)]" />
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-[oklch(0.85_0.14_310)]/40 bg-black/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[oklch(0.88_0.12_310)] backdrop-blur">
          locked
        </span>
      </div>
    </div>
  );
}

function VideoEnginesVisual() {
  const engines = ["Kling 2.0", "Runway Gen-4", "Wan 2.5", "Seedance"];
  return (
    <div className="relative flex h-full w-full items-end p-6">
      <div className="flex w-full flex-col gap-2">
        {engines.map((name, i) => (
          <div
            key={name}
            className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-black/40 px-3 py-2 text-[12px]"
            style={{ opacity: 1 - i * 0.15 }}
          >
            <span className="size-1.5 rounded-full bg-emerald-400/80" />
            <span className="font-mono uppercase tracking-widest text-white/60">
              {name}
            </span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-white/30">
              i2v
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreditsVisual() {
  return (
    <div className="relative flex h-full w-full items-center justify-center p-6">
      <div className="flex flex-col items-start gap-3 text-white/70">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-4xl font-semibold tracking-tight text-white">
            1
          </span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-white/50">
            crédit · 1 photo
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-4xl font-semibold tracking-tight text-white">
            8
          </span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-white/50">
            crédits · 1 reel
          </span>
        </div>
      </div>
    </div>
  );
}

function CalendarVisual() {
  const cells = Array.from({ length: 21 });
  const filled = new Set([1, 4, 6, 9, 11, 12, 15, 18, 20]);
  return (
    <div className="grid h-full w-full grid-cols-7 place-content-center gap-1 p-5">
      {cells.map((_, i) => (
        <span
          key={i}
          className={`aspect-square rounded ${
            filled.has(i)
              ? "bg-[oklch(0.85_0.14_310)]/60"
              : "bg-white/[0.04]"
          }`}
        />
      ))}
    </div>
  );
}

function PublishVisual() {
  return (
    <div className="relative flex h-full w-full items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-2">
        <PublishRow label="Instagram" status="posted" delta="09:14" />
        <PublishRow label="TikTok" status="posted" delta="09:14" />
        <PublishRow label="Instagram" status="queued" delta="18:00" />
      </div>
    </div>
  );
}

function PublishRow({
  label,
  status,
  delta,
}: {
  label: string;
  status: "posted" | "queued";
  delta: string;
}) {
  const isPosted = status === "posted";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-black/40 px-3 py-2 text-[12px]">
      <span
        className={`size-1.5 rounded-full ${
          isPosted ? "bg-emerald-400" : "bg-white/25"
        }`}
      />
      <span className="text-white/70">{label}</span>
      <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-white/40">
        {delta}
      </span>
      <span
        className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
          isPosted
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            : "border-white/10 bg-white/5 text-white/50"
        }`}
      >
        {status}
      </span>
    </div>
  );
}

function AnalyticsVisual() {
  const bars = [42, 58, 66, 51, 74, 88, 62, 79, 95, 71, 84, 68];
  return (
    <div className="relative flex h-full w-full items-end gap-1.5 p-6">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm bg-gradient-to-t from-[oklch(0.55_0.22_295)]/60 to-[oklch(0.85_0.14_310)]/80"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
