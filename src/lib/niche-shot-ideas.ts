import type { PhotoCreatorSeed } from "@/hooks/use-photo-creator";
import type { NicheProfile } from "@/lib/niche-profile";
import { isNicheProfileUsable } from "@/lib/niche-profile";
import { buildCatalogDay1PhotoSeed } from "@/lib/niche-day1-catalog";

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
export function buildNicheShotIdeas(
  profile: NicheProfile | null | undefined
): NicheShotIdea[] {
  if (!profile || !isNicheProfileUsable(profile)) return [];

  const vc = profile.visualCodes;
  const ideas: NicheShotIdea[] = [];

  const pillars = profile.contentPillars.filter(Boolean).slice(0, 4);
  for (let i = 0; i < pillars.length; i++) {
    const pillar = pillars[i]!;
    const setting =
      vc.settings[i % Math.max(vc.settings.length, 1)] ?? vc.settings[0];
    const wardrobe =
      vc.wardrobe[i % Math.max(vc.wardrobe.length, 1)] ?? vc.wardrobe[0];
    const framing =
      vc.framing[i % Math.max(vc.framing.length, 1)] ?? "candid";

    ideas.push({
      id: `pillar-${i}-${pillar.slice(0, 24)}`,
      title: pillar,
      sceneDescription: expandShortScene(
        [setting, pillar, vc.lighting?.trim()].filter(Boolean).join(", "),
        pillar
      ),
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
      sceneDescription: expandShortScene(
        [vc.settings[0], vc.lighting?.trim()].filter(Boolean).join(", ")
      ),
      outfit: vc.wardrobe[0],
      pose: vc.framing[0]?.includes("selfie") ? "selfie" : "candid",
      expression: "smile",
    });
  }

  return ideas.slice(0, 4);
}

/** Pad thin comma-joined niche strings into a usable day-1 scene. */
export function expandShortScene(scene: string, pillar?: string): string {
  const base = scene.trim();
  if (base.length >= 90) return base;
  return [
    base || "bright lifestyle setting",
    pillar ? `creating content about ${pillar}` : null,
    "natural daylight, authentic Instagram creator photo, vertical 4:5 framing, fully clothed",
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Concrete first-photo seed from the niche catalog (no agent required).
 */
export function buildDefaultDay1PhotoSeed(
  influencerId: string,
  options?: { niche?: string | null; angle?: string | null; isNsfw?: boolean }
): PhotoCreatorSeed {
  return buildCatalogDay1PhotoSeed(influencerId, options);
}

export function nicheShotToPhotoSeed(
  idea: NicheShotIdea,
  influencerId: string,
  options?: { isNsfw?: boolean; angle?: string | null }
): PhotoCreatorSeed {
  const angle = options?.angle?.trim();
  return {
    influencerId,
    lookId: null,
    scene: "custom",
    sceneDescription: expandShortScene(
      angle
        ? `${idea.sceneDescription}. Angle: ${angle}`
        : idea.sceneDescription,
      idea.pillar
    ),
    outfit: idea.outfit?.trim()
      ? idea.outfit
      : "stylish everyday outfit, clean Instagram fashion, fully clothed",
    pose: idea.pose ?? "candid",
    expression: idea.expression ?? "smile",
    customPrompt: angle
      ? `authentic Instagram creator photo, fully clothed, natural energy. Creator angle: ${angle}.`
      : "authentic Instagram creator photo, fully clothed, natural energy",
    useFaceReference: true,
    sceneFirst: false,
    instagramShot: false,
    contentMode: options?.isNsfw ? "NSFW" : "SFW",
    nsfwLevel: options?.isNsfw ? "suggestive" : undefined,
  };
}
