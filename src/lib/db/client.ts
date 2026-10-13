import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import * as schema from "@/lib/db/schema";
import { getEnv } from "@/lib/env";

export type Database = NeonDatabase<typeof schema>;

let pool: Pool | null = null;
let db: Database | null = null;

export function getDb(): Database {
  if (db) return db;
  const env = getEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL manquant");
  }
  pool = new Pool({ connectionString: env.DATABASE_URL });
  db = drizzle(pool, { schema });
  return db;
}

/** Injecte une instance Drizzle (ex. PGlite) pour les tests. */
export function setDbForTests(instance: unknown): void {
  db = instance as Database | null;
  if (!instance) pool = null;
}
