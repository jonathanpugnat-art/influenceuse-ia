# Audit produit — Aura Influence AI (juin 2026)

Document de référence pour la roadmap Audit → P0 → P1. Complète [`AUDIT_TECHNIQUE.md`](AUDIT_TECHNIQUE.md) (infra) avec une vue **produit / UX / orchestration**.

---

## Synthèse exécutive

| Verdict | Modules |
|---------|---------|
| **Refaire** | Agents (unification photo), Dual lane UX (orpheline) |
| **Finir** | Wizard, Photo, Reel, Trends, Calendar, Publish IG, Identity pack, Voix |
| **Jeter** | Stubs agent unifié photo/trends (remplacer par implémentation) |
| **Backlog post-P1** | TikTok UI, agent 30j batch, voix par persona, reels v2 |

**Problème central** : les pièces techniques existent mais ne forment pas un produit fluide — lane Premium invisible, agents fragmentés, intent perdu en mode Social (safety soften).

---

## Grille module par module

### 1. Wizard (création influenceuse)

| | |
|---|---|
| **Statut** | Partial (70 %) |
| **Verdict** | **Finir** — P1 Apparence v2 |
| **Fichiers** | `src/hooks/use-influencer-wizard.ts`, `wizard-step-*.tsx`, `wizard-agent.service.ts` |
| **Complete** | 4 étapes, express, draft persist, 4 portraits, fingerprint, identity pack wait |
| **Partial** | Agent chat étapes 1 & 4 seulement ; 4 morphologies ; OAuth IG mid-wizard |
| **Broken** | — |
| **Tests** | Bon lib (`wizard-validation`, `wizard-prompts`, `appearance-map`) ; pas E2E |
| **Risque prod #1** | OAuth Meta App Review |

### 2. Agents (unifié + spécialisés)

| | |
|---|---|
| **Statut** | Partial (50 %) |
| **Verdict** | **Refaire** — P0 unification photo |
| **Fichiers** | `agent.service.ts`, `agent-core.ts`, `photo-studio-agent.service.ts`, `wizard-agent.service.ts`, `calendar-agent.service.ts`, `trends-agent.service.ts` |
| **Complete** | Calendar agent, wizard agent, photo studio (route séparée), trends analyze (route séparée) |
| **Stub** | `agent.chatTurn` domain `photo` et `trends` |
| **Broken** | — |
| **Tests** | `calendar-agent.test.ts` OK ; photo/wizard/trends services non testés intégration |
| **Risque prod #1** | Double stack confuse pour l'utilisateur |

### 3. Photo pipeline

| | |
|---|---|
| **Statut** | Partial → code complete (75 %) |
| **Verdict** | **Finir** — P0 lane + intent |
| **Fichiers** | `ai-image.service.ts`, `photo-studio-agent-panel.tsx`, `photo-params.tsx`, `photo-prompt-enrichment.service.ts` |
| **Complete** | Nano/Kontext/Flux, scene-first 2 étapes, identity pack refs, trends seed |
| **Partial** | Lane UX dans `PhotoParams` **orphelin** (sidebar non montée) ; qualité social prod |
| **Broken** | — |
| **Tests** | Lib riche (~15 fichiers) ; pas `ai-image.service` intégration |
| **Risque prod #1** | `softenPromptForEditorial` réécrit lingerie en Social |

### 4. Reel / vidéo

| | |
|---|---|
| **Statut** | Partial (60 %) |
| **Verdict** | **Finir** (hors P0/P1) |
| **Fichiers** | `ai-video.service.ts`, `reel-params.tsx`, `reel-scene-frame.ts` |
| **Complete** | Kling I2V, scene frame, lip-sync Sync, TTS panel |
| **Partial** | Enrichissement prompt vidéo absent ; batch calendrier PHOTO only |
| **Broken** | — |
| **Tests** | Prompts OK ; pas service vidéo |
| **Risque prod #1** | Coût / clés FAL-Replicate |

### 5. Dual lane Social / Premium

| | |
|---|---|
| **Statut** | Partial (logic 80 %, UX 20 %) |
| **Verdict** | **Refaire UX** — P0 |
| **Fichiers** | `premium-content.ts`, `safety-soften.ts`, `photo-params.tsx`, `ai-image.service.ts` |
| **Complete** | `getSocialPhotoDefaults`, `getPremiumPhotoDefaults`, premium-flux-router, modération |
| **Partial** | Sélecteur lane non visible sur page photo principale ; gating `hasNsfw` UI-only |
| **Broken** | — |
| **Tests** | `premium-content.test.ts`, `safety-soften.test.ts` |
| **Risque prod #1** | Together + Sightengine requis Premium prod |

