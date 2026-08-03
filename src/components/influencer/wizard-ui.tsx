import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Editorial eyebrow label — premium, restrained. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

export const wizardInputClass =
  "h-12 rounded-xl border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20";

export const wizardTextareaClass =
  "rounded-xl border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20";

export const wizardSelectTriggerClass =
  "h-10 border-border bg-card text-foreground";

export const wizardSelectContentClass = "border-border bg-popover";

export const wizardChipActiveClass =
  "border-primary/40 bg-primary/10 text-foreground";

export const wizardChipIdleClass =
  "border-border bg-card text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground";

export const wizardCardClass =
  "overflow-hidden rounded-2xl border border-border bg-card";

export const wizardCardHoverClass = "transition-colors hover:bg-accent/50";

export const wizardAccordionInnerClass =
  "space-y-4 border-t border-border px-4 pb-4 pt-4";

export const wizardPrimaryButtonClass =
  "group inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3 text-sm font-semibold text-background shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none";

export const wizardSecondaryButtonClass =
  "rounded-full border border-border bg-card px-6 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

export function WizardPrimaryButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn(wizardPrimaryButtonClass, className)} {...props}>
      {children}
    </button>
  );
}

export function WizardSecondaryButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn(wizardSecondaryButtonClass, className)} {...props}>
      {children}
    </button>
  );
}

export function wizardChipClass(selected: boolean) {
  return cn(
    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
    selected ? wizardChipActiveClass : wizardChipIdleClass
  );
}

export function wizardSegmentClass(active: boolean) {
  return cn(
    "rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
    active ? wizardChipActiveClass : wizardChipIdleClass
  );
}

/** Niche accent dots — shared across template cards and the niche field. */
export const nicheDotClass: Record<string, string> = {
  FASHION: "bg-pink-400",
  FITNESS: "bg-emerald-400",
  LIFESTYLE: "bg-rose-400",
  TRAVEL: "bg-blue-400",
  TECH: "bg-cyan-400",
  GAMING: "bg-purple-400",
  ADULT: "bg-red-400",
  FOOD: "bg-amber-400",
};
