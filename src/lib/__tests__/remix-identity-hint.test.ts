import { describe, it, expect } from "vitest";
import { identityHintState } from "@/lib/remix-identity-hint";

describe("identityHintState", () => {
  it("returns no_frontal when the character has no portrait", () => {
    expect(
      identityHintState({
        hasFrontal: false,
        hasReferences: false,
        referenceCount: 0,
        identityPackStatus: "missing",
      })
    ).toEqual({ kind: "no_frontal" });
  });

  it("prefers no_frontal over any pack state (wizard-first)", () => {
    // A pack that's marked ready but the frontal was somehow lost still
    // needs a wizard completion before we surface the pack CTA — the
    // remix cascade cannot ancre the face without a portrait.
    expect(
      identityHintState({
        hasFrontal: false,
        hasReferences: true,
        referenceCount: 3,
        identityPackStatus: "ready",
      })
    ).toEqual({ kind: "no_frontal" });
  });

  it("returns generating while the pack is still building", () => {
    expect(
      identityHintState({
        hasFrontal: true,
        hasReferences: false,
        referenceCount: 0,
        identityPackStatus: "generating",
      })
    ).toEqual({ kind: "generating" });
  });

  it("returns failed so the UI can offer a retry", () => {
    expect(
      identityHintState({
        hasFrontal: true,
        hasReferences: false,
        referenceCount: 0,
        identityPackStatus: "failed",
      })
    ).toEqual({ kind: "failed" });
  });

  it("returns missing when the frontal exists but no refs were generated yet", () => {
    // The classic Luana case: wizard-completed frontal, no identityPack
    // row at all. This is the state that was previously blocked with
    // "génère le pack" copy but no button.
    expect(
      identityHintState({
        hasFrontal: true,
        hasReferences: false,
        referenceCount: 0,
        identityPackStatus: "missing",
      })
    ).toEqual({ kind: "missing" });
  });

  it("returns ok with the reference count when everything is ready", () => {
    expect(
      identityHintState({
        hasFrontal: true,
        hasReferences: true,
        referenceCount: 3,
        identityPackStatus: "ready",
      })
    ).toEqual({ kind: "ok", referenceCount: 3 });
  });
});
