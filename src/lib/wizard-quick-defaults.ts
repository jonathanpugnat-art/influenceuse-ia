import type { WizardData } from "@/hooks/use-influencer-wizard";
import type { NicheCategory, NicheProfile } from "@/lib/niche-profile";
import { NICHE_VISUAL_PRESETS } from "@/lib/niche-visual-presets";
import { resolveNicheCategoryKey } from "@/lib/niche-day1-catalog";

/** Minimal niche profile from enum + angle — no agent chat required. */
export function buildMinimalNicheProfile(
  niche: string,
  angle: string
): NicheProfile {
  const nicheCategory = resolveNicheCategoryKey(niche) as NicheCategory;
  const trimmed = angle.trim();
  return {
    nicheCategory,
    subNiche: trimmed.slice(0, 120),
    purpose: trimmed.slice(0, 400),
    targetAudience: "",
    tone: "",
    contentPillars: trimmed ? [trimmed.slice(0, 80)] : [],
    visualCodes: NICHE_VISUAL_PRESETS[nicheCategory],
    doNots: [],
  };
}

/** Fill required API fields when the user only gave name + portrait (+ optional brief/angle). */
export function ensureWizardMinimumFields(data: WizardData): WizardData {
  const name = data.name.trim() || "Créatrice";
  const angle = (data.angle ?? "").trim() || data.brief?.trim() || "";
  const bio =
    data.bio.trim().length >= 10
      ? data.bio.trim()
      : angle.length >= 10
        ? angle
        : `${name} — créatrice de contenu IA, style naturel et authentique.`;
  const personality =
    data.personality.trim().length >= 10
      ? data.personality.trim()
      : angle.length >= 10
        ? `${name} : ${angle}`
        : `${name} est confiante, expressive et proche de sa communauté.`;
  const niche = data.niche?.trim() || "LIFESTYLE";
  const brief = data.brief?.trim() || angle || undefined;
  const nicheProfile =
    data.nicheProfile ??
    (angle ? buildMinimalNicheProfile(niche, angle) : undefined);

  return {
    ...data,
    name,
    angle,
    bio,
    personality,
    niche,
    age: data.age || 24,
    brief,
    nicheProfile,
  };
}

export function isQuickWizardReady(
  data: WizardData,
  portraitUrl: string | null | undefined
): boolean {
  return data.name.trim().length >= 2 && Boolean(portraitUrl?.trim());
}
