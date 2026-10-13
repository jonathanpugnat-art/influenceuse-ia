"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { IconTrend } from "@/components/icons";

const SUGGESTIONS = ["grwm", "pov", "dayinmylife", "morningroutine"] as const;

export function TrendScraper() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");

  async function scrape(hashtag: string, form?: HTMLFormElement) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashtag }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Instagram n’a pas répondu.");
        setPending(false);
        return;
      }
      form?.reset();
      setValue("");
      router.refresh();
      setPending(false);
    } catch (cause) {
      console.error(cause);
      setError("Instagram n’a pas répondu.");
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const hashtag = String(new FormData(form).get("hashtag") ?? "");
    void scrape(hashtag, form);
  }

  return (
    <section className="panel mt-10 p-5 md:p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="hashtag" className="sr-only">
          Hashtag
        </label>
        <div className="field flex min-w-0 flex-1 items-center gap-2 py-0">
          <span className="text-dim">#</span>
          <input
            id="hashtag"
            name="hashtag"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="grwm"
            required
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
          />
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary ring-focus pl-4 pr-2">
          {pending ? "On regarde…" : "Scraper"}
          <span className="btn-icon">
            <IconTrend size={14} />
          </span>
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-dim">Essayer</span>
        {SUGGESTIONS.map((tag) => (
          <button
            key={tag}
            type="button"
            disabled={pending}
            onClick={() => void scrape(tag)}
            className="shift ring-focus rounded-sm bg-raise px-3 py-1 text-sm text-mute hover:bg-white/10 hover:text-ink disabled:opacity-40"
          >
            #{tag}
          </button>
        ))}
      </div>
      <p className="mt-3 min-h-5 text-sm text-mute" aria-live="polite">
        {error ?? ""}
      </p>
    </section>
  );
}
