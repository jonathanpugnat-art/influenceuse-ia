import type { Platform } from "@/generated/prisma/client";

export interface CuratedItem {
  externalId: string;
  platform: Platform;
  /** Localized titles. We pick by ctx.locale at fetch time. */
  title: { fr: string; en: string };
  description: { fr: string; en: string };
  hashtags: string[];
  soundName?: string;
  growthScore: number;
  nicheTags: string[];
  /**
   * Hero image for the card. We use Unsplash photos that visually represent
   * the format (mirror selfie, gym mirror, café terrace…). High quality, free
   * to use, stable URLs.
   * Add `?auto=format&fit=crop&w=800&q=80` so we get a fixed-size optimized
   * preview from Unsplash's CDN.
   */
  thumbnailUrl: string;
  /** Optional 2nd thumbnail shown on hover for visual variety. */
  thumbnailUrlAlt?: string;
  /**
   * Hashtag we open on the platform when the user clicks "See on TikTok/IG".
   * Always points at the explore/tag page (never disappears, always live
   * trending content) — NOT a specific post URL that could 404 next month.
   */
  primaryHashtag: string;
}

/**
 * Build the public explore-page URL for a given hashtag on TikTok or Instagram.
 * Both URLs are stable and always show the freshest top videos — perfect for
 * a "see real trending content" CTA.
 */
