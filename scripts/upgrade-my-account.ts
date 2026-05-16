import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const TARGET_EMAIL = "jonathan.pugnat@gmail.com";
const NEW_PLAN = "ENTERPRISE" as const;
const NEW_CREDITS = 5000;

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  const before = await db.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: {
      email: true,
      plan: true,
      creditsLimit: true,
      creditsUsed: true,
    },
  });
  if (!before) {
    console.error(`❌ User ${TARGET_EMAIL} not found`);
    process.exit(1);
  }
  console.log("Before:");
  console.table([before]);

  const updated = await db.user.update({
    where: { email: TARGET_EMAIL },
    data: {
      plan: NEW_PLAN,
      creditsLimit: NEW_CREDITS,
    },
    select: {
      email: true,
      plan: true,
      creditsLimit: true,
      creditsUsed: true,
    },
  });

  console.log(`\n✓ Upgraded to ${NEW_PLAN} (${NEW_CREDITS} credits)\n`);
  console.log("After:");
  console.table([updated]);

  await db.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
