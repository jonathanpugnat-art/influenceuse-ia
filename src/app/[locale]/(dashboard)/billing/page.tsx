"use client";

import { motion, type Variants } from "framer-motion";
import { CreditCard } from "lucide-react";
import { CurrentPlan } from "@/components/billing/current-plan";
import { PricingCards } from "@/components/billing/pricing-cards";
import { InvoiceHistory } from "@/components/billing/invoice-history";
import { UsageChart } from "@/components/billing/usage-chart";

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

      {/* Section 1 — Current Plan */}
      <motion.div variants={sectionVariants}>
        <CurrentPlan />
      </motion.div>

      {/* Section 2 — Pricing Cards */}
      <motion.div variants={sectionVariants}>
        <h2 className="mb-4 text-lg font-semibold text-white">
          Choisir un plan
        </h2>
        <PricingCards />
      </motion.div>

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
