// ──────────────────────────────────────────────
// Logger wrapper (Sprint 10 — Polish)
//
// Tiny abstraction around `console` so we can:
//  - silence verbose logs in production tests
//  - prefix each line with a scope tag for easier grep/Vercel logs
//  - swap to Sentry/Logflare/Axiom later by changing one file
//
// This is intentionally minimal — we don't want to depend on a heavy
// logging library when 95% of our needs are `info` / `warn` / `error`.
// ──────────────────────────────────────────────

const VERBOSE = process.env.NODE_ENV !== "test" && process.env.LOG_LEVEL !== "silent";

type LogScope = `[${string}]`;

function format(scope: LogScope, msg: string, meta?: unknown): unknown[] {
  const ts = new Date().toISOString();
  return meta !== undefined ? [`${ts} ${scope}`, msg, meta] : [`${ts} ${scope}`, msg];
}

export function createLogger(scopeName: string) {
  const scope = `[${scopeName}]` as LogScope;
  return {
    debug(msg: string, meta?: unknown) {
      if (!VERBOSE) return;
      if (process.env.LOG_LEVEL === "debug") {
        console.debug(...format(scope, msg, meta));
      }
    },
    info(msg: string, meta?: unknown) {
      if (!VERBOSE) return;
      console.log(...format(scope, msg, meta));
    },
    warn(msg: string, meta?: unknown) {
      console.warn(...format(scope, msg, meta));
    },
    error(msg: string, err?: unknown) {
      console.error(...format(scope, msg, err));
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
