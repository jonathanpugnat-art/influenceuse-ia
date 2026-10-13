"use client";

import { useCallback, useEffect, useState } from "react";

import { emitCreditsChanged, useCredits } from "@/lib/hooks/use-credits";
import { MIN_LORA_PHOTOS } from "@/lib/traits";

type LoraState = {
  lora: {
    id: string;
    status: string;
    photoCount: number;
    validationScore: number | null;
    jobId: string | null;
    errorCode: string | null;
  } | null;
  enabled: boolean;
  cost: number;
  minPhotos: number;
};

export function LoraPanel({
  characterId,
  door,
  sourceCount,
}: {
  characterId: string;
  door: "builder" | "clone";
  sourceCount: number;
}) {
  const [state, setState] = useState<LoraState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const credits = useCredits("lora_training");

  const reload = useCallback(async () => {
    try {
      const response = await fetch(`/api/characters/${characterId}/lora`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      setState((await response.json()) as LoraState);
    } catch {
      // optional
    }
  }, [characterId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (door !== "clone") return null;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/characters/${characterId}/lora`, {
        method: "POST",
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(json.error ?? "Échec du training.");
        return;
      }
      emitCreditsChanged();
      void reload();
    } catch {
      setError("Échec du training.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(enabled: boolean) {
    setBusy(true);
    try {
      await fetch(`/api/characters/${characterId}/lora`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      void reload();
    } finally {
      setBusy(false);
    }
  }

  const cost = state?.cost ?? 50;
  const status = state?.lora?.status;

  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-medium tracking-tight">Modèle entraîné</h2>
      <p className="mt-2 max-w-xl text-sm text-pretty text-mute">
        LoRA optionnel à partir de {MIN_LORA_PHOTOS}+ photos. Coût {cost} crédits. Activé seulement
        s’il bat la référence.
      </p>
      <p className="mt-3 text-sm text-mute tabular-nums">
        Photos : {sourceCount} / {state?.minPhotos ?? MIN_LORA_PHOTOS}
        {status ? ` · ${status}` : ""}
        {typeof state?.lora?.validationScore === "number"
          ? ` · score ${state.lora.validationScore.toFixed(2)}`
          : ""}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void start()}
          disabled={
            busy ||
            sourceCount < MIN_LORA_PHOTOS ||
            (credits.enforced && !credits.affordable) ||
            status === "training" ||
            status === "queued" ||
            status === "validating"
          }
          className="btn btn-primary ring-focus"
        >
          {busy ? "Lancement…" : `Entraîner (${cost} cr.)`}
        </button>
        {status === "ready" ? (
          <label className="flex items-center gap-2 text-sm text-mute">
            <input
              type="checkbox"
              checked={Boolean(state?.enabled)}
              disabled={busy}
              onChange={(event) => void toggle(event.target.checked)}
            />
            Utiliser le modèle entraîné
          </label>
        ) : null}
      </div>
      {error ? (
        <p className="mt-3 text-sm text-mute" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
