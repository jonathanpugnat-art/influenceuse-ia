import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildSignedOAuthState,
  verifySignedOAuthState,
} from "@/lib/oauth-state";

describe("oauth-state", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = "test-secret";
    vi.useRealTimers();
  });

  it("round-trips a state for the same user", () => {
    const state = buildSignedOAuthState("inf-1", "user-1");
    expect(verifySignedOAuthState(state, "user-1")).toBe("inf-1");
  });

  it("rejects a state minted for another user (CSRF guard)", () => {
    const state = buildSignedOAuthState("inf-1", "attacker");
    expect(verifySignedOAuthState(state, "victim")).toBeNull();
  });

  it("rejects a tampered influencerId", () => {
    const state = buildSignedOAuthState("inf-1", "user-1");
    const [, exp, sig] = state.split(".");
    expect(verifySignedOAuthState(`inf-OTHER.${exp}.${sig}`, "user-1")).toBeNull();
  });

  it("rejects a raw legacy state (no signature)", () => {
    expect(verifySignedOAuthState("inf-1", "user-1")).toBeNull();
  });

  it("rejects an expired state", () => {
    const state = buildSignedOAuthState("inf-1", "user-1");
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    expect(verifySignedOAuthState(state, "user-1")).toBeNull();
  });
});
