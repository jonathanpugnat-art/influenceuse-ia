/**
 * v0.12 — Trends provider abstraction.
 *
 * A `TrendsProvider` knows how to fetch *raw* trend signals from one or more
 * third parties (Apify actor scraping TikTok Discover, a Predis-style HTTP
 * API, etc.). The provider is intentionally dumb: it does not personalize
 * for an influencer, it does not call our LLM, it does not write to the DB.
 *
 * The `trends.service.ts` layer is responsible for normalization, dedup,
 * upsert, and LLM personalization.
 *
 * Selecting an implementation:
 *   - `TRENDS_PROVIDER=apify`   → ApifyProvider (requires `APIFY_TOKEN`)
 *   - `TRENDS_PROVIDER=http`    → GenericHttpProvider (requires `TRENDS_HTTP_URL`)
 *   - `TRENDS_PROVIDER=stub`    → DevStubProvider (dev only, returns demo data)
 *   - unset / unknown           → auto-resolve: real provider if env keys are
 *                                 present, else `stub` in dev, else `null`
 *                                 (graceful no-op in prod).
 *
 * In production with no keys configured, the cron handler logs a warning and
 * skips the run. The UI then renders an empty state with a "Trends not
 * configured" banner — we never crash a build/runtime over a missing key.
 */

import type { Platform } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────

/**
 * A raw trend signal as returned by a provider. All fields are best-effort —
 * a provider may only know the title and a hashtag and that's fine.
 */
export interface RawTrendItem {
  /** Identifier in the source system (URL, slug, hashtag id…). Used for dedup. */
  externalId: string;
  platform: Platform;
  title: string;
  description?: string;
  /** Hashtags WITHOUT the leading `#`. */
  hashtags: string[];
  /** Trending audio / song name if any. */
  soundName?: string;
  /** Generic "how hot is this" score, 0..100. */
  growthScore?: number;
  sourceUrl?: string;
  /**
   * Visual preview for the card. Curated trends ship Unsplash photos that
   * represent the format; Apify will populate this from the top engagement
   * post when it has one.
   */
  thumbnailUrl?: string;
  /** Optional second thumbnail for hover-swap on the card. */
  thumbnailUrlAlt?: string;
  /**
   * TikTok / Instagram canonical post URL the modal can embed in an iframe.
   * Optional — when missing, the card just links out to sourceUrl.
   */
  embedUrl?: string;
  /** "@username" attribution when the trend points at a specific creator. */
  authorHandle?: string;
  /** Loose niche tags ("FASHION", "FITNESS", "GENERAL", …). */
  nicheTags?: string[];
  isNsfw?: boolean;
  locale?: string;
  region?: string;
  /** Direct media URLs from scraped posts (for format analysis). */
  mediaUrls?: string[];
  /** image | video | carousel | hashtag_signal */
  mediaKind?: string;
}

export interface ProviderContext {
  /** Optional region filter (e.g. "FR", "US"). */
  region?: string;
  /** Optional locale filter (e.g. "fr", "en"). */
  locale?: string;
  /** Max items requested. Provider may return fewer. */
  limit?: number;
}

export interface TrendsProvider {
  /** Stable identifier saved alongside snapshots (provider lineage). */
  readonly id: string;
  /** Whether this provider is properly configured (env keys present). */
  isConfigured(): boolean;
  fetchRawTrends(ctx?: ProviderContext): Promise<RawTrendItem[]>;
}

// ──────────────────────────────────────────────
// Implementations
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Curated provider — evergreen seed dataset
// ──────────────────────────────────────────────
//
// CuratedTrendsProvider ships a hand-picked catalogue of ~18 evergreen
// short-form formats (GRWM, outfit flips, POV cafés, gym mirror selfies,
// travel POVs, etc.) localized FR/EN. Designed to make the Trends page
// useful out of the box BEFORE Apify is wired (Apify costs ~$50-150/mo and
// requires a real account).
//
// In production this provider is the safe default: it always returns
// something useful and never burns external quota. Once Apify is configured
// (TRENDS_PROVIDER=apify), it takes over and curated stays as fallback.

