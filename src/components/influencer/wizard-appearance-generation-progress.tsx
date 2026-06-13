"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function WizardAppearanceGenerationProgress({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  const t = useTranslations("wizard");
  const messages = useMemo(
    () => [
      t("appearanceProgressTraits"),
      t("appearanceProgressFace"),
      t("appearanceProgressStyle"),
      t("appearanceProgressFinal"),
    ],
    [t]
  );
  const [messageIndex, setMessageIndex] = useState(0);
  const [wasActive, setWasActive] = useState(active);

  if (active !== wasActive) {
    setWasActive(active);
    if (!active) setMessageIndex(0);
  }

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [active, messages.length]);

  if (!active) return null;

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-neutral-800/80">
        <div
          className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-rose-500 via-pink-400 to-rose-500 wizard-appearance-progress-bar"
          aria-hidden
        />
      </div>
      <p
        className="text-center text-xs font-medium text-rose-200/90 transition-opacity duration-300"
        aria-live="polite"
      >
        {messages[messageIndex]}
      </p>
    </div>
  );
}
