// Usage: npx tsx scripts/upgrade-user-by-email.ts <email> [plan] [credits]
//
// Examples:
//   npx tsx scripts/upgrade-user-by-email.ts jonathanpugnattest1@gmail.com
//   npx tsx scripts/upgrade-user-by-email.ts demo@gmail.com PRO 1000
//   npx tsx scripts/upgrade-user-by-email.ts beta@gmail.com ENTERPRISE 5000
//
// Defaults: plan=ENTERPRISE, credits=5000 (matches the existing
// scripts/upgrade-my-account.ts behavior so demo flows stay consistent).

import "dotenv/config";
import { PrismaClient, type Plan } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const VALID_PLANS = ["FREE", "STARTER", "PRO", "CREATOR", "ENTERPRISE"] as const;
type ValidPlan = (typeof VALID_PLANS)[number];

function parseArgs(): { email: string; plan: ValidPlan; credits: number } {
  const [, , email, planArg, creditsArg] = process.argv;
  if (!email) {
    console.error(
      "Usage: npx tsx scripts/upgrade-user-by-email.ts <email> [plan] [credits]"
    );
    process.exit(1);
  }

  const plan = (planArg ?? "ENTERPRISE").toUpperCase() as ValidPlan;
  if (!VALID_PLANS.includes(plan)) {
    console.error(`Invalid plan "${planArg}". Valid: ${VALID_PLANS.join(", ")}`);
    process.exit(1);
  }

  const credits = creditsArg ? parseInt(creditsArg, 10) : 5000;
  if (Number.isNaN(credits) || credits < 0) {
    console.error(`Invalid credits "${creditsArg}". Must be a positive integer.`);
    process.exit(1);
  }

  return { email, plan, credits };
}

async function main() {
  const { email, plan, credits } = parseArgs();

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  const before = await db.user.findUnique({
    where: { email },
    select: {
      email: true,
      plan: true,
      creditsLimit: true,
      creditsUsed: true,
    },
  });
  if (!before) {
    console.error(`\nUser ${email} not found in DB.`);
    console.error(
      "Hint: make sure they completed the sign-up flow first (email verification included)."
    );
    process.exit(1);
  }
  console.log("\nBefore:");
  console.table([before]);

  const updated = await db.user.update({
    where: { email },
    data: {
      plan: plan as Plan,
      creditsLimit: credits,
      // Reset usage so the new credits aren't immediately partially consumed
      // by old test usage. Safe even on never-used accounts (was already 0).
      creditsUsed: 0,
    },
    select: {
      email: true,
      plan: true,
      creditsLimit: true,
      creditsUsed: true,
    },
  });

  console.log(`\nUpgraded to ${plan} with ${credits} credits.`);
  console.log("After:");
  console.table([updated]);

  await db.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
