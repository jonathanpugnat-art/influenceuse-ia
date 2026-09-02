/**
 * Pick which influencer the photo/reel studio should use.
 * URL query wins, then an already selected id, then the only roster member.
 */
export function resolveCreatorInfluencerId(input: {
  currentId: string;
  urlId: string | null;
  influencerIds: string[];
}): string | undefined {
  const urlId = input.urlId?.trim() || undefined;
  if (urlId) return urlId;

  const currentId = input.currentId.trim() || undefined;
  if (currentId) return currentId;

  if (input.influencerIds.length === 1) {
    return input.influencerIds[0];
  }

  return undefined;
}
