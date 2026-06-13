/**
 * Sprint B — seed the BasePortrait gallery shown in the wizard (step 2).
 *
 * Generates real portraits via the existing Replicate pipeline
 * (`generateSeedBasePortrait`) and inserts BasePortrait rows. Designed to run
 * OFFLINE — it costs API time/money, so it is never triggered at runtime.
 *
 * Usage:
 *   tsx scripts/seed-base-portraits.ts --niche FITNESS            # one niche
 *   tsx scripts/seed-base-portraits.ts --niche ALL --per 12       # everything
 *   tsx scripts/seed-base-portraits.ts --niche FASHION --dry-run  # no API/DB
 *
 * Flags:
 *   --niche   FASHION|FITNESS|LIFESTYLE|TRAVEL|TECH|GAMING|ADULT|FOOD|ALL (default ALL)
 *   --gender  female|male|nonbinary (default female)
 *   --per     number of bases per niche (default 12)
 *   --dry-run print the planned combos without calling Replicate/DB
 *
 * Requires env: DATABASE_URL, REPLICATE_API_TOKEN, R2/storage creds.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { generateSeedBasePortrait } from "../src/server/services/ai-image.service";

type Niche =
  | "FASHION"
  | "FITNESS"
  | "LIFESTYLE"
  | "TRAVEL"
  | "TECH"
  | "GAMING"
  | "ADULT"
  | "FOOD";

const ALL_NICHES: Niche[] = [
  "FASHION",
  "FITNESS",
  "LIFESTYLE",
  "TRAVEL",
  "TECH",
  "GAMING",
  "ADULT",
  "FOOD",
];

// Diversity pools — French labels matching WIZARD_APPEARANCE_VALUES so the
// prompt builder maps them the same way the wizard does.
const ETHNICITIES = [
  "Caucasienne",
  "Afro",
  "Asiatique",
  "Latina",
  "Métisse",
  "Moyen-Orient",
  "Indienne",
];
const BODY_TYPES = ["Fine", "Athlétique", "Moyenne", "Curvy", "Plus-size", "Petite"];
const HAIR_COLORS = ["Noir", "Brun", "Blond", "Roux", "Platine"];
const HAIR_STYLES = ["Long, Ondulé", "Mi-long, Lisse", "Court, Lisse", "Long, Bouclé"];

/** Per-niche styling + positioning tags (tags feed the Aura brief matching). */
const NICHE_CONFIG: Record<
  Niche,
  { fashionStyle: string; tags: string[]; isNsfw: boolean }
> = {
  FASHION: { fashionStyle: "Chic", tags: ["chic", "premium", "mode", "élégante"], isNsfw: false },
  FITNESS: { fashionStyle: "Sporty", tags: ["sportive", "fitness", "énergique", "coach"], isNsfw: false },
  LIFESTYLE: { fashionStyle: "Casual", tags: ["lifestyle", "authentique", "cozy", "naturelle"], isNsfw: false },
  TRAVEL: { fashionStyle: "Bohème", tags: ["voyage", "aventure", "bohème", "soleil"], isNsfw: false },
  TECH: { fashionStyle: "Streetwear", tags: ["tech", "moderne", "geek", "streetwear"], isNsfw: false },
  GAMING: { fashionStyle: "Streetwear", tags: ["gaming", "cool", "streetwear", "fun"], isNsfw: false },
  ADULT: { fashionStyle: "Glamour", tags: ["premium", "glamour", "féminine", "mystère", "boudoir"], isNsfw: true },
  FOOD: { fashionStyle: "Casual", tags: ["food", "gourmande", "chaleureuse", "casual"], isNsfw: false },
};

const AGE_BY_NICHE: Record<Niche, number> = {
  FASHION: 24,
  FITNESS: 27,
  LIFESTYLE: 26,
  TRAVEL: 28,
  TECH: 26,
  GAMING: 23,
  ADULT: 23,
  FOOD: 29,
};

type Combo = {
  niche: Niche;
  gender: string;
  age: number;
  ethnicity: string;
  bodyType: string;
  hairColor: string;
  hairStyle: string;
  fashionStyle: string;
  tags: string[];
  isNsfw: boolean;
};

function buildCombos(niche: Niche, gender: string, count: number): Combo[] {
  const cfg = NICHE_CONFIG[niche];
  const age = AGE_BY_NICHE[niche];
  const combos: Combo[] = [];
  for (let i = 0; i < count; i++) {
    const ethnicity = ETHNICITIES[i % ETHNICITIES.length]!;
    const bodyType = BODY_TYPES[i % BODY_TYPES.length]!;
    const hairColor = HAIR_COLORS[i % HAIR_COLORS.length]!;
    const hairStyle = HAIR_STYLES[i % HAIR_STYLES.length]!;
    combos.push({
      niche,
      gender,
      age,
      ethnicity,
      bodyType,
      hairColor,
      hairStyle,
      fashionStyle: cfg.fashionStyle,
      tags: cfg.tags,
      isNsfw: cfg.isNsfw,
    });
  }
  return combos;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback?: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1]! : fallback;
  };
  return {
    niche: (get("--niche", "ALL") || "ALL").toUpperCase(),
    gender: get("--gender", "female") || "female",
    per: Number.parseInt(get("--per", "12") || "12", 10),
    dryRun: args.includes("--dry-run"),
  };
}

async function main() {
  const { niche, gender, per, dryRun } = parseArgs();
  const niches: Niche[] =
    niche === "ALL" ? ALL_NICHES : [niche as Niche].filter((n) => ALL_NICHES.includes(n));

  if (niches.length === 0) {
    console.error(`Niche invalide: ${niche}. Valeurs: ${ALL_NICHES.join(", ")}, ALL`);
    process.exit(1);
  }

  const plan = niches.flatMap((n) => buildCombos(n, gender, per));
  console.log(
    `\nPlan: ${plan.length} portraits (${niches.length} niche(s) × ${per}, gender=${gender})${dryRun ? " [DRY RUN]" : ""}\n`
  );

  if (dryRun) {
    console.table(
      plan.map((c) => ({
        niche: c.niche,
        ethnicity: c.ethnicity,
        body: c.bodyType,
        hair: `${c.hairColor} / ${c.hairStyle}`,
        nsfw: c.isNsfw,
      }))
    );
    return;
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  let ok = 0;
  let failed = 0;

  for (const [index, combo] of plan.entries()) {
    const label = `${combo.niche} ${combo.ethnicity}/${combo.bodyType}`;
    try {
      console.log(`[${index + 1}/${plan.length}] Generating ${label}…`);
      const { imageUrl } = await generateSeedBasePortrait(combo.age, {
        gender: combo.gender as "female" | "male" | "nonbinary",
        ethnicity: combo.ethnicity,
        hairColor: combo.hairColor,
        hairStyle: combo.hairStyle,
        bodyType: combo.bodyType,
        fashionStyle: combo.fashionStyle,
      });

      await db.basePortrait.create({
        data: {
          niche: combo.niche,
          gender: combo.gender,
          ethnicity: combo.ethnicity,
          bodyType: combo.bodyType,
          imageUrl,
          isNsfw: combo.isNsfw,
          tags: combo.tags,
          sortOrder: index,
        },
      });
      ok++;
      console.log(`   ✓ stored ${imageUrl}`);
    } catch (err) {
      failed++;
      console.error(`   ✗ ${label}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nDone. ${ok} created, ${failed} failed.\n`);
  await db.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
