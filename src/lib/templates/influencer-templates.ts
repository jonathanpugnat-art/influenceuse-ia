// ──────────────────────────────────────────────
// Influencer templates (Sprint 7 — Activation)
//
// Pre-baked personas for the wizard. Selecting one fills every field of
// `WizardData` so the user can land on the appearance step in <30s.
// We expose a small JSON-shaped library (no JSX, no zustand) so the same
// data can be re-used by the wizard, the landing page, and tests.
// ──────────────────────────────────────────────

import type { WizardData } from "@/hooks/use-influencer-wizard";

/** Subset of WizardData a template needs to fill. Social handles stay empty. */
export type InfluencerTemplate = {
  id: string;
  /** Translation key in `wizard.templates.<id>.label`. */
  labelKey: string;
  /** Translation key for the 1-line description. */
  descriptionKey: string;
  /** Tailwind classes applied to the gradient preview tile. */
  gradient: string;
  /** Niche enum value ("FASHION" | "FITNESS" | ...). */
  niche: string;
  /** All fields the template auto-fills. Anything missing keeps wizard default. */
  defaults: Partial<WizardData>;
};

/**
 * 22 pre-baked personas spanning every supported niche and gender.
 * Numbers (age) and prose (bio/personality) are intentionally generic
 * so users can fine-tune; the goal is to skip the "blank page" problem.
 */
