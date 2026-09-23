import { describe, it, expect } from "vitest";
import {
  IDENTITY_PACK_POLL_MS,
  IDENTITY_RETRY_WATCH_MS,
  identityHintState,
  identityPackUnavailableCopy,
  identityPreviewRefetchInterval,
  isIdentityRetryWatchActive,
  resolveDisplayedIdentityPackStatus,
  settleIdentityRetryWatch,
  type IdentityHintInput,
  type IdentityRetryWatch,
} from "@/lib/remix-identity-hint";

const READY_BASE: IdentityHintInput = {
  hasFrontal: true,
  hasReferences: false,
  referenceCount: 0,
  identityPackStatus: "missing",
  hasBaseImage: true,
  isNsfw: false,
};

describe("identityHintState", () => {
  it("returns no_frontal when the character has no portrait", () => {
    expect(
      identityHintState({
        ...READY_BASE,
        hasFrontal: false,
        hasBaseImage: false,
      })
    ).toEqual({ kind: "no_frontal" });
  });

  it("prefers no_frontal over any pack state (wizard-first)", () => {
    expect(
      identityHintState({
        ...READY_BASE,
        hasFrontal: false,
        hasReferences: true,
        referenceCount: 3,
        identityPackStatus: "ready",
        hasBaseImage: false,
      })
    ).toEqual({ kind: "no_frontal" });
  });

  it("returns generating while the pack is still building", () => {
    expect(
      identityHintState({
        ...READY_BASE,
        identityPackStatus: "generating",
      })
    ).toEqual({ kind: "generating" });
  });

  it("returns failed so the UI can offer a retry", () => {
    expect(
      identityHintState({
        ...READY_BASE,
        identityPackStatus: "failed",
      })
    ).toEqual({ kind: "failed" });
  });

  it("returns missing when the frontal and base portrait exist but no refs were generated yet", () => {
    expect(identityHintState(READY_BASE)).toEqual({ kind: "missing" });
  });

  it("returns ok with the reference count when everything is ready", () => {
    expect(
      identityHintState({
        ...READY_BASE,
        hasReferences: true,
        referenceCount: 3,
        identityPackStatus: "ready",
      })
    ).toEqual({ kind: "ok", referenceCount: 3 });
  });

  it("hides the paid CTA for NSFW characters that only have a frontal", () => {
    expect(
      identityHintState({
        ...READY_BASE,
        isNsfw: true,
      })
    ).toEqual({ kind: "unavailable", reason: "nsfw" });
  });

  it("hides the retry CTA when a failed pack belongs to an NSFW character", () => {
    expect(
      identityHintState({
        ...READY_BASE,
        isNsfw: true,
        identityPackStatus: "failed",
      })
    ).toEqual({ kind: "unavailable", reason: "nsfw" });
  });

  it("prefers the NSFW reason over a missing base portrait", () => {
    expect(
      identityHintState({
        ...READY_BASE,
        isNsfw: true,
        hasBaseImage: false,
      })
    ).toEqual({ kind: "unavailable", reason: "nsfw" });
  });

  it("hides the paid CTA when the frontal is only an avatar", () => {
    expect(
      identityHintState({
        ...READY_BASE,
        hasBaseImage: false,
      })
    ).toEqual({ kind: "unavailable", reason: "no_base" });
  });

  it("keeps the waiting banner while an NSFW pack is already generating", () => {
    expect(
      identityHintState({
        ...READY_BASE,
        isNsfw: true,
        identityPackStatus: "generating",
      })
    ).toEqual({ kind: "generating" });
  });

  it("explains a blocked pack without a paid CTA or a biometric-lock claim", () => {
    for (const reason of ["nsfw", "no_base"] as const) {
      const copy = identityPackUnavailableCopy(reason);
      expect(copy.length).toBeGreaterThan(20);
      expect(copy.toLowerCase()).not.toContain("crédit");
      expect(copy.toLowerCase()).not.toContain("biométr");
    }
    expect(identityPackUnavailableCopy("nsfw")).toContain("NSFW");
    expect(identityPackUnavailableCopy("no_base")).toContain("portrait de base");
  });

  it("still reports ok when a ready pack exists on an NSFW character", () => {
    expect(
      identityHintState({
        ...READY_BASE,
        isNsfw: true,
        hasReferences: true,
        referenceCount: 2,
        identityPackStatus: "ready",
      })
    ).toEqual({ kind: "ok", referenceCount: 2 });
  });
});

describe("identity retry watch", () => {
  const startedAt = 1_000_000;
  const watch: IdentityRetryWatch = {
    influencerId: "inf-a",
    startedAt,
  };

  it("polls while generating even without a retry watch", () => {
    expect(
      identityPreviewRefetchInterval({
        status: "generating",
        watch: null,
        influencerId: "inf-a",
        now: startedAt,
      })
    ).toBe(IDENTITY_PACK_POLL_MS);
  });

  it("does not poll a failed pack until a retry watch is armed", () => {
    expect(
      identityPreviewRefetchInterval({
        status: "failed",
        watch: null,
        influencerId: "inf-a",
        now: startedAt,
      })
    ).toBe(false);
  });

  it("keeps polling when the first refetch after retry still sees failed", () => {
    expect(
      isIdentityRetryWatchActive({
        watch,
        influencerId: "inf-a",
        status: "failed",
        now: startedAt + 1_000,
      })
    ).toBe(true);
    expect(
      identityPreviewRefetchInterval({
        status: "failed",
        watch,
        influencerId: "inf-a",
        now: startedAt + 1_000,
      })
    ).toBe(IDENTITY_PACK_POLL_MS);
  });

  it("does not let another character's watch start polling", () => {
    expect(
      identityPreviewRefetchInterval({
        status: "failed",
        watch,
        influencerId: "inf-b",
        now: startedAt + 1_000,
      })
    ).toBe(false);
  });

  it("stops the watch once it expires", () => {
    const now = startedAt + IDENTITY_RETRY_WATCH_MS + 1;
    expect(
      identityPreviewRefetchInterval({
        status: "failed",
        watch,
        influencerId: "inf-a",
        now,
      })
    ).toBe(false);
    expect(
      settleIdentityRetryWatch({
        watch,
        influencerId: "inf-a",
        status: "failed",
        now,
      })
    ).toBeNull();
  });

  it("clears the watch when status leaves failed, without touching another character", () => {
    expect(
      settleIdentityRetryWatch({
        watch,
        influencerId: "inf-a",
        status: "generating",
        now: startedAt + 2_000,
      })
    ).toBeNull();
    expect(
      settleIdentityRetryWatch({
        watch,
        influencerId: "inf-b",
        status: "ready",
        now: startedAt + 2_000,
      })
    ).toEqual(watch);
  });

  it("renders the waiting banner while the pre-retry failed snapshot is still current", () => {
    expect(
      resolveDisplayedIdentityPackStatus({
        status: "failed",
        watch,
        influencerId: "inf-a",
        now: startedAt + 500,
      })
    ).toBe("generating");
    expect(
      resolveDisplayedIdentityPackStatus({
        status: "failed",
        watch,
        influencerId: "inf-b",
        now: startedAt + 500,
      })
    ).toBe("failed");
    expect(
      resolveDisplayedIdentityPackStatus({
        status: "ready",
        watch,
        influencerId: "inf-a",
        now: startedAt + 500,
      })
    ).toBe("ready");
  });
});
