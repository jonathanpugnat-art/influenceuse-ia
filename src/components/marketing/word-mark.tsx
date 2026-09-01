/**
 * Aura wordmark. A single hairline aurora dot next to a tight, letter-spaced
 * name. Kept as its own component so header + footer stay in sync when we
 * iterate the logo later.
 */
export function WordMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="relative inline-flex size-5 items-center justify-center"
      >
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,var(--aurora)_0%,var(--aurora-deep)_45%,transparent_75%)]" />
        <span className="absolute inset-[3px] rounded-full bg-black" />
        <span className="absolute inset-[6px] rounded-full bg-[radial-gradient(circle,var(--aurora)_0%,transparent_70%)]" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-white">
        Aura{" "}
        <span className="font-normal text-white/50">Influences</span>
      </span>
    </span>
  );
}
