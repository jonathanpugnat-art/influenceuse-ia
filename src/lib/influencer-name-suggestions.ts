// Sprint 14 — Diverse pool of placeholder names for the influencer wizard.
//
// Why: the previous placeholder was hardcoded to "Luna Fit" which made
// every new user in a hurry validate without changing it, leading to
// dozens of clones in the platform. We rotate a randomised pool of 50
// names every wizard mount instead — fast, free, never the same twice.
//
// Names chosen to cover diverse cultural backgrounds (Western European,
// Latin, Asian, African, Middle-Eastern, Slavic, Nordic…) so the
// placeholder itself doesn't subtly bias users toward a single look.
// Gender-balanced to match the wizard's "female / male / nonbinary"
// toggle (we don't filter by gender — first names like Alex or Sasha
// work either way).

export const INFLUENCER_NAME_POOL: ReadonlyArray<string> = [
  // Western European
  "Camille",
  "Alex",
  "Mathilde",
  "Tom",
  "Sasha",
  "Margaux",
  "Théo",
  "Léa",
  // Latin / Romance
  "Sofia",
  "Diego",
  "Valentina",
  "Mateo",
  "Lucia",
  "Mateus",
  "Isabella",
  "Rafael",
  // Asian
  "Hana",
  "Kenji",
  "Mei",
  "Riku",
  "Yuna",
  "Jin",
  "Aiko",
  "Hiro",
  // African / Afro-diaspora
  "Amani",
  "Zuri",
  "Kwame",
  "Naya",
  "Imani",
  "Malik",
  "Aaliyah",
  "Tendai",
  // Middle-Eastern
  "Layla",
  "Omar",
  "Yasmin",
  "Karim",
  "Nour",
  "Adel",
  "Salma",
  "Rami",
  // Slavic / Nordic
  "Eva",
  "Nikolai",
  "Mila",
  "Lukas",
  "Saga",
  "Mikkel",
  "Anya",
  "Erik",
  // Mononym / playful
  "Aria",
  "Nova",
];

/**
 * Pick one name at random. Stable inside one component render — we don't
 * want the placeholder to jitter on every keystroke — but rerolls each
 * time the user lands fresh on the wizard.
 */
export function pickRandomInfluencerName(): string {
  return INFLUENCER_NAME_POOL[
    Math.floor(Math.random() * INFLUENCER_NAME_POOL.length)
  ];
}
