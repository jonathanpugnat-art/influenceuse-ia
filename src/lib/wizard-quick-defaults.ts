import type { WizardData } from "@/hooks/use-influencer-wizard";

/** Fill required API fields when the user only gave name + portrait (+ optional brief). */
export function ensureWizardMinimumFields(data: WizardData): WizardData {
  const name = data.name.trim() || "Créatrice";
  const brief = data.brief?.trim() || "";
  const bio =
    data.bio.trim().length >= 10
      ? data.bio.trim()
      : brief.length >= 10
        ? brief
        : `${name} — créatrice de contenu IA, style naturel et authentique.`;
  const personality =
    data.personality.trim().length >= 10
      ? data.personality.trim()
      : `${name} est confiante, expressive et proche de sa communauté.`;
  const niche = data.niche?.trim() || "LIFESTYLE";

  return {
    ...data,
    name,
    bio,
    personality,
    niche,
    age: data.age || 24,
    brief: brief || data.brief,
  };
}

export function isQuickWizardReady(
  data: WizardData,
  portraitUrl: string | null | undefined
): boolean {
  return (
    data.name.trim().length >= 2 &&
    Boolean(portraitUrl?.trim())
  );
}
