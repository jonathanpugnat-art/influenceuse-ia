"use client";

import { motion, type Variants } from "framer-motion";
import { CreditCard, Sparkles } from "lucide-react";
import { CurrentPlan } from "@/components/billing/current-plan";
import { PricingCards } from "@/components/billing/pricing-cards";
import { InvoiceHistory } from "@/components/billing/invoice-history";
import { UsageChart } from "@/components/billing/usage-chart";
import { CreditPacks } from "@/components/billing/credit-packs";
import { isBetaFreeMode } from "@/lib/payments";

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, bounce: 0.12, duration: 0.6 },
  },
};

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

export default function BillingPage() {
  const betaMode = isBetaFreeMode();
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={sectionVariants}>
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-violet-400" />
          <h1 className="text-2xl font-bold text-white">Facturation</h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Gérez votre abonnement, vos crédits et vos factures
        </p>
      </motion.div>

      {/* Beta banner — replaces all upgrade CTAs while Stripe is in TEST
          mode. We keep `<CurrentPlan>` and the pricing grid mounted so the
          user can see the future plans, but the "Upgrade" buttons collapse
          to a "Bêta gratuite" pill (handled inside PricingCards). */}
      {betaMode && (
        <motion.div variants={sectionVariants}>
          <div className="flex items-start gap-3 rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 p-4">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-violet-100">
                Bêta gratuite — tous les crédits offerts
              </p>
              <p className="text-xs text-violet-200/80">
                Pendant la bêta privée, profitez de 500 crédits/mois sur le plan
                Free. Les paiements et plans payants seront activés à la fin de
                la bêta — vous serez prévenu·e par email avant tout changement.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Section 1 — Current Plan */}
      <motion.div variants={sectionVariants}>
        <CurrentPlan />
      </motion.div>

      {/* Section 2 — Pricing Cards */}
      <motion.div variants={sectionVariants}>
        <h2 className="mb-4 text-lg font-semibold text-white">
          {betaMode ? "Plans à venir" : "Choisir un plan"}
        </h2>
        <PricingCards />
      </motion.div>

      {/* Section 2b — Credit packs (Sprint 7). Hidden during the bêta since
          buying extra credits also requires Stripe LIVE. */}
      {!betaMode && (
        <motion.div variants={sectionVariants}>
          <CreditPacks />
        </motion.div>
      )}

      {/* Section 3 — Usage Chart */}
      <motion.div variants={sectionVariants}>
        <UsageChart />
      </motion.div>

      {/* Section 4 — Invoice History */}
      <motion.div variants={sectionVariants}>
        <InvoiceHistory />
      </motion.div>
    </motion.div>
  );
}
