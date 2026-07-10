import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { recommendBasePortraitIds } from "@/server/services/base-portrait-agent.service";

const nicheValues = [
  "FASHION",
  "FITNESS",
  "LIFESTYLE",
  "TRAVEL",
  "TECH",
  "GAMING",
  "ADULT",
  "FOOD",
] as const;

const genderValues = ["female", "male", "nonbinary"] as const;

/** How many top-matching bases get the "recommended by Aura" badge. */
const RECOMMENDED_COUNT = 3;

/**
 * Score a portrait against the wizard brief: count how many of its tags appear
 * in the brief text. Cheap heuristic (no extra LLM call) that turns the
 * Aura-generated brief into a relevance signal for the gallery.
 */
function scoreAgainstBrief(tags: string[], briefLower: string): number {
  if (!briefLower) return 0;
  return tags.reduce(
    (acc, tag) => (tag && briefLower.includes(tag.toLowerCase()) ? acc + 1 : acc),
    0
  );
}

/**
 * Sprint B — pre-generated base portraits gallery for the wizard.
 * Read-only: the catalog is seeded offline (scripts/seed-base-portraits.ts).
 */
export const basePortraitRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        niche: z.enum(nicheValues),
        gender: z.enum(genderValues).default("female"),
        /** When false, NSFW bases are hidden. */
        includeNsfw: z.boolean().default(false),
        /** Aura brief — used to rank/highlight the most on-brand bases. */
        brief: z.string().max(1000).optional(),
        locale: z.enum(["fr", "en"]).optional(),
        limit: z.number().int().min(1).max(60).default(24),
      })
    )
    .query(async ({ input }) => {
      const rows = await db.basePortrait.findMany({
        where: {
          niche: input.niche,
          gender: input.gender,
          active: true,
          ...(input.includeNsfw ? {} : { isNsfw: false }),
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: input.limit,
        select: {
          id: true,
          imageUrl: true,
          thumbnailUrl: true,
          ethnicity: true,
          bodyType: true,
          isNsfw: true,
          tags: true,
        },
      });

      const briefLower = input.brief?.trim().toLowerCase() ?? "";

      // Rank by brief relevance while keeping the manual sortOrder as tiebreak.
      const scored = rows.map((row, index) => ({
        row,
        index,
        score: scoreAgainstBrief(row.tags, briefLower),
      }));

      scored.sort((a, b) =>
        b.score !== a.score ? b.score - a.score : a.index - b.index
      );

      let recommendedIds = new Set(
        scored
          .filter((s) => s.score > 0)
          .slice(0, RECOMMENDED_COUNT)
          .map((s) => s.row.id)
      );

      let auraRationale: string | undefined;

      if (input.brief?.trim() && rows.length > 0) {
        try {
          const llm = await recommendBasePortraitIds({
            locale: input.locale ?? "fr",
            niche: input.niche,
            gender: input.gender,
            brief: input.brief.trim(),
            portraits: rows.map((row) => ({
              id: row.id,
              ethnicity: row.ethnicity,
              bodyType: row.bodyType,
              isNsfw: row.isNsfw,
              tags: row.tags,
            })),
          });
          if (llm.recommendedIds.length > 0) {
            recommendedIds = new Set(llm.recommendedIds.slice(0, RECOMMENDED_COUNT));
            auraRationale = llm.rationale;
          }
        } catch (error) {
          console.warn("[basePortrait.list] LLM ranking failed:", error);
        }
      }

      return {
        portraits: scored.map(({ row }) => ({
          id: row.id,
          imageUrl: row.imageUrl,
          thumbnailUrl: row.thumbnailUrl,
          ethnicity: row.ethnicity,
          bodyType: row.bodyType,
          isNsfw: row.isNsfw,
          tags: row.tags,
          recommended: recommendedIds.has(row.id),
        })),
        auraRationale,
      };
    }),
});
