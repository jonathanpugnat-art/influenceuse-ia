"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

type ParticlesProps = {
  className?: string;
  quantity?: number;
};

export function Particles({ className, quantity = 40 }: ParticlesProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: quantity }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 1,
        duration: Math.random() * 10 + 10,
        delay: Math.random() * 5,
        opacity: Math.random() * 0.4 + 0.1,
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
