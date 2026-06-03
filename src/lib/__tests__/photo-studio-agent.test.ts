import { describe, expect, it } from "vitest";
import {
  buildFallbackAgentTurn,
  pickLooksForIntent,
} from "@/lib/photo-studio-agent";

describe("photo-studio-agent", () => {
  it("pickLooksForIntent ranks cafe keywords", () => {
    const looks = pickLooksForIntent("selfie café cozy matin", 3);
    expect(looks[0]?.id).toBe("cafe-aesthetic");
  });

  it("fallback turn 1 suggests looks", () => {
    const result = buildFallbackAgentTurn(
      {
        locale: "fr",
        gender: "female",
        userMessage: "gym mirror selfie",
        assistantTurnCount: 0,
        history: [{ role: "user", content: "gym mirror selfie" }],
      },
      []
    );
    expect(result.phase).toBe("looks");
    expect(result.suggestedLookIds.length).toBeGreaterThan(0);
    expect(result.showBrief).toBe(false);
  });

  it("fallback turn 2 suggests outfits after look pick", () => {
    const result = buildFallbackAgentTurn(
      {
        locale: "en",
        gender: "female",
        selectedLookId: "cafe-aesthetic",
        assistantTurnCount: 1,
        history: [],
      },
      ["oversized sweater and jeans", "midi dress casual"]
    );
    expect(result.phase).toBe("outfits");
    expect(result.suggestedOutfits.length).toBe(2);
  });

  it("fallback shows brief when outfit selected", () => {
    const result = buildFallbackAgentTurn(
      {
        locale: "fr",
        gender: "female",
        selectedLookId: "cafe-aesthetic",
        selectedOutfit: "pull beige",
        assistantTurnCount: 2,
        history: [],
      },
      []
    );
    expect(result.phase).toBe("ready");
    expect(result.showBrief).toBe(true);
  });
});
