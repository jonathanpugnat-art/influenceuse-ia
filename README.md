# Influenceuse IA

> **Plateforme SaaS de création et gestion d'influenceur·ses IA virtuelles** : génération de photos & reels cohérents, planning multi-plateformes (Instagram, TikTok, OnlyFans), analytics avancées, mode agence et API publique.

[![Tests](https://img.shields.io/badge/tests-116%20passing-success)](#tests) [![Build](https://img.shields.io/badge/build-passing-success)](#build) [![Stack](https://img.shields.io/badge/stack-Next.js%2016%20·%20tRPC%2011%20·%20Prisma%207-violet)](#stack)

---

## Stack

- **Frontend** : Next.js 16 (App Router) · React 19 · Tailwind 4 · shadcn/ui · Framer Motion
- **Backend** : tRPC 11 · Prisma 7.4 · PostgreSQL 16 · Redis (queue)
- **Auth** : Clerk
- **Billing** : Stripe (subscriptions + add-on credit packs)
- **AI** :
  - Texte : DeepSeek (`deepseek-chat`) + Anthropic (`claude-sonnet-4-5`) en fallback
  - Image : Replicate Flux 1.1 Pro (avec IP-Adapter pour cohérence faciale)
  - Vidéo : router multi-modèles — MiniMax, Kling 2.0, Wan 2.5 I2V, Runway Gen-4
- **Storage** : Cloudflare R2 (S3-compatible)
- **i18n** : next-intl (FR/EN)
- **Tests** : Vitest

---

## Quick start

### Prérequis

- Node.js 22+
- pnpm 10+
- Docker (pour PostgreSQL local)

### Installation

```bash
pnpm install
cp .env.example .env
# Renseigner les clés (voir section "Variables d'environnement")
docker compose up -d                # PostgreSQL + Redis
pnpm prisma migrate deploy          # Créer / migrer la BDD
pnpm prisma generate                # Générer le client Prisma
pnpm dev
```

L'app est disponible sur [http://localhost:3000](http://localhost:3000).

---

## Variables d'environnement

Copier `.env.example` → `.env` et renseigner :

| Variable | Description | Obligatoire |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string | ✅ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Auth Clerk | ✅ |
| `DEEPSEEK_API_KEY` | Génération texte (par défaut) | ✅ |
| `ANTHROPIC_API_KEY` | Provider texte alternatif (plans / idées) | ⚠️ recommandé |
| `REPLICATE_API_TOKEN` | Génération images & vidéos | ✅ |
| `REPLICATE_VIDEO_MODEL` | Override global du modèle vidéo (optionnel) | ❌ |
| `REPLICATE_VIDEO_MODEL_STABLE_FACE` | Override par preset | ❌ |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing | ✅ |
| `STRIPE_PRO_PRICE_ID` / `STRIPE_ENTERPRISE_PRICE_ID` | Subscriptions | ✅ |
| `STRIPE_CREDIT_PACK_SMALL_PRICE_ID` (`_MEDIUM` / `_LARGE`) | Add-ons crédits Sprint 7 | ⚠️ |
| `R2_*` | Cloudflare R2 | ⚠️ (sinon fallback local) |
| `REDIS_URL` | File de jobs | ✅ |
| `CRON_SECRET` | Auth des endpoints cron | ✅ |
| `ENCRYPTION_SECRET` | Encryption des tokens sociaux | ✅ |

---

## Architecture

```
src/
├── app/
│   ├── [locale]/(dashboard)/   # Pages authentifiées (FR/EN)
│   ├── api/
│   │   ├── cron/               # Tâches planifiées (publish, batch, webhooks retry)
│   │   ├── public/v1/          # API publique B2B (Bearer auth)
│   │   └── webhooks/           # Stripe + Clerk + Sociaux
├── components/                 # UI (analytics, billing, calendar, content, …)
├── server/
│   ├── services/               # Logique métier (ai-image, ai-video, ai-text, batch,
│   │                           #  publisher, scheduler, webhook, onboarding,
│   │                           #  api-key, content-recycler, personality-memory…)
│   └── trpc/routers/           # 11 routers (influencer, content, publish, analytics,
│                               #  billing, webhook, onboarding, apiKeys, workspace,
│                               #  mediaLibrary, referral)
├── lib/
│   ├── prompts/                # Image, vidéo, caption, content-plan
│   └── templates/              # 22 personas pré-baked
└── messages/                   # Traductions FR + EN
```

---

## Public API (Sprint 9)

L'API publique permet aux clients B2B / agences d'automatiser la lecture/écriture depuis leurs outils (Zapier, n8n, scripts custom).

### Authentification

```
Authorization: Bearer iia_live_<prefix>.<random>
```

- Génère une clé via `Settings → API keys`. La clé en clair n'est affichée **qu'une seule fois**.
- Stockage : SHA-256 hash, jamais le plain.
- Rate limit : **60 req/min** par clé (rolling window 60s).

### Scopes

- `READ` — lecture seule
- `WRITE` — création/édition (à venir sur les endpoints d'écriture)
- `ADMIN` — accès complet, incluant gestion d'autres clés

### Endpoints disponibles

#### `GET /api/public/v1/influencers`

Retourne les influenceur·ses du compte authentifié.

```bash
curl https://app.influenceuse-ia.com/api/public/v1/influencers \
  -H "Authorization: Bearer iia_live_…"
```

Query params : `limit` (max 100), `status` (`ACTIVE` / `PAUSED` / `ARCHIVED`).

Réponse :

```json
{
  "data": [
    { "id": "cl…", "name": "Luna", "slug": "luna", "niche": "FITNESS", "status": "ACTIVE", "createdAt": "…" }
  ],
  "count": 1
}
```

### Codes d'erreur

| Code | Sens |
| --- | --- |
| `401` | Clé manquante / invalide / expirée |
| `403` | Scope insuffisant (manque `READ`/`ADMIN`) |
| `429` | Rate limit dépassé |
| `500` | Erreur serveur (loguée côté Sentry/Vercel) |

---

## Cron jobs

Configurés dans `vercel.json` :

| Endpoint | Fréquence | Rôle |
| --- | --- | --- |
| `/api/cron/publish` | toutes les 5 min | Publie le contenu `SCHEDULED` arrivé à échéance |
| `/api/cron/process-batches` | toutes les 10 min | Avance les batches `DRAFT → READY/SCHEDULED` |
| `/api/cron/retry-webhooks` | toutes les 15 min | Relance les webhooks `FAILED/RETRYING` avec backoff |

Tous protégés par `Authorization: Bearer $CRON_SECRET`.

---

## Tests

```bash
pnpm test                # Watch mode
pnpm test:run            # CI / one-shot
```

**116 tests** couvrent : prompts, services AI, batch processing, publisher idempotence, webhook signatures, onboarding, analytics, personality memory, API keys, recycler.

---

## Build

```bash
pnpm build               # Build prod (Turbopack)
pnpm start               # Run prod build
pnpm lint                # ESLint
```

---

## Plans tarifaires

| Plan | Prix | Influenceurs | Crédits / mois | Vidéos | Webhooks | API publique | Workspaces |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Free | 0€ | 1 | 50 | ❌ | ❌ | ❌ | ❌ |
| Creator | 9€ | 2 | 150 | ❌ | ❌ | ❌ | ❌ |
| Pro | 29€ | 5 | 500 | ✅ | ✅ | ✅ | ❌ |
| Agency | 99€ | ∞ | ∞ | ✅ | ✅ | ✅ | ✅ |

**Add-ons crédits** (achat unique) : Boost (100/9€), Pro (500/39€), Studio (1500/99€).

---

## Déploiement

L'app est conçue pour Vercel :

```bash
vercel --prod
```

Variables à configurer dans le dashboard Vercel :
- Toutes les variables listées ci-dessus.
- Désactiver `Vercel Authentication` (sinon les webhooks Stripe/Clerk échouent).
- Configurer les cron jobs (déjà déclarés dans `vercel.json`).

---

## Changelog

Voir [`CHANGELOG.md`](./CHANGELOG.md) pour l'historique complet des releases.

---

## Licence

Propriétaire — © 2026 Influenceuse IA. Tous droits réservés.
