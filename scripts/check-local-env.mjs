#!/usr/bin/env node
/**
 * Vérifie la config locale avant `npm run dev`.
 * Échoue avec un message clair si Clerk LIVE est utilisé sans override dev.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = {
  ...parseEnvFile(resolve(root, ".env")),
  ...parseEnvFile(resolve(root, ".env.local")),
};

const pk = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const appUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

if (pk.startsWith("pk_live_")) {
  console.error(`
\x1b[31m[Aura] Clerk LIVE détecté — localhost ne fonctionnera pas.\x1b[0m

Erreur Clerk attendue :
  "Production Keys are only allowed for domain aurainfluenceai.com"

\x1b[33mSolution recommandée (2 min) :\x1b[0m
  1. Clerk Dashboard → instance \x1b[1mDevelopment\x1b[0m (pas Production)
  2. Copier pk_test_… et sk_test_…
  3. Créer \x1b[1m.env.local\x1b[0m à la racine du projet :

     NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…
     CLERK_SECRET_KEY=sk_test_…
     NEXT_PUBLIC_APP_URL=http://localhost:3000

  4. Relancer : npm run dev

\x1b[33mAlternative\x1b[0m : ajouter http://localhost:3000 dans
  Clerk → Configure → Allowed origins (instance Production).
  Moins recommandé en dev.

Voir aussi : .env.local.example
`);
  process.exit(1);
}

if (!pk.startsWith("pk_test_") && pk.length > 0) {
  console.warn("[Aura] Clé Clerk inattendue (ni pk_test_ ni pk_live_).");
}

console.log(`[Aura] Config locale OK — APP_URL=${appUrl}`);
