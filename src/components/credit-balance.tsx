"use client";

import Link from "next/link";

import { useCredits } from "@/lib/hooks/use-credits";

export function CreditBalance() {
  const { balance, enforced, cost, data, loading } = useCredits();
  const billingOn = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";
  const low = enforced && !loading && balance < cost;

  if (!billingOn && !enforced) {
    return (
      <span className="telemetry inline-flex items-center gap-2 rounded-sm border border-line bg-raise px-2.5 py-1.5 text-[0.625rem] uppercase tracking-wider text-mute">
        <span className="text-dim">Crédits</span>
        <span className="tabular text-ink">{loading && data == null ? "—" : balance}</span>
      </span>
    );
  }

  return (
    <Link
      href="/facturation"
      className={`ring-focus telemetry inline-flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-[0.625rem] uppercase tracking-wider transition ${
        low
          ? "border-lime bg-lime text-stage"
          : "border-line bg-raise text-mute hover:border-lime/40 hover:text-ink"
      }`}
      title="Solde et facturation"
    >
      <span className="text-dim">{data?.planName ?? "Crédits"}</span>
      <span className={`tabular ${low ? "text-stage" : "text-ink"}`}>
        {loading && data == null ? "—" : balance}
      </span>
    </Link>
  );
}
