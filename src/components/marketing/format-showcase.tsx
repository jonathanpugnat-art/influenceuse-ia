"use client";

import Link from "next/link";
import { useState } from "react";

import { IconArrowRight } from "@/components/icons";
import { LockedFace } from "@/components/marketing/locked-face";
import { FORMATS } from "@/lib/formats";
import { FORMAT_FACES, LUNA_LOCK } from "@/lib/landing-faces";

/**
 * Showcase des formats qui marchent, en onglets.
 * Reproduit (clean-room) le pattern "tabbed tool showcase" des concurrents,
 * mais branché sur nos vrais FORMATS (POV, GRWM, Journée, Confession, Avant/après).
 */
export function FormatShowcase() {
  const [active, setActive] = useState<string>(FORMATS[0]?.id ?? "pov");
  const current = FORMATS.find((format) => format.id === active) ?? FORMATS[0];

  if (!current) return null;

  const face = FORMAT_FACES[current.id] ?? LUNA_LOCK;

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-[18rem_1fr]">
      <div
        role="tablist"
        aria-label="Formats de reels"
        className="panel flex gap-2 overflow-x-auto p-2 md:flex-col md:overflow-visible"
      >
        {FORMATS.map((format) => {
          const selected = format.id === active;
          return (
            <button
              key={format.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(format.id)}
              className={`shift ring-focus flex shrink-0 items-center justify-between gap-3 rounded-sm px-4 py-3 text-left ${
                selected ? "bg-lime-soft text-ink" : "text-mute hover:bg-white/5 hover:text-ink"
              }`}
            >
              <span className="font-display text-base font-medium">{format.label}</span>
              <span
                className={`telemetry text-[0.625rem] ${selected ? "text-lime" : "text-dim"}`}
                aria-hidden
              >
                {selected ? "ON" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bezel lift">
        <div className="bezel-core grid overflow-hidden md:grid-cols-[minmax(0,14rem)_1fr]">
          <LockedFace
            src={face.src}
            alt={face.alt}
            framed={false}
            className="h-full"
            aspect="aspect-[4/5] h-full min-h-[16rem] md:min-h-[22rem] md:aspect-auto"
            sizes="(min-width: 768px) 224px, 92vw"
          />
          <div className="stage-glow flex min-h-[14rem] flex-col justify-between p-6 md:p-8">
            <div>
              <p className="telemetry text-[0.625rem] text-dim">Format · 9:16</p>
              <h3 className="font-display mt-2 text-3xl font-bold tracking-tight uppercase">
                {current.label}
              </h3>
              <p className="mt-3 max-w-prose text-sm text-pretty text-mute">{current.reach}</p>
            </div>
            <Link
              href="/inscription"
              className="btn btn-primary ring-focus mt-8 w-fit pr-2 pl-4"
            >
              Refaire avec mon visage
              <span className="btn-icon">
                <IconArrowRight size={14} />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
