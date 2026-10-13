type IdentityBadgeProps = {
  score?: number | null;
  status?: "pending" | "fidele" | "proche" | "derive" | "non_mesure" | null;
};

function labelFor(status: IdentityBadgeProps["status"]): string {
  switch (status) {
    case "fidele":
      return "fidèle";
    case "proche":
      return "proche";
    case "derive":
      return "dérive";
    case "non_mesure":
      return "non mesuré";
    case "pending":
      return "mesure…";
    case null:
    case undefined:
      return "—";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function toneClass(status: IdentityBadgeProps["status"]): string {
  switch (status) {
    case "fidele":
      return "text-lime";
    case "proche":
      return "text-ink";
    case "derive":
      return "text-mute";
    case "non_mesure":
    case "pending":
    case null:
    case undefined:
      return "text-mute";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function IdentityBadge({ score, status }: IdentityBadgeProps) {
  if (!status || status === "pending") return null;
  const scoreLabel =
    typeof score === "number" && Number.isFinite(score) ? score.toFixed(2) : "—";
  return (
    <p className={`mt-2 text-sm tabular-nums ${toneClass(status)}`}>
      Ressemblance {scoreLabel} · {labelFor(status)}
    </p>
  );
}
