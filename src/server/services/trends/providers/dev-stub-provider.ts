import type { ProviderContext, RawTrendItem, TrendsProvider } from "./types";

/**
 * Dev-only stub. Returns 3 hand-curated trends so the UI / cron / LLM flow
 * can be exercised end-to-end without any third-party key.
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
