import { Suspense } from "react";

import { AppFrame } from "@/components/app-frame";
import { BillingPanel } from "@/components/billing-panel";
import { CheckoutBanner } from "@/components/checkout-banner";
import { CreditsLedger } from "@/components/credits-ledger";
import { CREDIT_PACKS, PAID_PLANS } from "@/lib/billing/plans";
import {
  ensureUser,
  getCreditBalance,
  getUserBilling,
} from "@/lib/repositories/db/credits";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Facturation",
};

export default async function FacturationPage() {
  const userId = await requireUserId();
  await ensureUser(userId);
  const [balance, billing] = await Promise.all([
    getCreditBalance(userId),
    getUserBilling(userId),
  ]);

  return (
    <AppFrame
      title="Facturation"
      description="Solde exact, abonnements Stripe et packs de crédits."
    >
      <Suspense fallback={null}>
        <CheckoutBanner />
      </Suspense>
      <BillingPanel
        plans={PAID_PLANS}
        packs={CREDIT_PACKS}
        currentPlan={billing?.plan ?? "decouverte"}
        balance={balance}
        hasStripeCustomer={Boolean(billing?.stripeCustomerId)}
      />
      <CreditsLedger />
    </AppFrame>
  );
}
