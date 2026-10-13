/**
 * Temporary dual-write gate.
 * When METADATA_DRIVER=db and BLOB_DRIVER=r2 in production, local data/ writes must stop.
 * This test fails if production env is simulated with fs drivers (covered in env.test)
 * and documents the no-local-writes KPI.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ALLOWED = new Set([
  "src/lib/blob/fs-blob-store.ts",
  "src/lib/storage.ts",
  "scripts/migrate-data-to-cloud.ts",
]);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "data") continue;
      walk(full, files);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("no-local-writes gate", () => {
  it("limits writeFile/mkdir imports outside fs drivers and storage facade", () => {
    const root = path.join(process.cwd(), "src");
    const offenders: string[] = [];
    for (const file of walk(root)) {
      const relative = path.relative(process.cwd(), file).replaceAll("\\", "/");
      if (ALLOWED.has(relative)) continue;
      if (relative.includes("/jobs/generate-post.ts")) continue;
      const source = readFileSync(file, "utf8");
      if (
        /from ["']node:fs\/promises["']/.test(source) &&
        /(writeFile|mkdir|createWriteStream)/.test(source)
      ) {
        offenders.push(relative);
      }
    }
    expect(offenders).toEqual([]);
  });
});
