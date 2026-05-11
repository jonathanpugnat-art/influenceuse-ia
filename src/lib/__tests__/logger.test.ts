import { describe, it, expect, vi, afterEach } from "vitest";
import { createLogger } from "@/lib/logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a logger that prefixes its scope", () => {
    // VERBOSE is false in NODE_ENV=test (vitest default), so info/debug are silenced.
    // We verify warn/error still go through and include the scope prefix.
    const log = createLogger("test-suite");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    log.warn("hello", { foo: 1 });
    log.error("oops", new Error("boom"));

    expect(warnSpy).toHaveBeenCalled();
    const warnArgs = warnSpy.mock.calls[0];
    expect(String(warnArgs[0])).toContain("[test-suite]");
    expect(warnArgs[1]).toBe("hello");

    expect(errorSpy).toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0][0])).toContain("[test-suite]");
  });

  it("silences info/debug when VERBOSE=false (NODE_ENV=test)", () => {
    const log = createLogger("silent");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    log.info("should not appear");
    log.debug("should not appear");

    expect(logSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();
  });
});
