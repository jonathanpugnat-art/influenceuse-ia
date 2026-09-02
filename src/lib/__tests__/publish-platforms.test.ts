import { describe, expect, it } from "vitest";
import {
  autoPublishablePlatforms,
  contentKindFromType,
  defaultPlatformsForContent,
  invalidPlatformsForContent,
  platformsAllowedForContent,
  sanitizePlatformsForContent,
} from "@/lib/publish-platforms";

describe("contentKindFromType", () => {
  it("maps known Prisma types", () => {
    expect(contentKindFromType("REEL")).toBe("REEL");
    expect(contentKindFromType("CAROUSEL")).toBe("CAROUSEL");
    expect(contentKindFromType("STORY")).toBe("STORY");
    expect(contentKindFromType("PHOTO")).toBe("PHOTO");
  });

  it("falls back to PHOTO for unknown values", () => {
    expect(contentKindFromType("unknown")).toBe("PHOTO");
  });
});

describe("platformsAllowedForContent", () => {
  it("keeps TikTok off still photos", () => {
    expect(platformsAllowedForContent("PHOTO")).toEqual([
      "INSTAGRAM",
      "ONLYFANS",
    ]);
    expect(platformsAllowedForContent("CAROUSEL")).toEqual([
      "INSTAGRAM",
      "ONLYFANS",
    ]);
  });

  it("allows TikTok on reels", () => {
    expect(platformsAllowedForContent("REEL")).toEqual([
      "INSTAGRAM",
      "TIKTOK",
      "ONLYFANS",
    ]);
  });
});

describe("sanitizePlatformsForContent", () => {
  it("strips TikTok from a photo selection", () => {
    expect(
      sanitizePlatformsForContent(["INSTAGRAM", "TIKTOK"], "PHOTO")
    ).toEqual(["INSTAGRAM"]);
  });

  it("fills the type default when the list is empty", () => {
    expect(sanitizePlatformsForContent([], "REEL")).toEqual(
      defaultPlatformsForContent("REEL")
    );
    expect(sanitizePlatformsForContent([], "PHOTO")).toEqual(["INSTAGRAM"]);
  });
});

describe("autoPublishablePlatforms", () => {
  it("drops OnlyFans from the auto-publish set", () => {
    expect(
      autoPublishablePlatforms(["INSTAGRAM", "ONLYFANS", "TIKTOK"], "REEL")
    ).toEqual(["INSTAGRAM", "TIKTOK"]);
  });

  it("does not auto-publish TikTok for photos", () => {
    expect(
      autoPublishablePlatforms(["INSTAGRAM", "TIKTOK"], "PHOTO")
    ).toEqual(["INSTAGRAM"]);
  });
});

describe("invalidPlatformsForContent", () => {
  it("flags TikTok on photos", () => {
    expect(invalidPlatformsForContent(["TIKTOK", "INSTAGRAM"], "PHOTO")).toEqual(
      ["TIKTOK"]
    );
  });
});
