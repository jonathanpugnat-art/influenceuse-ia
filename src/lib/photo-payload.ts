import type { PhotoParams } from "@/hooks/use-photo-creator";

/** Payload sent to `content.generatePhoto` / scene plate mutations. */
export function buildPhotoPayload(params: PhotoParams) {
  return {
    influencerId: params.influencerId,
    scene: params.scene,
    sceneDescription: params.sceneDescription.trim() || undefined,
    pose: params.pose,
    outfit: params.outfit,
    expression: params.expression,
    photoStyle: params.photoStyle,
    timeOfDay: params.timeOfDay,
    location: params.location || undefined,
    customPrompt: params.customPrompt || undefined,
    numberOfImages: params.numberOfImages,
    contentMode: params.contentMode,
    nsfwLevel: params.contentMode === "NSFW" ? params.nsfwLevel : undefined,
    useFaceReference: params.useFaceReference,
    lookId: params.lookId ?? undefined,
    instagramShot: params.instagramShot,
  };
}
