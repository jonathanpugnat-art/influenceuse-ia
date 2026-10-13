import { NextResponse } from "next/server";

import { CREDIT_COSTS } from "@/lib/credits";
import { getEnv } from "@/lib/env";
import {
  ensureUser,
  getCreditBalance,
  getUserBilling,
} from "@/lib/repositories/db/credits";
import { requireUserId } from "@/lib/session";
import { planById } from "@/lib/billing/plans";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireUserId();
  await ensureUser(userId);
  const [balance, billing] = await Promise.all([
    getCreditBalance(userId),
    getUserBilling(userId),
  ]);
  const env = getEnv();
  const plan = planById(billing?.plan ?? "decouverte") ?? planById("decouverte")!;
  return NextResponse.json({
    success: true,
    data: {
      balance,
      plan: plan.id,
      planName: plan.name,
      costs: CREDIT_COSTS,
      enforced: env.CREDITS_ENFORCED,
      periodEnd: billing?.stripeCurrentPeriodEnd?.toISOString() ?? null,
    },
    error: null,
  });
}
