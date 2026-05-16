import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  const jobs = await db.generationJob.findMany({
    where: { type: "VIDEO" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      prompt: true,
      error: true,
      createdAt: true,
      completedAt: true,
      contentId: true,
    },
  });

  console.log(`\nLast ${jobs.length} VIDEO generation jobs:\n`);
  for (const j of jobs) {
    console.log(`──────────────────────────────────────────`);
    console.log(`Job:       ${j.id}`);
    console.log(`Status:    ${j.status}`);
    console.log(`Created:   ${j.createdAt.toISOString()}`);
    console.log(`Completed: ${j.completedAt?.toISOString() ?? "—"}`);
    console.log(`Content:   ${j.contentId}`);
    console.log(`Prompt:    ${j.prompt?.slice(0, 200) ?? "—"}`);
    if (j.error) {
      console.log(`\n>>> ERROR <<<`);
      console.log(j.error);
    }
  }

  await db.$disconnect();
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
