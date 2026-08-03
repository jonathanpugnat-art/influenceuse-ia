import type { PhotoCreatorInput } from "@/server/trpc/schemas/content";

export function photoParamsBlob(
  input: PhotoCreatorInput,
  extra: Record<string, unknown> = {}
): object {
  return {
    scene: input.scene,
    sceneDescription: input.sceneDescription,
    pose: input.pose,
    outfit: input.outfit,
    expression: input.expression,
    photoStyle: input.photoStyle,
    timeOfDay: input.timeOfDay,
    location: input.location,
    customPrompt: input.customPrompt,
    numberOfImages: input.numberOfImages,
    useFaceReference: input.useFaceReference,
    contentMode: input.contentMode,
    lookId: input.lookId,
    instagramShot: input.instagramShot,
    trendContext: input.trendContext,
    trendItemId: input.trendItemId,
    recommendationId: input.recommendationId,
    ...extra,
  };
}

export function parsePhotoPhase(params: unknown): string | undefined {
  if (!params || typeof params !== "object") return undefined;
  const phase = (params as { photoPhase?: unknown }).photoPhase;
  return typeof phase === "string" ? phase : undefined;
}

export function parseScenePlateUrl(params: unknown): string | undefined {
  if (!params || typeof params !== "object") return undefined;
  const url = (params as { scenePlateUrl?: unknown }).scenePlateUrl;
  return typeof url === "string" && url.startsWith("http") ? url : undefined;
}

export function photoCreatorInputFromStoredParams(
  influencerId: string,
  stored: Record<string, unknown>,
  numberOfImages: number
): PhotoCreatorInput {
  return {
    influencerId,
    scene: String(stored.scene ?? "custom"),
    sceneDescription:
      typeof stored.sceneDescription === "string"
        ? stored.sceneDescription
        : undefined,
    pose: String(stored.pose ?? "portrait"),
    outfit: String(stored.outfit ?? ""),
    expression: String(stored.expression ?? "natural"),
    photoStyle: String(stored.photoStyle ?? "natural"),
    timeOfDay: String(stored.timeOfDay ?? "natural"),
    location: typeof stored.location === "string" ? stored.location : undefined,
    customPrompt:
      typeof stored.customPrompt === "string" ? stored.customPrompt : undefined,
    numberOfImages,
    contentMode: "SFW",
    useFaceReference: true,
  };
}
