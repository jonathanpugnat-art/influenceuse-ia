import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function timeImport(label: string, specifier: string) {
  const start = performance.now();
  await import(path.join(root, specifier));
  console.log(`${label.padEnd(28)} ${(performance.now() - start).toFixed(0)} ms`);
}

async function main() {
  console.log(`Branch: ${process.env.GIT_BRANCH ?? "unknown"}`);
  console.log("─".repeat(40));
  await timeImport("appRouter", "src/server/trpc/router.ts");
  await timeImport("billing router only", "src/server/trpc/routers/billing.ts");
  try {
    await timeImport("content/index router", "src/server/trpc/routers/content/index.ts");
    await timeImport("photo.router", "src/server/trpc/routers/content/photo.router.ts");
  } catch {
    await timeImport("content router (legacy)", "src/server/trpc/routers/content.ts");
  }
  await timeImport("ai-image.service", "src/server/services/ai-image.service.ts");
  await timeImport("trends.service", "src/server/services/trends.service.ts");
}

main().catch((e) => { console.error(e); process.exit(1); });
