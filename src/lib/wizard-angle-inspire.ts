/**
 * Combinatorial universe generator — each click produces a different phrase
 * so creators don't all land on the same 3 chip suggestions.
 */

export const WIZARD_ANGLE_NICHES = [
  "FASHION",
  "FITNESS",
  "TRAVEL",
  "GAMING",
  "FOOD",
  "LIFESTYLE",
  "TECH",
  "ADULT",
] as const;

export type WizardAngleNiche = (typeof WIZARD_ANGLE_NICHES)[number];

type Locale = "fr" | "en";

type AngleParts = {
  places: string[];
  vibes: string[];
  hooks: string[];
};

const PARTS: Record<WizardAngleNiche, Record<Locale, AngleParts>> = {
  FASHION: {
    fr: {
      places: ["Paris", "Lyon", "Bordeaux", "Nice", "Bruxelles", "Genève"],
      vibes: [
        "chic accessible",
        "street soft",
        "luxe discret",
        "vintage moderne",
        "minimal propre",
      ],
      hooks: [
        "looks du quotidien",
        "tenues café terrasse",
        "capsule garde-robe",
        "détails bijoux",
      ],
    },
    en: {
      places: ["Paris", "Milan", "Lisbon", "Berlin", "NYC", "London"],
      vibes: [
        "accessible chic",
        "soft street",
        "quiet luxury",
        "modern vintage",
        "clean minimal",
      ],
      hooks: [
        "everyday outfits",
        "café terrace looks",
        "capsule wardrobe",
        "jewelry details",
      ],
    },
  },
  FITNESS: {
    fr: {
      places: ["Paris", "Lille", "Marseille", "Annecy", "Nantes"],
      vibes: [
        "énergie douce",
        "discipline soft",
        "motivation chaleureuse",
        "esthétique sportive",
      ],
      hooks: [
        "running matin",
        "yoga appartement",
        "salle & lifestyle",
        "récupération active",
      ],
    },
    en: {
      places: ["Paris", "LA", "Barcelona", "Amsterdam", "Montreal"],
      vibes: [
        "soft energy",
        "warm discipline",
        "friendly motivation",
        "athletic aesthetic",
      ],
      hooks: [
        "morning runs",
        "apartment yoga",
        "gym & lifestyle",
        "active recovery",
      ],
    },
  },
  TRAVEL: {
    fr: {
      places: ["Lisbonne", "Rome", "Tokyo", "Marrakech", "Séville", "Prague"],
      vibes: [
        "solo soft",
        "city break esthétique",
        "aventure douce",
        "week-end lent",
      ],
      hooks: [
        "cafés locaux",
        "rues dorées",
        "hôtels design",
        "vues rooftop",
      ],
    },
    en: {
      places: ["Lisbon", "Rome", "Tokyo", "Marrakech", "Seville", "Prague"],
      vibes: [
        "soft solo travel",
        "aesthetic city break",
        "gentle adventure",
        "slow weekend",
      ],
      hooks: [
        "local cafés",
        "golden streets",
        "design hotels",
        "rooftop views",
      ],
    },
  },
  GAMING: {
    fr: {
      places: ["setup chambre", "coin bureau", "loft gaming", "studio RGB soft"],
      vibes: ["cozy", "casual", "compétitive soft", "lifestyle geek"],
      hooks: [
        "soirées stream",
        "setup esthétique",
        "jeux & pauses café",
        "collabs community",
      ],
    },
    en: {
      places: ["bedroom setup", "desk corner", "gaming loft", "soft RGB studio"],
      vibes: ["cozy", "casual", "soft competitive", "geek lifestyle"],
      hooks: [
        "stream nights",
        "aesthetic setup",
        "games & coffee breaks",
        "community collabs",
      ],
    },
  },
  FOOD: {
    fr: {
      places: ["Paris", "Lyon", "Bruxelles", "Bordeaux", "Montréal"],
      vibes: ["foodie soft", "brunch aesthetic", "cuisine simple", "café culture"],
      hooks: [
        "recettes 20 min",
        "tables ensoleillées",
        "pâtisseries du dimanche",
        "marchés locaux",
      ],
    },
    en: {
      places: ["Paris", "Lyon", "Brussels", "Bordeaux", "Montreal"],
      vibes: ["soft foodie", "brunch aesthetic", "simple cooking", "café culture"],
      hooks: [
        "20-min recipes",
        "sunny tables",
        "Sunday pastries",
        "local markets",
      ],
    },
  },
  LIFESTYLE: {
    fr: {
      places: ["appartement Paris", "studio lumineux", "maison de ville", "loft calme"],
      vibes: ["slow living", "soft morning", "cosy premium", "esthétique calme"],
      hooks: [
        "routines matin",
        "dimanches lents",
        "coin lecture",
        "soirées maison",
      ],
    },
    en: {
      places: [
        "Paris apartment",
        "bright studio",
        "townhouse",
        "quiet loft",
      ],
      vibes: ["slow living", "soft morning", "cozy premium", "calm aesthetic"],
      hooks: [
        "morning routines",
        "slow Sundays",
        "reading corner",
        "home evenings",
      ],
    },
  },
  TECH: {
    fr: {
      places: ["bureau maison", "café wifi", "cowork soft", "setup nomade"],
      vibes: ["accessible", "productivité douce", "curious mind", "digital clean"],
      hooks: [
        "gadgets utiles",
        "apps du quotidien",
        "focus deep work",
        "setup minimal",
      ],
    },
    en: {
      places: ["home office", "wifi café", "soft cowork", "nomad setup"],
      vibes: ["accessible", "gentle productivity", "curious mind", "clean digital"],
      hooks: [
        "useful gadgets",
        "everyday apps",
        "deep-work focus",
        "minimal setup",
      ],
    },
  },
  ADULT: {
    fr: {
      places: ["boudoir soft", "suite hôtel", "appartement soir", "lumière dorée"],
      vibes: ["sensualité chic", "mystère premium", "glam discret", "confiance soft"],
      hooks: [
        "poses naturelles",
        "lingerie esthétique",
        "ambiance feutrée",
        "regard intense",
      ],
    },
    en: {
      places: ["soft boudoir", "hotel suite", "evening apartment", "golden light"],
      vibes: [
        "chic sensuality",
        "premium mystery",
        "discreet glam",
        "soft confidence",
      ],
      hooks: [
        "natural poses",
        "aesthetic lingerie",
        "hushed mood",
        "intense gaze",
      ],
    },
  },
};

const FALLBACK: Record<Locale, AngleParts> = {
  fr: {
    places: ["Paris", "Lyon", "Bruxelles"],
    vibes: ["authentique", "esthétique soft", "proche communauté"],
    hooks: ["contenu du quotidien", "stories naturelles", "énergie réelle"],
  },
  en: {
    places: ["Paris", "Lisbon", "Berlin"],
    vibes: ["authentic", "soft aesthetic", "community-first"],
    hooks: ["everyday content", "natural stories", "real energy"],
  },
};

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function isWizardAngleNiche(niche: string): niche is WizardAngleNiche {
  return (WIZARD_ANGLE_NICHES as readonly string[]).includes(niche);
}

/** Build a unique freeform universe line for the identity step. */
export function inspireWizardAngle(
  niche: string | undefined,
  locale: Locale = "fr",
  avoid?: string
): string {
  const parts =
    niche && isWizardAngleNiche(niche)
      ? PARTS[niche][locale]
      : FALLBACK[locale];

  let candidate = "";
  for (let i = 0; i < 8; i++) {
    candidate = `${pick(parts.places)}, ${pick(parts.vibes)}, ${pick(parts.hooks)}`;
    if (candidate !== avoid) break;
  }
  return candidate.slice(0, 120);
}
