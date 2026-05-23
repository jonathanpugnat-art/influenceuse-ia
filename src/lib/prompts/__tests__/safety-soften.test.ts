import { describe, it, expect } from "vitest";
import { softenPromptForEditorial } from "@/lib/prompts/safety-soften";

describe("softenPromptForEditorial", () => {
  it("replaces sensitive tokens and adds editorial prefix", () => {
    const out = softenPromptForEditorial(
      "sexy lingerie in bathroom mirror, seductive pose"
    );
    expect(out).toContain("High-end Instagram fashion");
    expect(out).not.toMatch(/\bsexy\b/i);
    expect(out).toContain("lace lounge outfit");
  });
});
