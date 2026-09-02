"use client";

import { useEffect } from "react";
import { useInfluencers } from "@/hooks/use-influencers";
import { resolveCreatorInfluencerId } from "@/lib/sole-influencer";

export function useAutoSelectSoleInfluencer(
  currentId: string,
  urlId: string | null,
  updateParams: (partial: { influencerId: string }) => void
): void {
  const { data } = useInfluencers(
    { limit: 50 },
    { placeholderData: (prev) => prev }
  );
  const influencers = data?.influencers;

  useEffect(() => {
    const next = resolveCreatorInfluencerId({
      currentId,
      urlId,
      influencerIds: (influencers ?? []).map((item) => item.id),
    });
    if (next && next !== currentId) {
      updateParams({ influencerId: next });
    }
  }, [currentId, influencers, updateParams, urlId]);
}
