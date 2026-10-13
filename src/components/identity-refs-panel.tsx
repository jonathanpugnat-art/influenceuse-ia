"use client";

import { useCallback, useEffect, useState } from "react";

type RefItem = {
  angle: string;
  url: string;
  origin: string;
  score: number | null;
};

const LABELS: Record<string, string> = {
  front: "Face",
  three_quarter_left: "¾ gauche",
  three_quarter_right: "¾ droite",
};

export function IdentityRefsPanel({ characterId }: { characterId: string }) {
  const [refs, setRefs] = useState<RefItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const response = await fetch(`/api/characters/${characterId}/refs`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const json = (await response.json()) as { refs?: RefItem[] };
      setRefs(json.refs ?? []);
    } catch {
      // optional
    }
  }, [characterId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function rebuild() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/characters/${characterId}/refs`, {
        method: "POST",
      });
      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        setError(json.error ?? "Impossible de lancer.");
        return;
      }
      setTimeout(() => void reload(), 2000);
    } catch {
      setError("Impossible de lancer.");
    } finally {
      setBusy(false);
    }
  }

  const angles = ["front", "three_quarter_left", "three_quarter_right"];

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-medium tracking-tight">Références visage</h2>
        <button
          type="button"
          onClick={() => void rebuild()}
          disabled={busy}
          className="btn btn-ghost ring-focus text-sm"
        >
          {busy ? "En cours…" : "Recalculer"}
        </button>
      </div>
      <p className="mt-2 max-w-xl text-sm text-pretty text-mute">
        Trois angles pour stabiliser Kontext sur les scènes difficiles.
      </p>
      <ul className="mt-5 grid grid-cols-3 gap-3">
        {angles.map((angle) => {
          const ref = refs.find((item) => item.angle === angle);
          return (
            <li key={angle}>
              <div className="bezel shadow-stage">
                <div className="bezel-core">
                  <img
                    src={ref?.url ?? `/api/characters/${characterId}/face`}
                    alt={LABELS[angle] ?? angle}
                    width={240}
                    height={320}
                    className="aspect-[3/4] w-full object-cover"
                  />
                </div>
              </div>
              <p className="mt-2 text-sm text-mute">
                {LABELS[angle] ?? angle}
                {ref?.origin ? ` · ${ref.origin}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="mt-3 text-sm text-mute" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
