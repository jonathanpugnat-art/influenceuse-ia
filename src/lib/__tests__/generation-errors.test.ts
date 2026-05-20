import { describe, it, expect } from "vitest";
import {
  formatGenerationErrorForUser,
  isContentSafetyFilterError,
  isReplicateAccessibleImageUrl,
  LOCALHOST_REF_MESSAGE,
  NSFW_USER_MESSAGE,
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

  it("detects French user message constant", () => {
    expect(isContentSafetyFilterError(new Error(NSFW_USER_MESSAGE))).toBe(true);
  });
});

describe("formatGenerationErrorForUser", () => {
  it("maps localhost reference errors", () => {
    expect(formatGenerationErrorForUser(LOCALHOST_REF_MESSAGE)).toBe(
      LOCALHOST_REF_MESSAGE
    );
  });

  it("maps missing Replicate token", () => {
    expect(
      formatGenerationErrorForUser("REPLICATE_API_TOKEN is not configured")
    ).toContain("Replicate");
  });

  it("maps E005 to French safety message", () => {
    expect(
      formatGenerationErrorForUser(
        "Prediction failed Error: flagged as sensitive (E005)"
      )
    ).toBe(NSFW_USER_MESSAGE);
  });

  it("maps rate limits", () => {
    expect(formatGenerationErrorForUser("429 Too Many Requests")).toContain(
      "Attendez"
    );
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
