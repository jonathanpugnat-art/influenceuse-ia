# Audit technique — clôture (mai 2026)

Document de synthèse après l’audit « prod-ready » (hors E2E Playwright, reporté).

---

## Statut global

| Zone | Statut | Notes |
|------|--------|--------|
| Build TypeScript / Next | ✅ Fait | Together FLUX `steps`, build vert |
| Routes `/[locale]` | ✅ Fait | Landing `/home`, racine = redirect |
| Crédits atomiques | ✅ Fait | `UPDATE … WHERE creditsUsed + cost <= creditsLimit` |
| Rate limit IA (tRPC) | ✅ Fait | 30 req/min/user, in-memory par instance |
| ESLint React 19 | ✅ Fait | 0 erreur `--quiet` |
| Turbopack root | ✅ Fait | `next.config.ts` |
| Clerk / navigation | ✅ Fait | After-sign-in → `/fr/influencers`, sidebar cohérente |
| Middleware `/home` public | ✅ Fait | Invités peuvent voir la landing |
| Instagram OAuth `start` | ✅ Fait | Route + tests unitaires |
| Tests Vitest | ✅ Fait | 343 tests (dernier run audit) |
| E2E Playwright | ⏸ Reporté | Dossier local non commité |
| Rate limit Redis multi-instance | ⏸ Reporté | `REDIS_URL` présent, non branché sur tRPC |
| `refundCredits` branché partout | ⏸ Optionnel | Déduction après succès API → peu de cas |
| BullMQ workers | ⏸ Reporté | Pas de worker actif en prod |
| Monétisation live | ⏸ Manuel | `BETA_HIDE_PAYMENTS=true` volontaire |
| OAuth Meta / TikTok prod | ⏸ Manuel | Voir `PROD_CHECKLIST.md` § P5 |

---

## Correctifs code livrés (commit `eed723f`)

1. **Together FLUX** — alignement `steps` / `num_inference_steps` entre provider et `ai-image.service.ts`.
2. **Routing** — `src/app/[locale]/(public)/home/page.tsx` (marketing), `page.tsx` racine = redirect Clerk.
3. **Suppression** du doublon `(dashboard)/page.tsx` (conflit URL avec la landing).
4. **Crédits** — déduction SQL atomique + tests `credits.service`.
5. **Rate limit** — `src/server/trpc/rate-limit.ts` sur `protectedProcedure`.
6. **Liens** — pricing, legal, changelog → `/home` ; logo sidebar → `/influencers`.
7. **Qualité** — correctifs ESLint ciblés, `turbopack.root`, test `rate-limit`.

---

## Actions manuelles restantes (toi / Vercel)

Voir **`docs/PROD_CHECKLIST.md`** :

- P0 : `TOGETHER_API_KEY`, Sightengine, `R2_PUBLIC_URL`, redeploy
- P1 : tests photo social (Candid, props)
- P2 : Premium Pro + modération
- P3 : CGU / Stripe live / `BETA_HIDE_PAYMENTS=false`
- P5 : Instagram / TikTok App Review

### Variables Vercel à vérifier après l’audit

```env
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/fr/influencers
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/fr/influencers
```

---

## Comportement routing attendu

| URL | Invité | Connecté |
|-----|--------|----------|
| `/fr` | → `/fr/home` | → `/fr/influencers` |
| `/fr/home` | Landing marketing | Landing (publique) |
| `/fr/influencers` | Sign-in | Liste influenceuses |

---

## Prochaines étapes recommandées (post-audit)

1. **E2E** — Playwright : wizard express, génération photo, redirect racine (quand tu voudras).
2. **Redis** — rate limit partagé entre instances Vercel si trafic > 1 instance.
3. **Dashboard** — recréer une vraie page stats si tu veux plus qu’une liste sur `/influencers`.
4. **DeepSeek retry** — backoff sur 429 si charge multi-utilisateurs.

---

*Audit technique clos côté code — mai 2026.*