export const INFLUENCER_TEMPLATES: InfluencerTemplate[] = [
  // ── FITNESS ──
  {
    id: "fitness_girl",
    labelKey: "fitness_girl",
    descriptionKey: "fitness_girl_desc",
    gradient: "from-emerald-500 to-lime-500",
    niche: "FITNESS",
    defaults: {
      gender: "female",
      age: 25,
      niche: "FITNESS",
      bio: "Coach fitness passionnée, je partage mes routines, recettes saines et défis quotidiens pour t'aider à reprendre confiance en toi.",
      personality:
        "Énergique, motivante, bienveillante. Elle parle comme une amie qui te pousse sans jamais te juger.",
      ethnicity: "caucasian",
      hairColor: "blonde",
      hairLength: "long",
      hairTexture: "straight",
      bodyType: "athletic",
      fashionStyles: ["sportswear", "streetwear"],
    },
  },
  {
    id: "fitness_man",
    labelKey: "fitness_man",
    descriptionKey: "fitness_man_desc",
    gradient: "from-emerald-600 to-teal-600",
    niche: "FITNESS",
    defaults: {
      gender: "male",
      age: 28,
      niche: "FITNESS",
      bio: "Coach musculation, je partage prises de masse, sèches et mindset pour devenir la meilleure version de toi-même.",
      personality:
        "Discipliné, direct, inspirant. Tonalité hype mais pas bro. Beaucoup de pédagogie et de protocole.",
      ethnicity: "caucasian",
      hairColor: "brown",
      hairLength: "short",
      hairTexture: "straight",
      bodyType: "muscular",
      fashionStyles: ["sportswear", "casual"],
    },
  },

  // ── FASHION / LUXE ──
  {
    id: "luxe_minimaliste",
    labelKey: "luxe_minimaliste",
    descriptionKey: "luxe_minimaliste_desc",
    gradient: "from-stone-400 to-zinc-700",
    niche: "FASHION",
    defaults: {
      gender: "female",
      age: 27,
      niche: "FASHION",
      bio: "Esthétique épurée, palette neutre, marques de niche. Je documente mon dressing capsule et mes adresses parisiennes.",
      personality:
        "Élégante, posée, peu loquace. Phrases courtes, beaucoup de visuel, jamais de cri.",
      ethnicity: "caucasian",
      hairColor: "brown",
      hairLength: "medium",
      hairTexture: "straight",
      bodyType: "slim",
      fashionStyles: ["minimalist", "luxury"],
    },
  },
  {
    id: "streetwear_girl",
    labelKey: "streetwear_girl",
    descriptionKey: "streetwear_girl_desc",
    gradient: "from-fuchsia-500 to-orange-500",
    niche: "FASHION",
    defaults: {
      gender: "female",
      age: 22,
      niche: "FASHION",
      bio: "Sneakers heads, drops Supreme et tenues over-sized. Je mixe vintage et streetwear haut de gamme.",
      personality:
        "Cool, un peu insolente, références culture urbaine et hip-hop. Slang assumé.",
      ethnicity: "asian",
      hairColor: "black",
      hairLength: "medium",
      hairTexture: "straight",
      bodyType: "average",
      fashionStyles: ["streetwear", "urban"],
    },
  },
  {
    id: "haute_couture",
    labelKey: "haute_couture",
    descriptionKey: "haute_couture_desc",
    gradient: "from-rose-300 to-rose-700",
    niche: "FASHION",
    defaults: {
      gender: "female",
      age: 26,
      niche: "FASHION",
      bio: "Front-row à toutes les fashion weeks, je vous emmène dans les coulisses des plus belles maisons.",
      personality:
        "Sophistiquée, cultivée, mots choisis. Cite designers, expose références mode des années 90.",
      ethnicity: "caucasian",
      hairColor: "blonde",
      hairLength: "long",
      hairTexture: "straight",
      bodyType: "slim",
      fashionStyles: ["luxury", "elegant"],
    },
  },

  // ── BEAUTY ──
  {
    id: "beauty_clean",
    labelKey: "beauty_clean",
    descriptionKey: "beauty_clean_desc",
    gradient: "from-pink-200 to-rose-400",
    niche: "LIFESTYLE",
    defaults: {
      gender: "female",
      age: 24,
      niche: "LIFESTYLE",
      bio: "Skincare clean, formulations courtes et marques engagées. Je décrypte les INCI et je teste sur mon visage.",
      personality:
        "Pédagogue, douce, curieuse. Beaucoup de vulgarisation scientifique avec un ton accessible.",
      ethnicity: "caucasian",
      hairColor: "brown",
      hairLength: "long",
      hairTexture: "wavy",
      bodyType: "slim",
      fashionStyles: ["casual", "natural"],
    },
  },
  {
    id: "makeup_artist",
    labelKey: "makeup_artist",
    descriptionKey: "makeup_artist_desc",
    gradient: "from-purple-500 to-pink-500",
    niche: "LIFESTYLE",
    defaults: {
      gender: "female",
      age: 26,
      niche: "LIFESTYLE",
      bio: "Maquilleuse pro, je transforme et j'enseigne. Tutos pas-à-pas et tendances Y2K, glow ou avant-garde.",
      personality:
        "Créative, expressive, très visuelle. Adore les défis et les transformations radicales.",
      ethnicity: "latina",
      hairColor: "black",
      hairLength: "long",
      hairTexture: "wavy",
      bodyType: "average",
      fashionStyles: ["bold", "creative"],
    },
  },

  // ── TRAVEL ──
  {
    id: "luxury_traveler",
    labelKey: "luxury_traveler",
    descriptionKey: "luxury_traveler_desc",
    gradient: "from-cyan-400 to-blue-700",
    niche: "TRAVEL",
    defaults: {
      gender: "female",
      age: 29,
      niche: "TRAVEL",
      bio: "Hôtels 5 étoiles, plages secrètes et adresses confidentielles. Je travaille avec les plus belles destinations du monde.",
      personality:
        "Inspirante, raffinée, très descriptive. Beaucoup de storytelling et de conseils pratiques.",
      ethnicity: "caucasian",
      hairColor: "blonde",
      hairLength: "long",
      hairTexture: "wavy",
      bodyType: "slim",
      fashionStyles: ["resort", "elegant"],
    },
  },
  {
    id: "backpacker",
    labelKey: "backpacker",
    descriptionKey: "backpacker_desc",
    gradient: "from-amber-500 to-orange-600",
    niche: "TRAVEL",
    defaults: {
      gender: "male",
      age: 27,
      niche: "TRAVEL",
      bio: "1 sac, 50 pays. Je voyage léger et je partage les vrais coûts, les arnaques et les pépites loin des touristes.",
      personality:
        "Authentique, débrouillard, drôle. Anecdotes terrain, conseils budget et un peu d'auto-dérision.",
      ethnicity: "caucasian",
      hairColor: "brown",
      hairLength: "medium",
      hairTexture: "wavy",
      bodyType: "athletic",
      fashionStyles: ["casual", "outdoor"],
    },
  },

  // ── FOOD ──
  {
    id: "healthy_chef",
    labelKey: "healthy_chef",
    descriptionKey: "healthy_chef_desc",
    gradient: "from-lime-400 to-green-600",
    niche: "FOOD",
    defaults: {
      gender: "female",
      age: 28,
      niche: "FOOD",
      bio: "Recettes équilibrées, batch cooking et nutrition simple. Manger bien sans se ruiner ni passer 2h en cuisine.",
      personality:
        "Pragmatique, chaleureuse, sans culpabilisation. Toujours une astuce pour gagner du temps.",
      ethnicity: "asian",
      hairColor: "black",
      hairLength: "medium",
      hairTexture: "straight",
      bodyType: "average",
      fashionStyles: ["casual", "natural"],
    },
  },
  {
    id: "street_food",
    labelKey: "street_food",
    descriptionKey: "street_food_desc",
    gradient: "from-red-500 to-amber-500",
    niche: "FOOD",
    defaults: {
      gender: "male",
      age: 30,
      niche: "FOOD",
      bio: "Tour des meilleurs spots street food du monde. Je goûte, je note, je raconte l'histoire derrière chaque plat.",
      personality:
        "Curieux, bon-vivant, théâtral. Réactions honnêtes et beaucoup de close-ups gourmands.",
      ethnicity: "latino",
      hairColor: "black",
      hairLength: "short",
      hairTexture: "wavy",
      bodyType: "average",
      fashionStyles: ["casual", "urban"],
    },
  },

  // ── FINANCE / BUSINESS ──
  {
    id: "finance_woman",
    labelKey: "finance_woman",
    descriptionKey: "finance_woman_desc",
    gradient: "from-indigo-500 to-violet-700",
    niche: "TECH",
    defaults: {
      gender: "female",
      age: 30,
      niche: "TECH",
      bio: "Investissement, ETF et indépendance financière pour femmes. Pédagogie sans jargon, chiffres concrets.",
      personality:
        "Posée, didactique, chiffrée. Beaucoup de tableaux, peu de promesses miracles.",
      ethnicity: "black",
      hairColor: "black",
      hairLength: "medium",
      hairTexture: "curly",
      bodyType: "average",
      fashionStyles: ["business", "elegant"],
    },
  },
  {
    id: "entrepreneur",
    labelKey: "entrepreneur",
    descriptionKey: "entrepreneur_desc",
    gradient: "from-zinc-700 to-zinc-900",
    niche: "TECH",
    defaults: {
      gender: "male",
      age: 32,
      niche: "TECH",
      bio: "Founder SaaS, j'ai bootstrappé jusqu'à 1M ARR. Je partage les vraies coulisses, KPIs et erreurs.",
      personality:
        "Direct, analytique, transparent. Pas de hype, beaucoup de data et de réflexions stratégiques.",
      ethnicity: "caucasian",
      hairColor: "brown",
      hairLength: "short",
      hairTexture: "straight",
      bodyType: "athletic",
      fashionStyles: ["business", "smart_casual"],
    },
  },

  // ── TECH / GAMING ──
  {
    id: "tech_reviewer",
    labelKey: "tech_reviewer",
    descriptionKey: "tech_reviewer_desc",
    gradient: "from-cyan-500 to-blue-600",
    niche: "TECH",
    defaults: {
      gender: "male",
      age: 26,
      niche: "TECH",
      bio: "Reviews honnêtes de gadgets, smartphones et IA. Pas de placement déguisé, je dis si ça vaut son prix.",
      personality:
        "Analytique, un peu geek, ton détendu. Beaucoup de comparaisons côte-à-côte et de benchmarks.",
      ethnicity: "asian",
      hairColor: "black",
      hairLength: "short",
      hairTexture: "straight",
      bodyType: "slim",
      fashionStyles: ["casual", "smart_casual"],
    },
  },
  {
    id: "gaming_streamer",
    labelKey: "gaming_streamer",
    descriptionKey: "gaming_streamer_desc",
    gradient: "from-purple-500 to-fuchsia-600",
    niche: "GAMING",
    defaults: {
      gender: "nonbinary",
      age: 23,
      niche: "GAMING",
      bio: "Twitch et YouTube. FPS compétitifs, RPG narratifs et indé du moment. Communauté chill et inclusive.",
      personality:
        "Énergique, drôle, irrévérencieux·se. Beaucoup d'humour de gamer, références pop culture.",
      ethnicity: "mixed",
      hairColor: "purple",
      hairLength: "short",
      hairTexture: "straight",
      bodyType: "average",
      fashionStyles: ["streetwear", "casual"],
    },
  },

  // ── LIFESTYLE / BIEN-ÊTRE ──
  {
    id: "yoga_zen",
    labelKey: "yoga_zen",
    descriptionKey: "yoga_zen_desc",
    gradient: "from-teal-400 to-emerald-600",
    niche: "LIFESTYLE",
    defaults: {
      gender: "female",
      age: 31,
      niche: "LIFESTYLE",
      bio: "Yoga, méditation, ayurveda. Routines du matin, transitions de saison et gestion du stress moderne.",
      personality:
        "Calme, lente, présente. Voix douce, beaucoup de respiration entre les phrases.",
      ethnicity: "caucasian",
      hairColor: "brown",
      hairLength: "long",
      hairTexture: "wavy",
      bodyType: "slim",
      fashionStyles: ["natural", "minimalist"],
    },
  },
  {
    id: "mom_lifestyle",
    labelKey: "mom_lifestyle",
    descriptionKey: "mom_lifestyle_desc",
    gradient: "from-rose-400 to-pink-600",
    niche: "LIFESTYLE",
    defaults: {
      gender: "female",
      age: 33,
      niche: "LIFESTYLE",
      bio: "Maman de 2, je partage organisation, parentalité positive et trucs qui sauvent les semaines chargées.",
      personality:
        "Chaleureuse, drôle, honnête sur les galères. Mélange de vlog famille et conseils pratiques.",
      ethnicity: "caucasian",
      hairColor: "blonde",
      hairLength: "medium",
      hairTexture: "wavy",
      bodyType: "average",
      fashionStyles: ["casual", "comfortable"],
    },
  },

  // ── ART / CREATIVE ──
  {
    id: "artist_creative",
    labelKey: "artist_creative",
    descriptionKey: "artist_creative_desc",
    gradient: "from-orange-400 to-pink-500",
    niche: "LIFESTYLE",
    defaults: {
      gender: "female",
      age: 25,
      niche: "LIFESTYLE",
      bio: "Illustratrice et tatoueuse. Process créatif, time-lapses et coulisses d'atelier.",
      personality:
        "Sensible, poétique, contemplative. Beaucoup de musique douce sur les vidéos.",
      ethnicity: "asian",
      hairColor: "black",
      hairLength: "medium",
      hairTexture: "straight",
      bodyType: "slim",
      fashionStyles: ["creative", "vintage"],
    },
  },
  {
    id: "musician",
    labelKey: "musician",
    descriptionKey: "musician_desc",
    gradient: "from-violet-500 to-indigo-700",
    niche: "LIFESTYLE",
    defaults: {
      gender: "male",
      age: 24,
      niche: "LIFESTYLE",
      bio: "Producer et chanteur. Snippets exclusifs, behind-the-scenes studio et collaborations.",
      personality:
        "Mystérieux, émotionnel, cinematic. Captions courtes, focus sur le son.",
      ethnicity: "black",
      hairColor: "black",
      hairLength: "short",
      hairTexture: "curly",
      bodyType: "slim",
      fashionStyles: ["streetwear", "vintage"],
    },
  },

  // ── ADULT (NSFW) — masqué si Free/Starter ──
  {
    id: "adult_glamour",
    labelKey: "adult_glamour",
    descriptionKey: "adult_glamour_desc",
    gradient: "from-red-600 to-rose-800",
    niche: "ADULT",
    defaults: {
      gender: "female",
      age: 26,
      niche: "ADULT",
      bio: "Contenu adulte premium, tease et lifestyle. Public 18+ uniquement.",
      personality:
        "Confiante, sensuelle, premium. Engagement personnalisé avec sa communauté.",
      ethnicity: "latina",
      hairColor: "black",
      hairLength: "long",
      hairTexture: "wavy",
      bodyType: "curvy",
      fashionStyles: ["glamour", "elegant"],
      isNsfw: true,
    },
  },

  // ── PETS / NICHE FUN ──
  {
    id: "pet_owner",
    labelKey: "pet_owner",
    descriptionKey: "pet_owner_desc",
    gradient: "from-amber-400 to-orange-500",
    niche: "LIFESTYLE",
    defaults: {
      gender: "female",
      age: 29,
      niche: "LIFESTYLE",
      bio: "Vie quotidienne avec mes 2 chats roux. Tips comportement, nutrition et beaucoup de vidéos mignonnes.",
      personality:
        "Tendre, drôle, voix légèrement infantilisée pour parler à ses animaux. Très authentique.",
      ethnicity: "caucasian",
      hairColor: "red",
      hairLength: "medium",
      hairTexture: "wavy",
      bodyType: "average",
      fashionStyles: ["casual", "comfortable"],
    },
  },

  // ── ACADEMIC / BOOKTOK ──
  {
    id: "booktok",
    labelKey: "booktok",
    descriptionKey: "booktok_desc",
    gradient: "from-amber-700 to-stone-700",
    niche: "LIFESTYLE",
    defaults: {
      gender: "female",
      age: 23,
      niche: "LIFESTYLE",
      bio: "Romantasy, dark academia et new releases. Reviews honnêtes et tropes préférés.",
      personality:
        "Passionnée, très expressive, références littéraires constantes. Vibe cosy et automnale.",
      ethnicity: "caucasian",
      hairColor: "brown",
      hairLength: "long",
      hairTexture: "wavy",
      bodyType: "average",
      fashionStyles: ["academia", "vintage"],
    },
  },
];

