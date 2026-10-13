import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: [
      "src/lib/scenes.test.ts",
      "src/lib/formats.test.ts",
      "src/lib/reels.test.ts",
      "src/lib/rate-limit.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
