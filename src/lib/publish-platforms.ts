/** Platforms the product can target, matching Prisma `Platform`. */
export type PublishPlatform = "INSTAGRAM" | "TIKTOK" | "ONLYFANS";

/** Content types the publisher understands, matching Prisma `ContentType`. */
export type ContentMediaKind = "PHOTO" | "CAROUSEL" | "REEL" | "STORY";

export type AutoPublishPlatform = Extract<PublishPlatform, "INSTAGRAM" | "TIKTOK">;

const PHOTO_PLATFORMS: readonly PublishPlatform[] = ["INSTAGRAM", "ONLYFANS"];
const REEL_PLATFORMS: readonly PublishPlatform[] = [
  "INSTAGRAM",
  "TIKTOK",
  "ONLYFANS",
];
const STORY_PLATFORMS: readonly PublishPlatform[] = ["INSTAGRAM"];

export function contentKindFromType(type: string): ContentMediaKind {
  switch (type) {
    case "REEL":
      return "REEL";
    case "CAROUSEL":
      return "CAROUSEL";
    case "STORY":
      return "STORY";
    case "PHOTO":
      return "PHOTO";
    default:
      return "PHOTO";
  }
}

export function platformsAllowedForContent(
  kind: ContentMediaKind
): readonly PublishPlatform[] {
  switch (kind) {
    case "PHOTO":
    case "CAROUSEL":
      return PHOTO_PLATFORMS;
    case "REEL":
      return REEL_PLATFORMS;
    case "STORY":
      return STORY_PLATFORMS;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function defaultPlatformsForContent(
  kind: ContentMediaKind
): PublishPlatform[] {
  switch (kind) {
    case "PHOTO":
    case "CAROUSEL":
    case "STORY":
      return ["INSTAGRAM"];
    case "REEL":
      return ["INSTAGRAM", "TIKTOK"];
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function isPublishPlatform(value: string): value is PublishPlatform {
  return value === "INSTAGRAM" || value === "TIKTOK" || value === "ONLYFANS";
}

export function isAutoPublishPlatform(
  value: string
): value is AutoPublishPlatform {
  return value === "INSTAGRAM" || value === "TIKTOK";
}

/**
 * Keep platforms that the content type can actually ship.
 * If nothing remains, fall back to the type default (never an empty list).
 */
export function sanitizePlatformsForContent(
  platforms: readonly string[],
  kind: ContentMediaKind
): PublishPlatform[] {
  const allowed = new Set(platformsAllowedForContent(kind));
  const filtered = platforms.filter(
    (p): p is PublishPlatform => isPublishPlatform(p) && allowed.has(p)
  );
  return filtered.length > 0 ? filtered : defaultPlatformsForContent(kind);
}

/** Instagram + TikTok only — OnlyFans stays a manual ZIP. */
export function autoPublishablePlatforms(
  platforms: readonly string[],
  kind: ContentMediaKind
): AutoPublishPlatform[] {
  return sanitizePlatformsForContent(platforms, kind).filter(
    isAutoPublishPlatform
  );
}

export function invalidPlatformsForContent(
  platforms: readonly string[],
  kind: ContentMediaKind
): PublishPlatform[] {
  const allowed = new Set(platformsAllowedForContent(kind));
  return platforms.filter(
    (p): p is PublishPlatform => isPublishPlatform(p) && !allowed.has(p)
  );
}

/** Platforms to send to `publishNow` from a calendar event. */
export function calendarAutoPublishPlatforms(event: {
  type: string;
  platforms: readonly string[];
}): AutoPublishPlatform[] {
  return autoPublishablePlatforms(
    event.platforms,
    contentKindFromType(event.type)
  );
}
