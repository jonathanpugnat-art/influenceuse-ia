"use client";

import { useState } from "react";

import type { CreditPack, Plan } from "@/lib/billing/plans";

type BillingPanelProps = {
  plans: readonly Plan[];
  packs: readonly CreditPack[];
  currentPlan: string;
  balance: number;
  hasStripeCustomer: boolean;
};

export function BillingPanel({
  plans,
  packs,
  currentPlan,
  balance,
  hasStripeCustomer,
}: BillingPanelProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(pendingKey: string, body: Record<string, string>) {
    setError(null);
    setPending(pendingKey);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as {
        data?: { url?: string };
        error?: string | null;
      };
      if (!response.ok || !json.data?.url) {
        setError(json.error ?? "Checkout indisponible.");
        setPending(null);
        return;
      }
      window.location.href = json.data.url;
    } catch {
      setError("Checkout indisponible.");
      setPending(null);
    }
  }

  async function openPortal() {
    setError(null);
    setPending("portal");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const json = (await response.json()) as {
        data?: { url?: string };
        error?: string | null;
      };
      if (!response.ok || !json.data?.url) {
        setError(json.error ?? "Portail indisponible.");
        setPending(null);
        return;
      }
      window.location.href = json.data.url;
    } catch {
      setError("Portail indisponible.");
      setPending(null);
    }
  }

  return (
    <div className="mt-10 space-y-12">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="telemetry text-[0.625rem] text-dim">Solde</p>
            <p className="font-display mt-1 text-4xl font-bold tabular tracking-tight">
              {balance}
              <span className="ml-2 text-base font-medium text-mute">crédits</span>
            </p>
          </div>
          {hasStripeCustomer ? (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void openPortal()}
              className="btn btn-ghost ring-focus"
            >
              {pending === "portal" ? "Ouverture…" : "Gérer l’abonnement"}
            </button>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold tracking-tight uppercase">Plans</h2>
        <p className="mt-2 max-w-prose text-sm text-mute">
          Chaque renouvellement crédite le ledger. Un post = 1 crédit.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {plans.map((plan) => {
            const active = currentPlan === plan.id;
            const key = `subscription:${plan.id}`;
            return (
              <div
                key={plan.id}
                className={`border border-line bg-panel p-5 ${active ? "border-lime" : ""}`}
              >
                <p className="telemetry text-[0.625rem] text-dim">{plan.name}</p>
                <p className="font-display mt-2 text-3xl font-bold">
                  {plan.priceEur}€
                  <span className="text-sm font-medium text-mute"> / mois</span>
                </p>
                <p className="mt-2 tabular text-sm text-mute">
                  {plan.creditsPerMonth.toLocaleString("fr-FR")} crédits ·{" "}
                  {plan.maxInfluencers} influenceuses
                </p>
                <button
                  type="button"
                  disabled={active || pending !== null}
                  onClick={() =>
                    void startCheckout(`subscription:${plan.id}`, {
                      kind: "subscription",
                      plan: plan.id,
                    })
                  }
                  className="btn btn-primary ring-focus mt-5 w-full disabled:opacity-40"
                >
                  {active
                    ? "Plan actuel"
                    : pending === key
                      ? "Redirection…"
                      : "Souscrire"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold tracking-tight uppercase">Packs</h2>
        <p className="mt-2 max-w-prose text-sm text-mute">
          Recharge ponctuelle, sans changer de plan.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {packs.map((pack) => {
            const key = `pack:${pack.id}`;
            return (
              <div key={pack.id} className="border border-line bg-panel p-5">
                <p className="telemetry text-[0.625rem] text-dim">{pack.name}</p>
                <p className="font-display mt-2 text-3xl font-bold tabular">
                  +{pack.credits}
                </p>
                <p className="mt-1 text-sm text-mute">{pack.priceEur}€ une fois</p>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() =>
                    void startCheckout(`pack:${pack.id}`, {
                      kind: "pack",
                      packId: pack.id,
                    })
                  }
                  className="btn btn-ghost ring-focus mt-5 w-full"
                >
                  {pending === key ? "Redirection…" : "Acheter"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {error ? (
        <p className="text-sm text-lime" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
