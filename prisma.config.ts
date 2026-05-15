// Prisma 7.x moved the datasource URL out of `schema.prisma` and into this
// config file. Prisma 7.4 doesn't yet support a `directUrl` field on the
// Datasource type — so we resolve the right URL ourselves:
//
//   - At Vercel build-time (`prisma migrate deploy`), we MUST use the
//     direct Supabase endpoint (port 5432) because PgBouncer transaction
//     mode breaks Prisma's prepared statements. We surface DIRECT_URL
//     as the active URL.
//   - At runtime (PrismaClient inside Next.js handlers), we want the
//     pooled endpoint (port 6543) so Vercel functions share a connection.
//     Runtime doesn't load this config file — it reads DATABASE_URL
//     directly from the env — so this branch only affects Migrate.
//
// We detect "migrate-time" via the presence of `PRISMA_MIGRATE=1`, which
// the Vercel build command sets just before `prisma migrate deploy`. In
// every other context (local `next dev`, runtime serverless), DATABASE_URL
// is returned untouched.
import "dotenv/config";
import { defineConfig } from "prisma/config";

const isMigrate = process.env.PRISMA_MIGRATE === "1";
const url = isMigrate
  ? (process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"])
  : process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