interface CuratedItem {
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
function explorePageUrl(platform: Platform, hashtag: string): string {
  const tag = hashtag.replace(/^#/, "").toLowerCase();
  if (platform === "TIKTOK") return `https://www.tiktok.com/tag/${tag}`;
  if (platform === "INSTAGRAM") return `https://www.instagram.com/explore/tags/${tag}/`;
  return `https://www.google.com/search?q=%23${tag}`;
}

const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

const CURATED_TRENDS: CuratedItem[] = [
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

/**
 * Curated provider — ships a static dataset of evergreen short-form formats.
 * Designed to make the Trends page useful out of the box BEFORE Apify is
 * configured (Apify needs a paid account). Always returns something, never
 * burns external quota.
 *
 * Selection priority in `resolveTrendsProvider()`:
 *   1. Explicit `TRENDS_PROVIDER=apify|http|curated|stub` env override
 *   2. Apify (if `APIFY_TOKEN` is set)
 *   3. Generic HTTP (if `TRENDS_HTTP_URL` is set)
 *   4. Curated (always available — last-resort but real-content fallback)
 *   5. DevStub (dev only)
 *   6. null
 */
export class CuratedTrendsProvider implements TrendsProvider {
  readonly id = "curated";

  isConfigured(): boolean {
    // Always available — the dataset is bundled with the source.
    return true;
  }

  async fetchRawTrends(ctx?: ProviderContext): Promise<RawTrendItem[]> {
    const locale: "fr" | "en" = ctx?.locale === "fr" ? "fr" : "en";
    const items: RawTrendItem[] = CURATED_TRENDS.map((c) => {
      // sourceUrl points at the LIVE hashtag explore page on the platform.
      // Clicking the card opens the real, ever-fresh top videos for that
      // hashtag — which is what the user actually wants ("real trending
      // videos from TikTok / Instagram"). We never hardcode individual
      // video URLs because they go private/deleted within weeks.
      const sourceUrl = explorePageUrl(c.platform, c.primaryHashtag);
      return {
        externalId: c.externalId,
        platform: c.platform,
        title: c.title[locale],
        description: c.description[locale],
        hashtags: c.hashtags,
        soundName: c.soundName,
        // Add a small per-locale jitter so two locales don't return the same
        // exact ranking — feels more alive in the UI.
        growthScore:
          c.growthScore +
          (locale === "fr" ? -1 : 1) +
          Math.floor(Math.random() * 3 - 1),
        sourceUrl,
        thumbnailUrl: c.thumbnailUrl,
        thumbnailUrlAlt: c.thumbnailUrlAlt,
        // No embed for curated (we link to the explore page, not a single
        // post). Apify rows will populate this when they have a real post.
        embedUrl: undefined,
        authorHandle: undefined,
        nicheTags: c.nicheTags,
        isNsfw: false,
        mediaKind: "image",
        mediaUrls: [c.thumbnailUrl, c.thumbnailUrlAlt].filter(
          (u): u is string => Boolean(u)
        ),
        locale,
        region: ctx?.region,
      };
    });

    // Optional region pass-through. The curated dataset is region-agnostic
    // (real lifestyle formats work everywhere) so we don't filter — we just
    // tag items with the requested region for transparency.
    return items.slice(0, ctx?.limit ?? items.length);
  }
}

/**
 * Dev-only stub. Returns 3 hand-curated trends so the UI / cron / LLM flow
 * can be exercised end-to-end without any third-party key. Refuses to run in
 * production so we never accidentally ship demo data to real users.
 */
export class DevStubProvider implements TrendsProvider {
  readonly id = "stub";

  isConfigured(): boolean {
    return process.env.NODE_ENV !== "production";
  }

  async fetchRawTrends(ctx?: ProviderContext): Promise<RawTrendItem[]> {
    if (!this.isConfigured()) {
      throw new Error(
        "DevStubProvider is disabled in production. Set TRENDS_PROVIDER to a real provider."
      );
    }
    const locale = ctx?.locale ?? "en";
    const items: RawTrendItem[] = [
      {
        externalId: "stub-grwm-running",
        platform: "TIKTOK",
        title:
          locale === "fr"
            ? "GRWM running — édition matinale"
            : "GRWM running — morning edition",
        description:
          locale === "fr"
            ? "Vlog 20s 'prépare-toi avec moi' avant un run, plan large + plans serrés tenue + sneakers."
            : "20s 'get ready with me' vlog before a run, wide shot + close-ups of outfit + sneakers.",
        hashtags: ["grwm", "running", "morningroutine", "fitnessgirl"],
        soundName: undefined,
        growthScore: 78,
        sourceUrl: undefined,
        nicheTags: ["FITNESS", "LIFESTYLE"],
        isNsfw: false,
        locale,
        region: ctx?.region,
      },
      {
        externalId: "stub-outfit-flip",
        platform: "INSTAGRAM",
        title:
          locale === "fr"
            ? "Outfit flip 3 tenues sur le même son"
            : "Outfit flip — 3 looks, one song",
        description:
          locale === "fr"
            ? "Reel 15s avec 3 changements de tenue rapides, transition saut-coupure."
            : "15s reel with 3 fast outfit swaps, jump-cut transition.",
        hashtags: ["outfit", "ootd", "transition", "fashionreel"],
        growthScore: 64,
        nicheTags: ["FASHION", "LIFESTYLE"],
        isNsfw: false,
        locale,
        region: ctx?.region,
      },
      {
        externalId: "stub-pov-cafe",
        platform: "TIKTOK",
        title:
          locale === "fr"
            ? "POV : ton café du matin en terrasse"
            : "POV: morning café on a Paris terrace",
        description:
          locale === "fr"
            ? "Photo carrousel cosy : café, journal, lumière dorée, plan large sur la rue."
            : "Cozy carousel: coffee, paper, golden hour light, wide shot of the street.",
        hashtags: ["pov", "morning", "cafe", "paris", "slowliving"],
        growthScore: 55,
        nicheTags: ["LIFESTYLE", "TRAVEL", "FOOD"],
        isNsfw: false,
        locale,
        region: ctx?.region,
      },
    ];
    return items.slice(0, ctx?.limit ?? items.length);
  }
}

// ──────────────────────────────────────────────
// Apify provider — TikTok + Instagram trending hashtags
// ──────────────────────────────────────────────
//
// We don't use `@apify/client` on purpose — it's a heavy SDK we'd carry into
// the serverless bundle just for one POST. The run-sync-get-dataset-items
// endpoint returns the dataset directly, which is exactly what we need.
//
// Two sub-fetchers wrapped behind one provider so the UI/cron see a single
// "apify" source:
//
//   1. TikTok — Trending Hashtags Scraper (default actor:
//      `scrapeengine/tiktok-trending-hashtags-scraper`). Returns the top-N
//      trending hashtags for a (country, period, industry) tuple. Each item
//      carries `hashtag_name`, `industry_info.label`, `video_views`,
//      `publish_cnt`, `rank`, optional `analytics`.
//   2. Instagram — `apify/instagram-hashtag-scraper`. Doesn't expose a
//      "trending list" so we seed with a niche-specific hashtag list and
//      surface the most engaged recent posts as "what's working" signals.
//
// Both sub-fetchers are tolerant: if one fails the other still ships. Worst
// case (both fail) we throw so the cron logs it and tries again tomorrow.

const APIFY_RUN_TIMEOUT_MS = 120_000;
const APIFY_TIKTOK_ACTOR_DEFAULT = "scrapeengine/tiktok-trending-hashtags-scraper";
const APIFY_INSTAGRAM_ACTOR_DEFAULT = "apify/instagram-hashtag-scraper";
const APIFY_INSTAGRAM_HASHTAGS_DEFAULT = [
  "fashion",
  "fitness",
  "lifestyle",
  "travel",
  "food",
  "ootd",
];

async function runApifyActor<T = unknown>(
  actorId: string,
  input: Record<string, unknown>,
  token: string
): Promise<T[]> {
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(
    actorId
  )}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&clean=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(APIFY_RUN_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apify actor ${actorId} returned HTTP ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(`Apify actor ${actorId} did not return an array`);
  }
  return data as T[];
}

/**
 * Resolve the TikTok country code from the provider context, falling back to
 * `APIFY_TIKTOK_COUNTRY` then "US". TikTok's Creative Center supports a
 * limited list (see Apify docs); we don't validate it strictly here — the
 * actor will error out and we'll log, which is the right failure mode.
 */
function resolveTikTokCountry(ctx?: ProviderContext): string {
  const fromCtx = ctx?.region?.trim()?.toUpperCase();
  if (fromCtx && fromCtx.length === 2) return fromCtx;
  const fromEnv = process.env.APIFY_TIKTOK_COUNTRY?.trim()?.toUpperCase();
  if (fromEnv && fromEnv.length === 2) return fromEnv;
  return "US";
}

function resolveTikTokPeriod(): "7" | "30" | "120" {
  const v = process.env.APIFY_TIKTOK_PERIOD?.trim();
  if (v === "30" || v === "120") return v;
  // 7 days = most actionable trends for short-form planning.
  return "7";
}

function resolveInstagramHashtags(): string[] {
  const raw = process.env.APIFY_INSTAGRAM_HASHTAGS;
  if (!raw) return APIFY_INSTAGRAM_HASHTAGS_DEFAULT;
  const list = raw
    .split(",")
    .map((s) => s.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : APIFY_INSTAGRAM_HASHTAGS_DEFAULT;
}

/**
 * TikTok Creative Center industries → our internal Niche enum keys.
 * The mapping is intentionally lossy — anything we can't map cleanly is
 * tagged `GENERAL` and the LLM personalization layer will figure it out.
 */
function mapTikTokIndustryToNiche(industryLabel: string | undefined): string[] {
  if (!industryLabel) return ["GENERAL"];
  const l = industryLabel.toLowerCase();
  if (l.includes("apparel") || l.includes("fashion") || l.includes("beauty")) return ["FASHION"];
  if (l.includes("sport") || l.includes("fitness") || l.includes("health")) return ["FITNESS"];
  if (l.includes("travel") || l.includes("tourism")) return ["TRAVEL"];
  if (l.includes("food") || l.includes("beverage") || l.includes("restaurant")) return ["FOOD"];
  if (l.includes("tech") || l.includes("electronics") || l.includes("software")) return ["TECH"];
  if (l.includes("game") || l.includes("gaming") || l.includes("esports")) return ["GAMING"];
  if (l.includes("lifestyle") || l.includes("home") || l.includes("daily")) return ["LIFESTYLE"];
  return ["GENERAL"];
}

/** Coarse niche tagging from a list of hashtags (used for IG). */
function inferNicheFromHashtags(hashtags: string[]): string[] {
  const joined = hashtags.join(" ").toLowerCase();
  const niches = new Set<string>();
  if (/fashion|ootd|outfit|style|streetwear|fashionista/.test(joined)) niches.add("FASHION");
  if (/fit(ness)?|workout|gym|running|crossfit|yoga/.test(joined)) niches.add("FITNESS");
  if (/travel|wanderlust|vacation|trip|explore|nomad/.test(joined)) niches.add("TRAVEL");
  if (/food|foodie|recipe|chef|dinner|brunch|coffee/.test(joined)) niches.add("FOOD");
  if (/tech|gadget|coding|developer|ai|startup/.test(joined)) niches.add("TECH");
  if (/gaming|gamer|esports|twitch|valorant|fortnite/.test(joined)) niches.add("GAMING");
  if (/lifestyle|life|daily|aesthetic|cozy|home|grwm/.test(joined)) niches.add("LIFESTYLE");
  if (niches.size === 0) niches.add("GENERAL");
  return Array.from(niches);
}

/**
 * Normalize TikTok video_views (which can be in the billions) into a 0..100
 * "growthScore" using a log scale so the UI doesn't show "9876543". Tuning:
 *   - 100k views   →  ~50
 *   - 1M  views    →  ~67
 *   - 10M views    →  ~83
 *   - 100M views   →  ~100
 */
function viewsToGrowthScore(views: number | undefined): number | undefined {
  if (typeof views !== "number" || views <= 0) return undefined;
  const score = (Math.log10(views) / 8) * 100;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

interface TikTokHashtagRow {
  hashtag_id?: string;
  hashtag_name?: string;
  industry_info?: { id?: string; label?: string; value?: string };
  video_views?: number;
  publish_cnt?: number;
  rank?: number;
  rank_diff_type?: number;
  analytics?: {
    rank?: number;
    period?: string;
    rank_change_readable?: string;
    publish_cnt?: number;
    video_views?: number;
  };
}

function mapTikTokRow(
  row: TikTokHashtagRow,
  ctx: { country: string; period: string }
): RawTrendItem | null {
  const name = row.hashtag_name?.trim();
  if (!name) return null;
  const views = row.video_views ?? row.analytics?.video_views;
  const rankChange = row.analytics?.rank_change_readable;
  const niches = mapTikTokIndustryToNiche(row.industry_info?.label);
  const description = [
    row.industry_info?.label ? `Industry: ${row.industry_info.label}.` : "",
    typeof row.publish_cnt === "number"
      ? `${row.publish_cnt.toLocaleString("en-US")} posts published`
      : "",
    typeof views === "number"
      ? `${views.toLocaleString("en-US")} aggregated video views`
      : "",
    rankChange ? `Trend direction: ${rankChange}.` : "",
    `Period: last ${ctx.period} days in ${ctx.country}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    externalId: `apify-tiktok-${row.hashtag_id ?? name.toLowerCase()}`,
    platform: "TIKTOK",
    title: `#${name}`,
    description,
    hashtags: [name],
    growthScore: viewsToGrowthScore(views),
    sourceUrl: `https://www.tiktok.com/tag/${encodeURIComponent(name)}`,
    nicheTags: niches,
    isNsfw: false,
    region: ctx.country,
    mediaKind: "hashtag_signal",
    mediaUrls: [],
  };
}

interface InstagramPostRow {
  id?: string;
  shortCode?: string;
  url?: string;
  caption?: string;
  hashtags?: string[];
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  playCount?: number;
  type?: string; // "Image" | "Video" | "Sidecar"
  inputUrl?: string;
  displayUrl?: string;
  videoUrl?: string;
  thumbnailSrc?: string;
  images?: string[];
}

/** Collect public media URLs from one IG post row (Apify shape). */
export function extractPostMediaUrls(post: InstagramPostRow): string[] {
  const urls = new Set<string>();
  for (const u of [
    post.displayUrl,
    post.videoUrl,
    post.thumbnailSrc,
    post.url,
  ]) {
    if (u?.startsWith("http")) urls.add(u);
  }
  for (const img of post.images ?? []) {
    if (img?.startsWith("http")) urls.add(img);
  }
  return [...urls];
}

/**
 * Aggregate raw Instagram posts into one trend per source hashtag. We pick
 * the top-3 most engaged posts per tag, then build a single TrendItem that
 * summarizes what's working.
 */
function aggregateInstagramPosts(
  posts: InstagramPostRow[]
): RawTrendItem[] {
  const byTag = new Map<string, InstagramPostRow[]>();
  for (const post of posts) {
    // The actor exposes the *queried* hashtag in `inputUrl` like
    //   "https://www.instagram.com/explore/tags/<tag>"
    const m = post.inputUrl?.match(/\/tags\/([^/?#]+)/i);
    const tag = m?.[1]?.toLowerCase();
    if (!tag) continue;
    const list = byTag.get(tag) ?? [];
    list.push(post);
    byTag.set(tag, list);
  }

  const out: RawTrendItem[] = [];
  for (const [tag, list] of byTag.entries()) {
    if (list.length === 0) continue;
    const ranked = [...list].sort(
      (a, b) =>
        ((b.likesCount ?? 0) + 5 * (b.commentsCount ?? 0)) -
        ((a.likesCount ?? 0) + 5 * (a.commentsCount ?? 0))
    );
    const top = ranked.slice(0, 3);
    const totalEng = ranked.reduce(
      (s, p) => s + (p.likesCount ?? 0) + (p.commentsCount ?? 0),
      0
    );
    const allHashtags = new Set<string>([tag]);
    for (const p of top) {
      for (const h of p.hashtags ?? []) allHashtags.add(h.toLowerCase());
    }
    // Caption preview — first non-empty caption from the top post, trimmed.
    const samplePost = top[0];
    const sample = samplePost?.caption?.trim();
    const description =
      (sample
        ? `Top post excerpt: "${sample.split(/\n+/)[0]?.slice(0, 200)}". `
        : "") +
      `${ranked.length} recent posts under #${tag} with ~${totalEng.toLocaleString(
        "en-US"
      )} combined likes+comments.`;

    const mediaUrls = [
      ...new Set(top.flatMap((p) => extractPostMediaUrls(p))),
    ].slice(0, 8);
    const isVideo = top.some((p) => p.type?.toLowerCase() === "video");
    const thumb = mediaUrls[0];
    const thumbAlt = mediaUrls[1];

    out.push({
      externalId: `apify-instagram-${tag}`,
      platform: "INSTAGRAM",
      title: `#${tag}`,
      description,
      hashtags: Array.from(allHashtags).slice(0, 12),
      growthScore: viewsToGrowthScore(totalEng),
      sourceUrl: `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`,
      thumbnailUrl: thumb,
      thumbnailUrlAlt: thumbAlt,
      embedUrl: samplePost?.url?.startsWith("http") ? samplePost.url : undefined,
      nicheTags: inferNicheFromHashtags(Array.from(allHashtags)),
      isNsfw: false,
      mediaUrls,
      mediaKind: isVideo ? "video" : top.length > 1 ? "carousel" : "image",
    });
  }
  return out;
}

export class ApifyTrendsProvider implements TrendsProvider {
  readonly id = "apify";

  isConfigured(): boolean {
    return Boolean(process.env.APIFY_TOKEN);
  }

  async fetchRawTrends(ctx?: ProviderContext): Promise<RawTrendItem[]> {
    if (!this.isConfigured()) {
      throw new Error("ApifyTrendsProvider is missing APIFY_TOKEN");
    }
    const token = process.env.APIFY_TOKEN!;
    const limit = ctx?.limit ?? 60;
    // Roughly half TikTok, half Instagram — adjustable via env tweaking.
    const tiktokTarget = Math.ceil(limit * 0.6);
    const instagramTarget = Math.max(0, limit - tiktokTarget);

    const [tiktokResult, instagramResult] = await Promise.allSettled([
      this.fetchTikTok(token, ctx, tiktokTarget),
      this.fetchInstagram(token, instagramTarget),
    ]);

    const out: RawTrendItem[] = [];
    let collectedAny = false;

    if (tiktokResult.status === "fulfilled") {
      collectedAny = true;
      out.push(...tiktokResult.value);
    } else {
      console.error("[trends/apify] TikTok sub-fetch failed:", tiktokResult.reason);
    }
    if (instagramResult.status === "fulfilled") {
      collectedAny = true;
      out.push(...instagramResult.value);
    } else {
      console.error("[trends/apify] Instagram sub-fetch failed:", instagramResult.reason);
    }

    if (!collectedAny) {
      // Surface the most actionable error (TikTok is the default expectation).
      const reason =
        tiktokResult.status === "rejected"
          ? tiktokResult.reason
          : instagramResult.status === "rejected"
            ? instagramResult.reason
            : new Error("unknown");
      throw new Error(`Apify provider returned no data: ${String(reason)}`);
    }

    return out;
  }

  // ──────────────────────────────────────────────
  // Sub-fetchers (exposed as private methods for unit testing)
  // ──────────────────────────────────────────────

  private async fetchTikTok(
    token: string,
    ctx: ProviderContext | undefined,
    limit: number
  ): Promise<RawTrendItem[]> {
    if (limit <= 0) return [];
    const actorId =
      process.env.APIFY_TIKTOK_ACTOR?.trim() || APIFY_TIKTOK_ACTOR_DEFAULT;
    const country = resolveTikTokCountry(ctx);
    const period = resolveTikTokPeriod();
    const input: Record<string, unknown> = {
      result_type: "top100_with_analytics",
      country,
      top100_period: period,
      total_hashtags: Math.min(limit, 100),
      sort_order: "popular",
      industry: "",
      proxyConfiguration: { useApifyProxy: true },
    };
    const rows = await runApifyActor<TikTokHashtagRow>(actorId, input, token);
    return rows
      .map((row) => mapTikTokRow(row, { country, period }))
      .filter((r): r is RawTrendItem => r !== null);
  }

  private async fetchInstagram(
    token: string,
    limit: number
  ): Promise<RawTrendItem[]> {
    if (limit <= 0) return [];
    const actorId =
      process.env.APIFY_INSTAGRAM_ACTOR?.trim() || APIFY_INSTAGRAM_ACTOR_DEFAULT;
    const hashtags = resolveInstagramHashtags();
    // Get ~10 recent posts per hashtag — enough to rank and aggregate.
    const perHashtag = Math.max(5, Math.ceil((limit * 10) / hashtags.length));
    const input: Record<string, unknown> = {
      hashtags,
      resultsType: "posts",
      resultsLimit: perHashtag,
    };
    const rows = await runApifyActor<InstagramPostRow>(actorId, input, token);
    const aggregated = aggregateInstagramPosts(rows);
    return aggregated
      .sort((a, b) => (b.growthScore ?? 0) - (a.growthScore ?? 0))
      .slice(0, limit);
  }
}

/** Back-compat alias — old code still imports `ApifyProvider`. */
export const ApifyProvider = ApifyTrendsProvider;

// Exported for unit tests.
export const __test__ = {
  mapTikTokRow,
  aggregateInstagramPosts,
  extractPostMediaUrls,
  mapTikTokIndustryToNiche,
  inferNicheFromHashtags,
  viewsToGrowthScore,
  resolveTikTokCountry,
  resolveTikTokPeriod,
  resolveInstagramHashtags,
};

/**
 * Generic HTTP provider — for any backend that exposes a `RawTrendItem[]` feed
 * directly. URL is taken from `TRENDS_HTTP_URL`, auth via optional
 * `TRENDS_HTTP_TOKEN` (Bearer). Useful for self-hosted scrapers / curated
 * feeds where you control the schema.
 */
export class GenericHttpProvider implements TrendsProvider {
  readonly id = "http";

  isConfigured(): boolean {
    return Boolean(process.env.TRENDS_HTTP_URL);
  }

  async fetchRawTrends(ctx?: ProviderContext): Promise<RawTrendItem[]> {
    if (!this.isConfigured()) {
      throw new Error("GenericHttpProvider is missing TRENDS_HTTP_URL");
    }
    const url = new URL(process.env.TRENDS_HTTP_URL!);
    if (ctx?.region) url.searchParams.set("region", ctx.region);
    if (ctx?.locale) url.searchParams.set("locale", ctx.locale);
    if (ctx?.limit) url.searchParams.set("limit", String(ctx.limit));

    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.TRENDS_HTTP_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.TRENDS_HTTP_TOKEN}`;
    }

    const res = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`Trends HTTP feed returned ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as unknown;
    const items = Array.isArray(data)
      ? data
      : Array.isArray((data as { items?: unknown }).items)
        ? (data as { items: unknown[] }).items
        : [];
    return items
      .map((row) => normalizeLooseItem(row))
      .filter((row): row is RawTrendItem => row !== null);
  }
}

// ──────────────────────────────────────────────
// Resolution
// ──────────────────────────────────────────────

/**
 * Pick the right provider based on env. Always returns a usable provider
 * thanks to `CuratedTrendsProvider` (no external dependency, ships an
 * evergreen seed dataset). Returns `null` only when an explicit env override
 * targets an unavailable provider, so the caller still gets a clear "not
 * configured" signal in that case.
 */
export function resolveTrendsProvider(): TrendsProvider | null {
  const choice = process.env.TRENDS_PROVIDER?.trim().toLowerCase();
  const apify = new ApifyTrendsProvider();
  const http = new GenericHttpProvider();
  const curated = new CuratedTrendsProvider();
  const stub = new DevStubProvider();

  if (choice === "apify") return apify.isConfigured() ? apify : null;
  if (choice === "http") return http.isConfigured() ? http : null;
  if (choice === "curated") return curated;
  if (choice === "stub") return stub.isConfigured() ? stub : null;

  // Auto-resolve. Order:
  //   1. Apify if a paid token is set (best signal — real-time top hashtags)
  //   2. Generic HTTP if a self-hosted feed is wired
  //   3. Curated — always available, evergreen seed dataset → guarantees
  //      the Trends page is never empty for paying users even before the
  //      Apify subscription is set up
  //   4. DevStub in dev only (smaller, debug-friendly dataset)
  if (apify.isConfigured()) return apify;
  if (http.isConfigured()) return http;
  if (curated.isConfigured()) return curated;
  if (stub.isConfigured()) return stub;
  return null;
}

// ──────────────────────────────────────────────
// Defensive normalization (loose Apify / custom feed shapes)
// ──────────────────────────────────────────────

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
function asBoolean(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}
function asPlatform(v: unknown): Platform | undefined {
  if (typeof v !== "string") return undefined;
  const up = v.toUpperCase();
  if (up === "TIKTOK" || up === "INSTAGRAM" || up === "ONLYFANS") {
    return up as Platform;
  }
  return undefined;
}

function normalizeLooseItem(row: unknown): RawTrendItem | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const platform = asPlatform(r.platform);
  const title = asString(r.title) ?? asString(r.name) ?? asString(r.hashtag);
  const externalId = asString(r.externalId) ?? asString(r.id) ?? asString(r.url);
  if (!platform || !title || !externalId) return null;
  return {
    externalId,
    platform,
    title,
    description: asString(r.description),
    hashtags: asStringArray(r.hashtags).map((h) => h.replace(/^#/, "")),
    soundName: asString(r.soundName) ?? asString(r.sound),
    growthScore: asNumber(r.growthScore) ?? asNumber(r.score),
    sourceUrl: asString(r.sourceUrl) ?? asString(r.url),
    nicheTags: asStringArray(r.nicheTags),
    isNsfw: asBoolean(r.isNsfw) ?? false,
    locale: asString(r.locale),
    region: asString(r.region),
  };
}

