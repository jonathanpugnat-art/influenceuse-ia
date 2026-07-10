"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type BorderBeamProps = {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
};

export function BorderBeam({
  className,
  size = 200,
  duration = 12,
  borderWidth = 1.5,
  colorFrom = "oklch(0.78 0.1 290)",
  colorTo = "oklch(0.78 0.1 50)",
  delay = 0,
}: BorderBeamProps) {
  return (
    <div
      style={
        {
          "--size": size,
          "--duration": duration,
          "--delay": delay,
          "--border-width": borderWidth,
          "--color-from": colorFrom,
          "--color-to": colorTo,
        } as CSSProperties
      }
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent]",
        "[background:linear-gradient(var(--background),var(--background))_padding-box,conic-gradient(from_calc(var(--delay)*1s),var(--color-from),var(--color-to),var(--color-from))_border-box]",
        "animate-[border-beam-spin_calc(var(--duration)*1s)_linear_infinite]",
        className,
      )}
    />
  );
}
