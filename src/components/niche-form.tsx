"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { IconCheck } from "@/components/icons";
import type { Niche } from "@/lib/niche";

const FIELDS = [
  { name: "subject", label: "Sujet", hint: "Ex. fitness à la maison" },
  { name: "audience", label: "Public", hint: "Ex. femmes 25-35 pressées" },
  { name: "promise", label: "Promesse", hint: "Ex. se sentir capable en 10 min" },
  { name: "tone", label: "Ton", hint: "Ex. direct, chaleureux" },
] as const;

type NicheFormProps = {
  characterId: string;
  initial: Niche | null;
};

export function NicheForm({ characterId, initial }: NicheFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      subject: String(form.get("subject") ?? ""),
      audience: String(form.get("audience") ?? ""),
      promise: String(form.get("promise") ?? ""),
      tone: String(form.get("tone") ?? ""),
    };
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/characters/${characterId}/niche`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "La niche n’a pas pu être gardée.");
        setPending(false);
        return;
      }
      setSaved(true);
      router.refresh();
      setPending(false);
    } catch (cause) {
      console.error(cause);
      setError("La niche n’a pas pu être gardée.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-5 text-left">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.name} className="flex flex-col gap-1.5">
            <span className="text-sm text-mute">{field.label}</span>
            <input
              name={field.name}
              defaultValue={initial?.[field.name] ?? ""}
              placeholder={field.hint}
              maxLength={80}
              required
              className="field"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary ring-focus">
          {pending ? "On garde la niche…" : initial ? "Mettre à jour la niche" : "Garder la niche"}
        </button>
        <p className="min-h-5 text-sm" aria-live="polite">
          {error ? (
            <span className="text-mute">{error}</span>
          ) : saved ? (
            <span className="inline-flex items-center gap-1.5 text-lime">
              <IconCheck size={16} />
              Niche gardée
            </span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