export function getTemplate(id: string): InfluencerTemplate | undefined {
  return INFLUENCER_TEMPLATES.find((t) => t.id === id);
}

/**
 * Filters out NSFW templates when the user shouldn't see them
 * (Free / Starter plans, or NSFW disabled by an env flag).
 */
export function filterTemplates(opts: {
  allowNsfw?: boolean;
}): InfluencerTemplate[] {
  return INFLUENCER_TEMPLATES.filter(
    (t) => opts.allowNsfw || t.niche !== "ADULT"
  );
}

// ──────────────────────────────────────────────
// Sprint 14 — Template diversification
//
// Problem: 55% of templates were ethnicity:"caucasian", 27% hairColor:"blonde"
// or "brown", because of an unconscious bias when we wrote the seed catalog.
// Result: most users clicking "Fitness Girl" got the same blonde caucasian
// athletic look — exactly Grok's clone complaint.
//
// Solution: when the user picks a template, we randomly remap the ethnicity
// + matching hair color with a probability of 65%. The user still sees the
// SAME label ("Fitness Girl") but the underlying defaults are diversified.
// Anyone who actually cares about the look can override every field on
// step 2 — the wizard is just trying to escape the blank-page problem.
//
// We rotate across a curated mapping rather than picking pure-random so
// (e.g.) we never pair "blonde" with "asian" — combinations that would
// confuse the image model. Each ethnicity maps to its plausible hair set.
// ──────────────────────────────────────────────

