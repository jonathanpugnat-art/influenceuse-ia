"use client";

import type { ElementType } from "react";

export function PhotoPreviewActionBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-white disabled:opacity-40"
    >
      <Icon className="h-4 w-4" />
      <span className="text-xs">{label}</span>
    </button>
  );
}
