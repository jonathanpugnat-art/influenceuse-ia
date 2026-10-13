"use client";

import Link from "next/link";

type UpsellInlineProps = {
  balance: number;
  cost: number;
};

export function UpsellInline({ balance, cost }: UpsellInlineProps) {
  return (
    <div className="rounded-sm border border-lime/40 bg-raise px-4 py-3 text-sm text-ink">
      <p className="font-medium">Crédits insuffisants</p>
      <p className="mt-1 text-mute">
        Solde {balance} · coût {cost}. Recharge avec le pack Essai ou passe au plan suivant.
      </p>
      <Link
        href="/facturation?reason=insufficient"
        className="ring-focus mt-3 inline-flex text-sm text-lime underline-offset-2 hover:underline"
      >
        Voir les packs et plans
      </Link>
    </div>
  );
}
