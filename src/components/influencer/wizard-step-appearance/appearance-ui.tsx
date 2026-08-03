"use client";

import type { ComponentType, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  wizardAccordionInnerClass,
  wizardCardClass,
  wizardCardHoverClass,
  wizardChipClass,
} from "@/components/influencer/wizard-ui";
import { cn } from "@/lib/utils";

export function AppearanceChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={wizardChipClass(selected)}
    >
      {label}
    </button>
  );
}

export function AppearanceAccordionSection({
  title,
  icon: Icon,
  open,
  onToggle,
  summary,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  open: boolean;
  onToggle: () => void;
  summary?: string;
  children: ReactNode;
}) {
  return (
    <div className={wizardCardClass}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left",
          wizardCardHoverClass
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          {summary && !open && (
            <span className="max-w-[45vw] truncate text-xs text-muted-foreground lg:max-w-[180px]">
              {summary}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </span>
      </button>
      {open && (
        <div className={wizardAccordionInnerClass}>{children}</div>
      )}
    </div>
  );
}
