import { defineConfig } from "drizzle-kit";

function loadEnvFiles() {
  // Node 20+: --env-file is preferred via npm script; this is a fallback.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { config } = require("dotenv") as typeof import("dotenv");
    config({ path: ".env.local" });
    config({ path: ".env" });
  } catch {
    // dotenv optional; rely on process.env / --env-file
  }
}

loadEnvFiles();

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "";

if (!url) {
  throw new Error(
    "DATABASE_URL_UNPOOLED (ou DIRECT_URL / DATABASE_URL) manquant pour drizzle-kit.",
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
