import { describe, it, expect } from "vitest";
import {
  FACE_LOCK_USER_MESSAGE,
  MISSING_FACE_REFERENCE_MESSAGE,
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

  it("does not claim token missing when premium model fails", () => {
    expect(
      formatGenerationErrorForUser(
        "[premium-gen] Modèle Premium introuvable sur Replicate (lucataco/flux-dev-uncensored, HTTP 404).",
        { contentMode: "NSFW" }
      )
    ).toContain("Modèle Premium introuvable");
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

  it("maps face-lock prefix to the retry-friendly French message", () => {
    const detail = "PuLID timed out on Replicate for prediction xyz";
    const formatted = formatGenerationErrorForUser(`[face-lock] ${detail}`);
    expect(formatted.startsWith(FACE_LOCK_USER_MESSAGE)).toBe(true);
    expect(formatted).toContain(detail.slice(0, 60));
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