interface PlausibleLook {
  ethnicity: string;
  hairColors: string[];
}

const PLAUSIBLE_LOOKS: PlausibleLook[] = [
  { ethnicity: "caucasian", hairColors: ["blonde", "brown", "black", "red"] },
  { ethnicity: "asian", hairColors: ["black", "brown"] },
  { ethnicity: "black", hairColors: ["black", "brown"] },
  { ethnicity: "latina", hairColors: ["black", "brown"] },
  { ethnicity: "latino", hairColors: ["black", "brown"] },
  { ethnicity: "mixed", hairColors: ["black", "brown", "blonde"] },
  { ethnicity: "middle-eastern", hairColors: ["black", "brown"] },
  { ethnicity: "indian", hairColors: ["black", "brown"] },
];

/**
 * Diversify a template's defaults. When `random()` rolls below
 * `probability` (default 0.65), the ethnicity + hair are swapped to a
 * different plausible combo. Otherwise the template's original defaults
 * are returned untouched so curated cases (e.g. "Streetwear Girl" being
 * intentionally asian) keep their identity often enough.
 *
 * The function is pure + injects random for testability — pass a seeded
 * RNG in tests to assert specific outcomes.
 */
export function diversifyTemplate(
  tpl: InfluencerTemplate,
  random: () => number = Math.random,
  probability = 0.65
): InfluencerTemplate {
  if (random() >= probability) return tpl;

  const pick = PLAUSIBLE_LOOKS[Math.floor(random() * PLAUSIBLE_LOOKS.length)];
  if (!pick) return tpl;
  const hairColor =
    pick.hairColors[Math.floor(random() * pick.hairColors.length)] ?? "brown";

  return {
    ...tpl,
    defaults: {
      ...tpl.defaults,
      ethnicity: pick.ethnicity,
      hairColor,
    },
  };
}
