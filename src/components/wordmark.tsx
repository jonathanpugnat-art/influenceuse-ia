export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`telemetry inline-flex items-baseline gap-2 text-[0.8125rem] font-medium text-ink ${className}`}
    >
      <span className="text-lime" aria-hidden="true">
        [
      </span>
      Ofmia
      <span className="text-lime" aria-hidden="true">
        ]
      </span>
    </span>
  );
}
