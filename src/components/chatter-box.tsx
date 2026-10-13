"use client";

import { useState, type FormEvent } from "react";

import { IconCheck, IconCopy } from "@/components/icons";
import { PresenceFade } from "@/components/motion";

type ChatterBoxProps = {
  characterId: string;
  name: string;
};

export function ChatterBox({ characterId, name }: ChatterBoxProps) {
  const [message, setMessage] = useState("");
  const [asked, setAsked] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setPending(true);
    setError(null);
    setReply("");
    setAsked(text);
    try {
      const response = await fetch(`/api/characters/${characterId}/chatter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const payload = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !payload.reply) {
        setError(payload.error ?? "La réponse n’a pas pu être écrite.");
        setPending(false);
        return;
      }
      setReply(payload.reply);
      setMessage("");
      setPending(false);
    } catch (cause) {
      console.error(cause);
      setError("La réponse n’a pas pu être écrite.");
      setPending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (cause) {
      console.error(cause);
    }
  }

  const face = `/api/characters/${characterId}/face`;

  return (
    <div className="flex flex-col gap-6">
      <div className="panel flex min-h-[18rem] flex-col justify-end gap-4 p-5 md:p-6" aria-live="polite">
        {!asked ? (
          <p className="text-sm text-pretty text-mute">
            Colle le message d’un abonné. {name} répond dans sa niche, tu copies et tu envoies depuis
            OnlyFans.
          </p>
        ) : null}
        {asked ? (
          <div className="flex justify-end">
            <p className="max-w-[34rem] rounded-sm bg-white/8 px-4 py-3 text-sm text-pretty leading-relaxed">
              {asked}
            </p>
          </div>
        ) : null}
        {pending ? (
          <div className="flex items-end gap-3">
            <img src={face} alt="" width={32} height={32} className="size-8 rounded-sm object-cover" />
            <p className="pulse-soft rounded-sm bg-raise px-4 py-3 text-sm text-mute">
              {name} écrit…
            </p>
          </div>
        ) : null}
        <PresenceFade show={Boolean(reply)} className="flex items-end gap-3">
          {reply ? (
            <>
              <img src={face} alt="" width={32} height={32} className="size-8 rounded-sm object-cover" />
              <div className="max-w-[34rem]">
                <p className="rounded-sm bg-raise px-4 py-3 text-sm text-pretty leading-relaxed">
                  {reply}
                </p>
                <button type="button" onClick={copy} className="btn btn-quiet ring-focus mt-1.5 text-xs">
                  {copied ? <IconCheck size={14} className="text-lime" /> : <IconCopy size={14} />}
                  {copied ? "Copiée" : "Copier la réponse"}
                </button>
              </div>
            </>
          ) : null}
        </PresenceFade>
        {error ? <p className="text-sm text-mute">{error}</p> : null}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="sr-only" htmlFor="fan-message">
          Message de l’abonné pour {name}
        </label>
        <textarea
          id="fan-message"
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Le message de l’abonné…"
          required
          maxLength={500}
          rows={3}
          className="field resize-none"
        />
        <div className="flex items-center justify-between gap-4">
          <p className="tabular text-xs text-dim">{message.length} / 500</p>
          <button type="submit" disabled={pending || !message.trim()} className="btn btn-primary ring-focus">
            {pending ? "Elle écrit…" : "Répondre"}
          </button>
        </div>
      </form>
    </div>
  );
}
