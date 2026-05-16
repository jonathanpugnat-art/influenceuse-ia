import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const NEW_CREDITS = 500;

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  const result = await db.user.updateMany({
    where: { plan: "FREE", creditsLimit: { lt: NEW_CREDITS } },
    data: { creditsLimit: NEW_CREDITS },
  });
  console.log(`✓ Updated ${result.count} FREE user(s) → creditsLimit=${NEW_CREDITS}`);

  const users = await db.user.findMany({
    select: { email: true, plan: true, creditsLimit: true, creditsUsed: true },
    orderBy: { createdAt: "desc" },
  });
  console.table(users);

  await db.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