export function explorePageUrl(platform: Platform, hashtag: string): string {
  const tag = hashtag.replace(/^#/, "").toLowerCase();
  if (platform === "TIKTOK") return `https://www.tiktok.com/tag/${tag}`;
  if (platform === "INSTAGRAM") return `https://www.instagram.com/explore/tags/${tag}/`;
  return `https://www.google.com/search?q=%23${tag}`;
}

const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

export const CURATED_TRENDS: CuratedItem[] = [
  // ── FASHION (4) ──────────────────────────────────────────────────
  {
    externalId: "curated-outfit-flip-3looks",
    platform: "INSTAGRAM",
    title: {
      fr: "Outfit flip — 3 tenues sur le même son",
      en: "Outfit flip — 3 looks, one beat",
    },
    description: {
      fr: "Reel 15s avec 3 changements de tenue rapides, transition saut-coupure synchronisée sur le drop du son.",
      en: "15s reel with 3 fast outfit swaps, jump-cut transition synced to the beat drop.",
    },
    hashtags: ["outfit", "ootd", "transition", "fashionreel", "stylereel"],
    growthScore: 82,
    nicheTags: ["FASHION", "LIFESTYLE"],
    thumbnailUrl: UNSPLASH("1490481651871-ab68de25d43d"),
    thumbnailUrlAlt: UNSPLASH("1483985988355-763728e1935b"),
    primaryHashtag: "outfit",
  },
  {
    externalId: "curated-mirror-selfie-fit",
    platform: "INSTAGRAM",
    title: {
      fr: "Mirror selfie #ootd — édition golden hour",
      en: "Mirror selfie #ootd — golden hour edition",
    },
    description: {
      fr: "Photo carrée verticale dans un miroir plein-pied, lumière dorée 18h, tenue mise en avant, plante ou meuble en arrière-plan.",
      en: "Vertical mirror selfie at golden hour (~6pm), full outfit framed, plant or furniture in background for warmth.",
    },
    hashtags: ["mirrorselfie", "ootd", "goldenhour", "fashionista"],
    growthScore: 71,
    nicheTags: ["FASHION", "LIFESTYLE"],
    thumbnailUrl: UNSPLASH("1469334031218-e382a71b716b"),
    thumbnailUrlAlt: UNSPLASH("1515886657613-9f3515b0c78f"),
    primaryHashtag: "ootd",
  },
  {
    externalId: "curated-haul-fashion-unbox",
    platform: "TIKTOK",
    title: {
      fr: "Haul mode — déballage 5 pièces sur le canapé",
      en: "Fashion haul — 5-piece unboxing on the couch",
    },
    description: {
      fr: "Vidéo 30s POV : déballage rapide, essai face caméra, mention du prix et du store. Style 'amie qui te montre ses achats'.",
      en: "30s POV: quick unbox, try-on facing the camera, price + store callout. Casual 'friend showing her haul' tone.",
    },
    hashtags: ["haul", "fashionhaul", "unboxing", "tryon"],
    growthScore: 76,
    nicheTags: ["FASHION"],
    thumbnailUrl: UNSPLASH("1483985988355-763728e1935b"),
    thumbnailUrlAlt: UNSPLASH("1485518882345-15568b007407"),
    primaryHashtag: "fashionhaul",
  },
  {
    externalId: "curated-streetstyle-pov",
    platform: "TIKTOK",
    title: {
      fr: "Street style POV — marche traversière",
      en: "Street style POV — crossing walk",
    },
    description: {
      fr: "Plan large à hauteur de poitrine pendant qu'elle traverse la rue, sneakers en gros plan en fin, son trending.",
      en: "Wide chest-high shot while she crosses the street, sneaker close-up at the end, trending sound.",
    },
    hashtags: ["streetstyle", "outfit", "fashion", "ootd"],
    soundName: "Trending TikTok beat — fashion edit",
    growthScore: 68,
    nicheTags: ["FASHION", "LIFESTYLE"],
    thumbnailUrl: UNSPLASH("1485462537746-965f33f7f6a7"),
    thumbnailUrlAlt: UNSPLASH("1542838132-92c53300491e"),
    primaryHashtag: "streetstyle",
  },

  // ── FITNESS (3) ──────────────────────────────────────────────────
  {
    externalId: "curated-grwm-running",
    platform: "TIKTOK",
    title: {
      fr: "GRWM running — édition matinale 6h",
      en: "GRWM running — 6am morning edition",
    },
    description: {
      fr: "Vlog 20s 'prépare-toi avec moi' avant un run, plan large + plans serrés tenue + sneakers + bouteille d'eau.",
      en: "20s 'get ready with me' vlog before a run, wide shot + close-ups of outfit + sneakers + water bottle.",
    },
    hashtags: ["grwm", "running", "morningroutine", "fitnessgirl"],
    growthScore: 79,
    nicheTags: ["FITNESS", "LIFESTYLE"],
    thumbnailUrl: UNSPLASH("1571019613454-1cb2f99b2d8b"),
    thumbnailUrlAlt: UNSPLASH("1538805060514-97d9cc17730c"),
    primaryHashtag: "grwm",
  },
  {
    externalId: "curated-gym-day-vlog",
    platform: "INSTAGRAM",
    title: {
      fr: "Gym day vlog — circuit jambes en 4 plans",
      en: "Gym day vlog — leg day in 4 cuts",
    },
    description: {
      fr: "Carrousel ou reel 30s : entrée gym, 1er exo (squat), 2e exo (leg press), shake post-séance. Tenue assortie obligatoire.",
      en: "Carousel or 30s reel: gym entry, 1st exercise (squat), 2nd (leg press), post-workout shake. Matching set required.",
    },
    hashtags: ["gymday", "legday", "fitnessmotivation", "gymgirl"],
    growthScore: 74,
    nicheTags: ["FITNESS"],
    thumbnailUrl: UNSPLASH("1534438327276-14e5300c3a48"),
    thumbnailUrlAlt: UNSPLASH("1574680096145-d05b474e2155"),
    primaryHashtag: "gymgirl",
  },
  {
    externalId: "curated-progress-comparison",
    platform: "INSTAGRAM",
    title: {
      fr: "Avant / après 3 mois — angle latéral",
      en: "3-month progress — side profile",
    },
    description: {
      fr: "Photo split 50/50 avant/après, même éclairage et même tenue claire pour montrer la différence sans tricher.",
      en: "Split 50/50 before/after photo, same lighting and same light-colored outfit so the diff is honest.",
    },
    hashtags: ["transformation", "fitnessjourney", "progress", "gymgirl"],
    growthScore: 65,
    nicheTags: ["FITNESS"],
    thumbnailUrl: UNSPLASH("1518611012118-696072aa579a"),
    thumbnailUrlAlt: UNSPLASH("1540575467063-178a50c2df87"),
    primaryHashtag: "transformation",
  },

  // ── LIFESTYLE (3) ────────────────────────────────────────────────
  {
    externalId: "curated-pov-cafe-paris",
    platform: "TIKTOK",
    title: {
      fr: "POV : ton café du matin en terrasse",
      en: "POV: morning café on a sunny terrace",
    },
    description: {
      fr: "Carrousel cosy : café, journal, lumière dorée, plan large sur la rue. Légende 'slow morning'.",
      en: "Cozy carousel: coffee, paper, golden hour light, wide shot of the street. Caption 'slow morning'.",
    },
    hashtags: ["pov", "morning", "cafe", "slowliving"],
    growthScore: 61,
    nicheTags: ["LIFESTYLE", "FOOD"],
    thumbnailUrl: UNSPLASH("1495474472287-4d71bcdd2085"),
    thumbnailUrlAlt: UNSPLASH("1509042239860-f550ce710b93"),
    primaryHashtag: "slowliving",
  },
  {
    externalId: "curated-day-in-life",
    platform: "TIKTOK",
    title: {
      fr: "Day in my life — 5 plans sur 1 son",
      en: "Day in my life — 5 cuts on one beat",
    },
    description: {
      fr: "Lever, café, balade, déjeuner, golden hour. Chaque plan ≈ 3s, transitions sur le rythme. Plan d'ouverture proche caméra.",
      en: "Wake-up, coffee, walk, lunch, golden hour. ~3s per cut, transitions on beat. Opening shot close to camera.",
    },
    hashtags: ["dayinmylife", "vlog", "aesthetic", "dailylife"],
    growthScore: 77,
    nicheTags: ["LIFESTYLE"],
    thumbnailUrl: UNSPLASH("1506748686214-e9df14d4d9d0"),
    thumbnailUrlAlt: UNSPLASH("1499744937866-d7e566a20a61"),
    primaryHashtag: "dayinmylife",
  },
  {
    externalId: "curated-aesthetic-room-tour",
    platform: "INSTAGRAM",
    title: {
      fr: "Room tour aesthetic — coin lecture / bureau",
      en: "Aesthetic room tour — reading nook / desk",
    },
    description: {
      fr: "Reel 25s qui glisse de la fenêtre au bureau au coin lecture, lumière naturelle, plantes, déco minimal beige/sauge.",
      en: "25s reel gliding from window to desk to reading nook, natural light, plants, minimal beige/sage decor.",
    },
    hashtags: ["roomtour", "aesthetic", "bedroom", "cozyhome"],
    growthScore: 58,
    nicheTags: ["LIFESTYLE"],
    thumbnailUrl: UNSPLASH("1505691938895-1758d7feb511"),
    thumbnailUrlAlt: UNSPLASH("1522708323590-d24dbb6b0267"),
    primaryHashtag: "roomtour",
  },

  // ── TRAVEL (3) ───────────────────────────────────────────────────
  {
    externalId: "curated-travel-pov-airport",
    platform: "TIKTOK",
    title: {
      fr: "POV : aéroport sunrise — départ vacances",
      en: "POV: sunrise airport — vacation start",
    },
    description: {
      fr: "Plans : passport stamp, café terminal, fenêtre avion, descente d'avion sur destination. Son chillout.",
      en: "Cuts: passport stamp, terminal coffee, airplane window, stepping off the plane at destination. Chill sound.",
    },
    hashtags: ["travel", "airport", "vacation", "wanderlust"],
    growthScore: 73,
    nicheTags: ["TRAVEL", "LIFESTYLE"],
    thumbnailUrl: UNSPLASH("1436491865332-7a61a109cc05"),
    thumbnailUrlAlt: UNSPLASH("1542296332-2e4473faf563"),
    primaryHashtag: "travel",
  },
  {
    externalId: "curated-hotel-room-tour",
    platform: "INSTAGRAM",
    title: {
      fr: "Hotel room reveal — first opening",
      en: "Hotel room reveal — first opening",
    },
    description: {
      fr: "Carrousel : ouverture porte (plan large), vue depuis la fenêtre, salle de bain, lit déjà fait. Ambiance 'wow'.",
      en: "Carousel: door opens (wide shot), view from the window, bathroom, made bed. 'Wow' vibe.",
    },
    hashtags: ["hotelroom", "travel", "hoteltour", "vacation"],
    growthScore: 64,
    nicheTags: ["TRAVEL"],
    thumbnailUrl: UNSPLASH("1566073771259-6a8506099945"),
    thumbnailUrlAlt: UNSPLASH("1578683010236-d716f9a3f461"),
    primaryHashtag: "hotelroom",
  },
  {
    externalId: "curated-restaurant-aesthetic",
    platform: "INSTAGRAM",
    title: {
      fr: "Resto aesthetic — table dressée + plat signature",
      en: "Aesthetic restaurant — table setup + signature dish",
    },
    description: {
      fr: "Carrousel : extérieur, table en hauteur, gros plan plat, verre de vin. Gold light, marbre, peu d'agitation autour.",
      en: "Carousel: exterior, overhead table shot, dish close-up, wine glass. Warm light, marble, calm crowd.",
    },
    hashtags: ["restaurant", "foodie", "aesthetic", "dinner"],
    growthScore: 60,
    nicheTags: ["FOOD", "TRAVEL", "LIFESTYLE"],
    thumbnailUrl: UNSPLASH("1517248135467-4c7edcad34c4"),
    thumbnailUrlAlt: UNSPLASH("1414235077428-338989a2e8c0"),
    primaryHashtag: "foodie",
  },

  // ── FOOD (2) ─────────────────────────────────────────────────────
  {
    externalId: "curated-recipe-pov",
    platform: "TIKTOK",
    title: {
      fr: "Recette POV — bowl protéiné en 4 plans",
      en: "POV recipe — protein bowl in 4 cuts",
    },
    description: {
      fr: "Plans serrés mains qui coupent, qui versent, qui mélangent, plan final en plongée du bowl complet. Voix off ASMR.",
      en: "Tight hands cutting, pouring, mixing, final overhead bowl shot. ASMR voiceover.",
    },
    hashtags: ["recipe", "foodtok", "healthyfood", "proteinbowl"],
    growthScore: 70,
    nicheTags: ["FOOD", "FITNESS"],
    thumbnailUrl: UNSPLASH("1546069901-ba9599a7e63c"),
    thumbnailUrlAlt: UNSPLASH("1490645935967-10de6ba17061"),
    primaryHashtag: "foodtok",
  },
  {
    externalId: "curated-coffee-routine",
    platform: "INSTAGRAM",
    title: {
      fr: "Coffee routine matinale — espresso fait maison",
      en: "Morning coffee routine — home espresso",
    },
    description: {
      fr: "Reel 20s : grains, mouture, extraction, lait monté, latte art. Ambiance kitchen aesthetic, lumière fenêtre.",
      en: "20s reel: beans, grind, pull, steamed milk, latte art. Kitchen-aesthetic vibe, window light.",
    },
    hashtags: ["coffee", "espresso", "morningroutine", "barista"],
    growthScore: 56,
    nicheTags: ["FOOD", "LIFESTYLE"],
    thumbnailUrl: UNSPLASH("1495474472287-4d71bcdd2085"),
    thumbnailUrlAlt: UNSPLASH("1509042239860-f550ce710b93"),
    primaryHashtag: "coffee",
  },

  // ── TECH (1) ─────────────────────────────────────────────────────
  {
    externalId: "curated-desk-setup",
    platform: "INSTAGRAM",
    title: {
      fr: "Desk setup productivity — tour bureau 2026",
      en: "Productivity desk setup — 2026 tour",
    },
    description: {
      fr: "Carrousel : vue d'ensemble, gros plan clavier/souris, écran allumé sur projet, café. Wood + black + LED warm.",
      en: "Carousel: overall view, keyboard/mouse close-up, monitor with project, coffee. Wood + black + warm LED.",
    },
    hashtags: ["desksetup", "productivity", "workspace", "tech"],
    growthScore: 53,
    nicheTags: ["TECH", "LIFESTYLE"],
    thumbnailUrl: UNSPLASH("1593642632823-8f785ba67e45"),
    thumbnailUrlAlt: UNSPLASH("1496181133206-80ce9b88a853"),
    primaryHashtag: "desksetup",
  },

  // ── GAMING (1) ───────────────────────────────────────────────────
  {
    externalId: "curated-gaming-setup-reveal",
    platform: "TIKTOK",
    title: {
      fr: "Setup gaming reveal — RGB on/off",
      en: "Gaming setup reveal — RGB on/off",
    },
    description: {
      fr: "Plan fixe sur le setup, transition lumières éteintes → RGB allumé. 8s, son punchy synchronisé sur l'allumage.",
      en: "Fixed shot on the setup, transition lights off → RGB on. 8s, punchy sound synced to the switch.",
    },
    hashtags: ["gamingsetup", "rgb", "gamerlife", "tech"],
    growthScore: 67,
    nicheTags: ["GAMING", "TECH"],
    thumbnailUrl: UNSPLASH("1542751371-adc38448a05e"),
    thumbnailUrlAlt: UNSPLASH("1511512578047-dfb367046420"),
    primaryHashtag: "gamingsetup",
  },

  // ── GENERAL (1) — works for everyone ─────────────────────────────
  {
    externalId: "curated-mirror-self-portrait",
    platform: "INSTAGRAM",
    title: {
      fr: "Self portrait éditorial — fond uni",
      en: "Editorial self-portrait — solid backdrop",
    },
    description: {
      fr: "Photo verticale plan poitrine, fond uni (mur beige/sauge), regard légèrement décalé, lumière fenêtre douce.",
      en: "Vertical chest-up portrait, solid backdrop (beige/sage wall), slightly off-camera gaze, soft window light.",
    },
    hashtags: ["portrait", "editorial", "aesthetic", "selfportrait"],
    growthScore: 50,
    nicheTags: ["GENERAL", "FASHION"],
    thumbnailUrl: UNSPLASH("1531746020798-e6953c6e8e04"),
    thumbnailUrlAlt: UNSPLASH("1494790108377-be9c29b29330"),
    primaryHashtag: "portrait",
  },
];
