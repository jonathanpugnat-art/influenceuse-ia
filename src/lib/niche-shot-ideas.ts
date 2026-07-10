import type { PhotoCreatorSeed } from "@/hooks/use-photo-creator";
import type { NicheProfile } from "@/lib/niche-profile";
import { isNicheProfileUsable } from "@/lib/niche-profile";

export interface NicheShotIdea {
  id: string;
  title: string;
  sceneDescription: string;
  outfit?: string;
  pose?: string;
  expression?: string;
  pillar?: string;
}

/**
 * Build concrete photo shot ideas from the agent's niche understanding.
 * No extra LLM call — pairs content pillars with visual codes for 1-click studio seeding.
 */
export function buildNicheShotIdeas(profile: NicheProfile | null | undefined): NicheShotIdea[] {
  if (!profile || !isNicheProfileUsable(profile)) return [];

  const vc = profile.visualCodes;
  const ideas: NicheShotIdea[] = [];

  const pillars = profile.contentPillars.filter(Boolean).slice(0, 4);
  for (let i = 0; i < pillars.length; i++) {
    const pillar = pillars[i]!;
    const setting = vc.settings[i % Math.max(vc.settings.length, 1)] ?? vc.settings[0];
    const wardrobe = vc.wardrobe[i % Math.max(vc.wardrobe.length, 1)] ?? vc.wardrobe[0];
    const framing = vc.framing[i % Math.max(vc.framing.length, 1)] ?? "candid";

    ideas.push({
      id: `pillar-${i}-${pillar.slice(0, 24)}`,
      title: pillar,
      sceneDescription: [setting, pillar, vc.lighting?.trim()]
        .filter(Boolean)
        .join(", "),
      outfit: wardrobe,
      pose: framing.includes("selfie") ? "selfie" : "candid",
      expression: "smile",
      pillar,
    });
  }

  if (ideas.length === 0 && vc.settings.length > 0) {
    ideas.push({
      id: "visual-default",
      title: profile.subNiche.trim() || profile.nicheCategory,
      sceneDescription: [vc.settings[0], vc.lighting?.trim()].filter(Boolean).join(", "),
      outfit: vc.wardrobe[0],
      pose: vc.framing[0]?.includes("selfie") ? "selfie" : "candid",
      expression: "smile",
    });
  }

  return ideas.slice(0, 4);
}

export function nicheShotToPhotoSeed(
  idea: NicheShotIdea,
  influencerId: string,
  options?: { isNsfw?: boolean }
): PhotoCreatorSeed {
  return {
    influencerId,
    lookId: null,
    scene: "custom",
    sceneDescription: idea.sceneDescription,
    outfit: idea.outfit ?? "",
    pose: idea.pose ?? "candid",
    expression: idea.expression ?? "smile",
    useFaceReference: true,
    sceneFirst: false,
    contentMode: options?.isNsfw ? "NSFW" : "SFW",
    nsfwLevel: options?.isNsfw ? "suggestive" : undefined,
  };
}
