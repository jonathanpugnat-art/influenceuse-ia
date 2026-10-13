"use client";

import { useEffect, useState } from "react";

type LedgerEntry = {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
};

export function CreditsLedger() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    void fetch("/api/credits/ledger", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { data?: { entries?: LedgerEntry[] } }) => {
        setEntries(json.data?.entries ?? []);
      })
      .catch(() => undefined);
  }, []);

  if (entries.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="font-display text-xl font-medium tracking-tight">Historique</h2>
      <ul className="mt-4 divide-y divide-line border border-line">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
            <span className="text-mute">{entry.reason}</span>
            <span className={`tabular ${entry.delta < 0 ? "text-ink" : "text-lime"}`}>
              {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
            </span>
            <span className="telemetry text-[0.625rem] text-dim">
              {new Date(entry.createdAt).toLocaleString("fr-FR")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
