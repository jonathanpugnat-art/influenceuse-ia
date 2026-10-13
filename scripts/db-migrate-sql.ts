/**
 * Fallback migrate: apply drizzle/0000_init.sql via Neon HTTP (no websocket).
 * Safe to re-run only if tables do not already exist — aborts if P0 tables present.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL_UNPOOLED / DIRECT_URL / DATABASE_URL manquant.");
  process.exit(1);
}

const sql = neon(url);

const expected = [
  "users",
  "characters",
  "previews",
  "posts",
  "jobs",
  "credits_ledger",
  "trends",
] as const;

async function main() {
  const existing = await sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = ANY(${expected as unknown as string[]})
  `;
  const present = new Set(existing.map((r) => String(r.tablename)));
  if (present.size === expected.length) {
    console.log("Schéma P0 déjà présent — rien à faire.");
    return;
  }
  if (present.size > 0) {
    console.error(
      "Schéma P0 partiel détecté:",
      [...present].join(", "),
      "— corrige manuellement avant de relancer.",
    );
    process.exit(1);
  }

  const file = resolve(process.cwd(), "drizzle/0000_init.sql");
  const raw = readFileSync(file, "utf8");
  // neon() HTTP does not support multi-statement; split on semicolons carefully.
  const statements = raw
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`Application de ${statements.length} statements depuis 0000_init.sql…`);
  for (const statement of statements) {
    const cleaned = statement
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim();
    if (!cleaned) continue;
    await sql.query(cleaned);
  }

  const after = await sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = ANY(${expected as unknown as string[]})
    ORDER BY 1
  `;
  console.log(
    "OK — tables P0:",
    after.map((r) => r.tablename).join(", "),
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
