import { describe, it, expect } from "vitest";
import {
  FACE_LOCK_USER_MESSAGE,
  MISSING_FACE_REFERENCE_MESSAGE,
  PROVIDER_UNAVAILABLE_USER_MESSAGE,
  formatGenerationErrorForUser,
  isContentSafetyFilterError,
  isFaceLockError,
  isReplicateAccessibleImageUrl,
  LOCALHOST_REF_MESSAGE,
  PREMIUM_GENERATION_USER_MESSAGE,
  SOCIAL_SAFETY_USER_MESSAGE,
  throwFaceLockError,
  throwMissingFaceReferenceError,
} from "@/lib/generation-errors";

describe("isContentSafetyFilterError", () => {
  it("detects Replicate E005 sensitive flag", () => {
    expect(
      isContentSafetyFilterError(
        new Error(
          "Prediction failed: The input or output was flagged as sensitive. (E005)"
        )
      )
    ).toBe(true);
  });

  it("detects social safety prefix", () => {
    expect(isContentSafetyFilterError(new Error("[social-safety]"))).toBe(true);
  });
});

describe("formatGenerationErrorForUser", () => {
  it("maps localhost reference errors", () => {
    expect(formatGenerationErrorForUser(LOCALHOST_REF_MESSAGE)).toBe(
      LOCALHOST_REF_MESSAGE
    );
  });

  it("maps explicit missing token errors", () => {
    expect(
      formatGenerationErrorForUser("REPLICATE_API_TOKEN is not configured. Set it in your .env file.")
    ).toContain("REPLICATE_API_TOKEN manquant");
  });

  it("does not claim token missing when premium model fails, and does not leak model slug or HTTP status", () => {
    const formatted = formatGenerationErrorForUser(
      "[premium-gen] Modèle Premium introuvable sur Replicate (lucataco/flux-dev-uncensored, HTTP 404).",
      { contentMode: "NSFW" }
    );
    // Must not misroute to the token-missing branch.
    expect(formatted).not.toContain("REPLICATE_API_TOKEN manquant");
    // Must sanitize provider identifiers (URL, HTTP status, slug, name).
    expect(formatted).not.toContain("Replicate");
    expect(formatted).not.toContain("lucataco/flux-dev-uncensored");
    expect(formatted).not.toContain("HTTP 404");
    // Falls back to the friendly Premium copy — no raw provider detail.
    expect(formatted).toBe(PREMIUM_GENERATION_USER_MESSAGE);
  });

  it("maps E005 to social safety message on SFW lane", () => {
    expect(
      formatGenerationErrorForUser(
        "Prediction failed Error: flagged as sensitive (E005)",
        { contentMode: "SFW" }
      )
    ).toBe(SOCIAL_SAFETY_USER_MESSAGE);
  });

  it("maps E005 to premium message on NSFW lane", () => {
    expect(
      formatGenerationErrorForUser(
        "Prediction failed Error: flagged as sensitive (E005)",
        { contentMode: "NSFW" }
      )
    ).toBe(PREMIUM_GENERATION_USER_MESSAGE);
  });

  it("maps premium-gen prefix", () => {
    expect(
      formatGenerationErrorForUser("[premium-gen] Model timeout on uncensored flux")
    ).toContain("Model timeout");
  });

  it("maps rate limits", () => {
    expect(formatGenerationErrorForUser("429 Too Many Requests")).toContain(
      "Attendez"
    );
  });
});

describe("face-lock errors", () => {
  it("throwFaceLockError yields a [face-lock] prefixed error detected by isFaceLockError", () => {
    let caught: unknown;
    try {
      throwFaceLockError("PuLID timed out on Replicate");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(isFaceLockError(caught)).toBe(true);
  });

  it("maps face-lock prefix to the retry-friendly French message without leaking detail", () => {
    const detail = "PuLID timed out on Replicate for prediction xyz";
    const formatted = formatGenerationErrorForUser(`[face-lock] ${detail}`);
    expect(formatted).toBe(FACE_LOCK_USER_MESSAGE);
    // Server-side identifiers and provider names must never reach the UI.
    expect(formatted).not.toContain("PuLID");
    expect(formatted).not.toContain("Replicate");
    expect(formatted).not.toContain("prediction");
  });

  it("maps MISSING_FACE_REF face-lock detail to the missing portrait message", () => {
    let caught: unknown;
    try {
      throwMissingFaceReferenceError();
    } catch (err) {
      caught = err;
    }
    const raw = caught instanceof Error ? caught.message : String(caught);
    expect(formatGenerationErrorForUser(raw)).toBe(MISSING_FACE_REFERENCE_MESSAGE);
  });

  // Regression: QA (Luana SFW café selfie) saw the raw Replicate 402 payload
  // — URL, HTTP status, JSON body, and the "PuLID (NSFW suggestive)" lane
  // label — pasted into the studio error dialog. The user-facing copy must
  // never surface any of that; the raw text belongs in server logs only.
  it("sanitizes Replicate 402 face-lock payload into a neutral service-unavailable message", () => {
    const raw =
      '[face-lock] PuLID (NSFW suggestive): Request to `https://api.replicate.com/v1/predictions`' +
      ' failed with status 402: {"detail":"Insufficient credit"}.';
    const formatted = formatGenerationErrorForUser(raw, { contentMode: "SFW" });
    expect(formatted).toBe(PROVIDER_UNAVAILABLE_USER_MESSAGE);
    expect(formatted).not.toContain("replicate");
    expect(formatted).not.toContain("api.replicate.com");
    expect(formatted).not.toContain("402");
    expect(formatted).not.toContain("PuLID");
    expect(formatted).not.toContain("NSFW");
    expect(formatted).not.toContain("Insufficient credit");
  });

  it("collapses provider quota text outside the face-lock prefix to the neutral message", () => {
    const raw =
      'Request to `https://api.replicate.com/v1/predictions` failed with status 402: {"detail":"Insufficient credit"}';
    const formatted = formatGenerationErrorForUser(raw);
    expect(formatted).toBe(PROVIDER_UNAVAILABLE_USER_MESSAGE);
    expect(formatted).not.toContain("Insufficient credit");
    expect(formatted).not.toContain("api.replicate.com");
  });

  it("keeps Aura's own 'Crédits insuffisants' copy verbatim (user-facing wallet balance)", () => {
    const raw = "Crédits insuffisants. Coût : 3, Restant : calculé.";
    expect(formatGenerationErrorForUser(raw)).toBe(raw);
  });

  it("does not leak provider URLs through the generic fallback branch", () => {
    const raw =
      "Something unexpected happened while calling https://api.provider.example/v1/generate";
    const formatted = formatGenerationErrorForUser(raw);
    expect(formatted).not.toContain("https://");
    expect(formatted).not.toContain("api.provider.example");
  });
});

describe("isReplicateAccessibleImageUrl", () => {
  it("rejects localhost", () => {
    expect(
      isReplicateAccessibleImageUrl("http://localhost:3000/uploads/x.jpg")
    ).toBe(false);
  });

  it("accepts https public urls", () => {
    expect(isReplicateAccessibleImageUrl("https://cdn.example.com/a.jpg")).toBe(
      true
    );
  });
});