### 6. Trends / Apify

| | |
|---|---|
| **Statut** | Partial → architecture complete (75 %) |
| **Verdict** | **Finir** |
| **Fichiers** | `trends.service.ts`, `trend-provider.ts`, cron `fetch-trends` |
| **Complete** | Provider chain, personalize LLM, apply → photo/reel, analyze format |
| **Partial** | Sans `APIFY_TOKEN` → Curated fallback ; trend → calendrier sans draft auto |
| **Broken** | — |
| **Tests** | **Bon** — `trends.service.test.ts`, `trend-provider.test.ts` |
| **Risque prod #1** | Vérifier `providerId: "apify"` en prod |

### 7. Calendar / scheduling

| | |
|---|---|
| **Statut** | Partial (70 %) |
| **Verdict** | **Finir** (hors P0/P1) |
| **Fichiers** | `calendar/page.tsx`, `scheduler.service.ts`, `publish.ts`, `calendar-agent.service.ts` |
| **Complete** | Vues mois/semaine/liste, schedule, cron publish, agent plan |
| **Partial** | Batch PHOTO only ; pas validation lot S5 ; modal force IG |
| **Broken** | — |
| **Tests** | Scheduler, batch, smart-scheduler OK |
| **Risque prod #1** | Pas BullMQ — cron simple |

### 8. Publish Instagram / TikTok

| | |
|---|---|
| **Statut** | Partial (IG 75 %, TikTok 40 %) |
| **Verdict** | **Finir IG** (hors P0/P1) |
| **Fichiers** | `instagram.service.ts`, `publisher.service.ts`, `tiktok.service.ts` |
| **Complete** | IG OAuth + publish photo/reel + refresh token |
| **Partial** | TikTok backend OK, UI « Bientôt » ; preview pré-publish S3 ouvert |
| **Broken** | — |
| **Tests** | `publisher.service.test.ts` mocké |
| **Risque prod #1** | App Review Meta |

### 9. Voix / TTS

| | |
|---|---|
| **Statut** | Partial (50 %) |
| **Verdict** | **Finir** (backlog post-P1) |
| **Fichiers** | `ai-speech.service.ts`, `reel-audio-panel.tsx` |
| **Complete** | Kokoro TTS, panneau 3 modes, lip-sync hook |
| **Partial** | Pas de voix persistée par influenceuse ; UI FR only |
| **Broken** | — |
| **Tests** | Minimal (2 tests config) |
| **Risque prod #1** | Replicate only |

### 10. Identity pack

| | |
|---|---|
| **Statut** | Partial (70 %) |
| **Verdict** | **Finir** (consommé, pas bloquant P0) |
| **Fichiers** | `identity-pack.service.ts`, `identity-pack.ts` |
| **Complete** | 4 refs Kontext, gratuit création SFW, sélection refs par pose |
| **Partial** | Async fail silent ; timeout wizard 120s ; N/A Premium |
| **Broken** | — |
| **Tests** | `identity-pack.test.ts` lib only |
| **Risque prod #1** | Pack incomplet non bloquant création |

---

## Checks Apify prod

Variables attendues (`.env.example` L198+) :

```env
APIFY_TOKEN=...
TRENDS_PROVIDER=apify          # optionnel, auto si token présent
APIFY_TIKTOK_VIDEO_ACTOR=...
APIFY_INSTAGRAM_ACTOR=...
```

**Signes Curated (fallback)** :
- `externalId` préfixé `curated-`
- Thumbnails Unsplash génériques
- Pas d'`embedUrl` TikTok/IG réels

**Validation** :
1. Logs cron `/api/cron/fetch-trends` → `provider: apify`
2. DB `TrendItem.providerId = "apify"`
3. Cartes trends avec vidéos embeddables

---

## Priorisation post-audit

| Priorité | Scope | Statut plan |
|----------|-------|-------------|
| **P0** | Dual lane UX + agent unifié + intent + gating serveur | En cours |
| **P1** | Apparence v2 Sims + iPhone + agent étape 2 + extended body | En cours |
| **P2** | Instagram publish UX, trend → draft, reels v2 | Backlog |
| **P3** | Voix persona, TikTok UI, agent 30j | Backlog |

---

## Transversal

- ~343 tests Vitest unitaires ; pas E2E Playwright commité
- Pas de workers BullMQ
- `BETA_HIDE_PAYMENTS=true` volontaire
- Agents trends/photo unifiés = stubs à remplacer (P0)

*Audit produit — juin 2026*
