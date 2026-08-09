/** Suggested positioning phrases shown as chips on the identity wizard step. */
export const WIZARD_ANGLE_CHIP_NICHES = [
  "FASHION",
  "FITNESS",
  "TRAVEL",
  "GAMING",
  "FOOD",
  "LIFESTYLE",
  "TECH",
  "ADULT",
] as const;

export type WizardAngleChipNiche = (typeof WIZARD_ANGLE_CHIP_NICHES)[number];

export function isWizardAngleChipNiche(
  niche: string
): niche is WizardAngleChipNiche {
  return (WIZARD_ANGLE_CHIP_NICHES as readonly string[]).includes(niche);
}
