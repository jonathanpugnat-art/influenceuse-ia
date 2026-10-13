import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as schema from "@/lib/db/schema";
import { setDbForTests } from "@/lib/db/client";
import { resetEnvCache } from "@/lib/env";

export type TestDatabase = PgliteDatabase<typeof schema>;

const MIGRATIONS = [
  "0000_init.sql",
  "0001_billing.sql",
  "0002_billing_hardening.sql",
  "0003_video.sql",
  "0004_identity.sql",
  "0005_clone_consent.sql",
  "0006_face_refs.sql",
  "0007_lora.sql",
] as const;

function splitStatements(sql: string): string[] {
  return sql
    .split(/-->\s*statement-breakpoint\s*/)
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((chunk) => chunk.length > 0);
}

export async function createTestDb(): Promise<{
  client: PGlite;
  db: TestDatabase;
}> {
  const client = new PGlite();
  for (const file of MIGRATIONS) {
    const raw = readFileSync(join(process.cwd(), "drizzle", file), "utf8");
    for (const statement of splitStatements(raw)) {
      await client.exec(statement);
    }
  }
  const db = drizzle(client, { schema });
  setDbForTests(db);
  return { client, db };
}

export async function destroyTestDb(client: PGlite): Promise<void> {
  setDbForTests(null);
  resetEnvCache();
  await client.close();
}

export function withCreditsEnforced(enforced: boolean): void {
  process.env.CREDITS_ENFORCED = enforced ? "true" : "false";
  process.env.INITIAL_CREDITS = "0";
  process.env.METADATA_DRIVER = "db";
  process.env.BLOB_DRIVER = "fs";
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://test";
  resetEnvCache();
}
