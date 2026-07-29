/**
 * P0 — Smoke day-1 value: 1 simple photo for Luna (café / lifestyle).
 * Usage: DEMO_SKIP_BILLING=true npx tsx scripts/p0-smoke-day1-photo.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { parseIdentityPack } from "../src/lib/identity-pack";
import type { AppearanceVariation } from "../src/lib/prompts/image-prompts";
import { resolvePublicMediaUrl } from "../src/server/lib/resolve-public-media-url";
import {
  generateContentImage,
  type InfluencerStyle,
} from "../src/server/services/ai-image.service";

const LUNA_ID = "cmpbizit8000004icudikwyen";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const influencer = await prisma.influencer.findUnique({
      where: { id: LUNA_ID },
    });
    if (!influencer?.baseImageUrl) {
      throw new Error("Luna Fit Test introuvable");
    }

    const baseImageUrl = await resolvePublicMediaUrl(influencer.baseImageUrl);
    if (!baseImageUrl) throw new Error("Portrait inaccessible");

    const styleJson = influencer.style as Record<string, string> | null;
    const style: InfluencerStyle = {
      gender: "female",
      ethnicity: styleJson?.ethnicity,
      hairColor: styleJson?.hairColor,
      hairStyle: styleJson?.hairStyle,
      bodyType: styleJson?.bodyType,
      fashionStyle: styleJson?.fashionStyle,
    };

    console.log("Génération photo café / lifestyle (jour 1)…");

    const result = await generateContentImage(
      influencer.userId,
      influencer.age,
      style,
      {
        influencerId: influencer.id,
        baseImageUrl,
        useReferenceFace: true,
        scene: "cafe",
        sceneDescription:
          "Bright modern cafe, sitting at a wooden table with a latte, large window daylight, casual confident smile, vertical Instagram photo",
        pose: "sitting",
        outfit:
          "cream knit sweater and high-waist jeans, clean lifestyle fashion look",
        expression: "smile",
        style: "natural",
        lighting: "natural",
        isNsfw: false,
        customPrompt:
          "authentic lifestyle creator photo, fully clothed, friendly energy",
        numberOfImages: 1,
        appearanceVariations:
          (influencer.appearanceVariations as AppearanceVariation | null) ??
          undefined,
        identityPack: parseIdentityPack(influencer.identityPack),
        instagramShot: false,
        omitCreditBilling: true,
      }
    );

    console.log("\n✅ Photo OK — valeur jour 1");
    console.log(result.imageUrls[0]);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
