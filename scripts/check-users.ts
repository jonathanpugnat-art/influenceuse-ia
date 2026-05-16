import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  const count = await db.user.count();
  console.log(`\nUsers in DB Neon: ${count}\n`);

  const users = await db.user.findMany({
    select: {
      id: true,
      clerkId: true,
      email: true,
      plan: true,
      creditsLimit: true,
      creditsUsed: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.table(users);

  await db.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
