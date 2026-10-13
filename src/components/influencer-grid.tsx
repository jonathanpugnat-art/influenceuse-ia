"use client";

import { InfluencerCard, NewInfluencerCard } from "@/components/influencer-card";
import { FadeItem, Stagger } from "@/components/motion";
import type { CharacterSummary } from "@/lib/storage";

type InfluencerGridProps = {
  characters: CharacterSummary[];
  /** Path suffix after `/personnages/:id`, e.g. `/contenu?format=…` or empty for detail. */
  pathSuffix?: string;
  /** When true, niche-ready characters get `pathSuffix`; others go to detail. */
  nicheGate?: boolean;
  showNew?: boolean;
};

export function InfluencerGrid({
  characters,
  pathSuffix = "",
  nicheGate = false,
  showNew = true,
}: InfluencerGridProps) {
  return (
    <Stagger className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {characters.map((character) => {
        const href =
          nicheGate && !character.nicheSubject
            ? `/personnages/${character.id}`
            : `/personnages/${character.id}${pathSuffix}`;
        return (
          <FadeItem key={character.id}>
            <InfluencerCard character={character} href={href} />
          </FadeItem>
        );
      })}
      {showNew ? (
        <FadeItem>
          <NewInfluencerCard />
        </FadeItem>
      ) : null}
    </Stagger>
  );
}
