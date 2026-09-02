import { describe, expect, it } from "vitest";
import { resolveCreatorInfluencerId } from "@/lib/sole-influencer";

describe("resolveCreatorInfluencerId", () => {
  it("prefers the URL influencer over the roster", () => {
    expect(
      resolveCreatorInfluencerId({
        currentId: "current",
        urlId: "from-url",
        influencerIds: ["solo"],
      })
    ).toBe("from-url");
  });

  it("keeps the current selection when there is no URL id", () => {
    expect(
      resolveCreatorInfluencerId({
        currentId: "current",
        urlId: null,
        influencerIds: ["a", "b"],
      })
    ).toBe("current");
  });

  it("selects the only influencer when nothing is chosen", () => {
    expect(
      resolveCreatorInfluencerId({
        currentId: "",
        urlId: null,
        influencerIds: ["solo"],
      })
    ).toBe("solo");
  });

  it("does not guess when several influencers exist", () => {
    expect(
      resolveCreatorInfluencerId({
        currentId: "  ",
        urlId: null,
        influencerIds: ["a", "b"],
      })
    ).toBeUndefined();
  });
});
