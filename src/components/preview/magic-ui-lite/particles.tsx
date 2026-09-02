"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

type ParticlesProps = {
  className?: string;
  quantity?: number;
};

/** Deterministic 0–1 hash so particle layout is stable across renders. */
function unit(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function Particles({ className, quantity = 40 }: ParticlesProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: quantity }, (_, i) => ({
        id: i,
        x: unit(i + 1) * 100,
        y: unit(i + 17) * 100,
        size: unit(i + 31) * 2 + 1,
        duration: unit(i + 47) * 10 + 10,
        delay: unit(i + 61) * 5,
        opacity: unit(i + 79) * 0.4 + 0.1,
      })),
    [quantity],
  );

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full bg-foreground animate-[particle-float_linear_infinite]"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
