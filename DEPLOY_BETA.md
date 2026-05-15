# Déploiement bêta v0.11 sur Vercel

Ce guide te permet de pousser la bêta en production en ~30 min. La bêta
est **fermée** : seules les emails que tu invites depuis `/admin/waitlist`
peuvent s'inscrire (grâce à `BETA_REQUIRE_INVITE=true`).

---

## 1. Pré-requis (services à avoir)

| Service | Pourquoi | Où s'inscrire |
|---|---|---|
| **Vercel** | Hosting Next.js + cron | https://vercel.com |
| **Postgres prod** | DB principale (Neon, Supabase, Railway…) | https://neon.tech (free tier suffisant) |
| **Clerk** | Auth + invitations email | https://clerk.com |
| **Stripe** | Paiements (déjà fait) | https://stripe.com |
| **Replicate** | Génération image/vidéo | https://replicate.com |
| **DeepSeek** | Génération texte | https://deepseek.com |
| **Cloudflare R2** | Stockage images générées | https://dash.cloudflare.com |
| **Anthropic** *(optionnel)* | Fallback texte | https://console.anthropic.com |

---

## 2. Setup base de données (Neon recommandé, free)

```bash
# 1. Créer un projet Neon sur https://console.neon.tech
# 2. Copier la connection string "Pooled connection" (PgBouncer)
# 3. La coller dans Vercel comme DATABASE_URL
# 4. Appliquer les migrations depuis ton terminal local :

DATABASE_URL="<neon-pooled-url>" npx prisma migrate deploy
```

> **Note** : Neon a un free tier généreux (~500 Mo, autosuspend). Pour la
> bêta c'est largement suffisant.

---

## 3. Setup Clerk (mode production)

1. https://dashboard.clerk.com → **Create production instance**
2. Récupérer :
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (commence par `pk_live_…`)
   - `CLERK_SECRET_KEY` (commence par `sk_live_…`)
3. **Webhooks** → "+ Add Endpoint" :
   - URL : `https://<TON-DOMAINE>/api/webhooks/clerk`
   - Events : `user.created`, `user.updated`, `user.deleted`
   - Copier le signing secret → `CLERK_WEBHOOK_SIGNING_SECRET`
4. **Restrictions** (recommandé pour la bêta) :
   - Cocher "Allowlist mode" et n'ajouter aucun domaine
     → seuls les invités par email (avec lien d'invitation) peuvent
     s'inscrire. Notre webhook applique la même règle côté waitlist,
     donc Clerk Allowlist est une seconde ceinture de sécurité.

---

## 4. Variables d'environnement Vercel

Sur Vercel → ton projet → **Settings → Environment Variables**.
Copie ces 30 vars (sépare bien Production / Preview / Development) :

### Obligatoires

```env
# DB
DATABASE_URL=postgresql://...?pgbouncer=true

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/fr/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/fr/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/fr
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/fr

# App
NEXT_PUBLIC_APP_URL=https://<TON-DOMAINE>
ENCRYPTION_SECRET=<32-bytes-base64>     # openssl rand -base64 32
CRON_SECRET=<random-32+chars>           # openssl rand -hex 32

# Closed beta gating
BETA_REQUIRE_INVITE=true
ADMIN_EMAILS=jonathanpugnat@gmail.com   # ton email = admin

# IA
DEEPSEEK_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_1Sk5SWJyqJordrOMUfO0ZRPv
STRIPE_PRO_PRICE_ID=price_1Sk5SXJyqJordrOMX0BoztAh
STRIPE_ENTERPRISE_PRICE_ID=price_1Sk5SYJyqJordrOMZTEK4x8a
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_1Sk5SWJyqJordrOMUfO0ZRPv
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_1Sk5SXJyqJordrOMX0BoztAh
NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID=price_1Sk5SYJyqJordrOMZTEK4x8a

# Cloudflare R2
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=influenceuse-prod
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://media.<TON-DOMAINE>   # CDN R2 (à configurer)
```

### Optionnelles mais recommandées

```env
ANTHROPIC_API_KEY=sk-ant-...     # fallback texte (plus fidèle au JSON)

# Auto-publication Instagram (nécessaire seulement si tu veux activer
# le bouton "Publier maintenant" sur Instagram dans la bêta)
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=

# Auto-publication TikTok
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
```

> **Sans ces credentials sociaux** : le bouton "Publier maintenant" est
> grisé et un banner jaune indique "Connecter Instagram d'abord" — c'est
> le comportement attendu pour la bêta (la pré-flight check le détecte
> et l'affiche, voir `v0.11.4 - Auto-publish hardening`).

---

## 5. Webhooks Stripe (à recréer pour la prod)

1. https://dashboard.stripe.com/webhooks → "+ Add endpoint"
2. URL : `https://<TON-DOMAINE>/api/webhooks/stripe`
3. Events : `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_succeeded`, `invoice.payment_failed`
4. Copier le signing secret → `STRIPE_WEBHOOK_SECRET` sur Vercel

---

## 6. Domaine custom

1. Sur Vercel → ton projet → **Settings → Domains**
2. Ajouter ton domaine principal → Vercel te donne les enregistrements
   DNS (A + CNAME) à mettre chez ton registrar
3. Une fois validé, **redéployer** pour que `NEXT_PUBLIC_APP_URL`
   pointe vers le bon hostname

---

## 7. Crons Vercel

Le projet utilise des crons (analytics, batches, retry webhooks).
**Vercel les détecte automatiquement** depuis `vercel.json` au déploiement.
Vérifie sur **Settings → Cron Jobs** qu'ils sont activés. Ils utilisent
`CRON_SECRET` pour s'authentifier.

---

## 8. Premier déploiement

```bash
# Option A : via dashboard Vercel
# - "Import Project" → choisir le repo GitHub
# - Branch: cursor/platform-v0-11-landing-pricing-stripe (puis main)
# - Framework: Next.js (auto-détecté)
# - Build command: prisma migrate deploy && next build
# - Output: .next

# Option B : via CLI
vercel link
vercel --prod
```

> **IMPORTANT** : la commande de build doit être
> `prisma migrate deploy && next build`
> pour que les migrations (waitlist + toutes les précédentes) soient
> appliquées avant que le code ne tape la DB.

Configure ça dans **Settings → Build & Development Settings** :
- Build Command : `npx prisma migrate deploy && npx next build`

---

## 9. Workflow bêta (ce que tu vas faire ensuite)

1. **Visiteur arrive** sur ta landing → voit le hero "Bêta fermée" + formulaire
2. **Visiteur s'inscrit** sur la waitlist → row `PENDING` dans la DB
3. **Toi** : tu vas sur `/fr/admin/waitlist` (connecté avec ton compte
   admin) → tu vois la liste
4. Tu cliques **Inviter** sur un email → Clerk envoie l'invitation
   email automatiquement → row passe à `INVITED`
5. L'invité clique le lien dans son email → atterrit sur `/sign-up`
   → se crée un compte
6. Webhook `user.created` vérifie : email dans waitlist en `INVITED`
   → autorisé → row passe à `SIGNED_UP`
7. Si quelqu'un essaie de s'inscrire **sans invitation** : son compte
   Clerk est immédiatement supprimé (silencieux), pas de row `User`
   créée

---

## 10. Quand tu seras prêt à ouvrir la bêta au public

C'est juste **une variable d'environnement à changer** :

```env
BETA_REQUIRE_INVITE=false
```

Et tu remplaces le `<WaitlistForm>` sur la landing par un bouton
`/sign-up` classique (1 ligne à éditer dans `src/app/[locale]/page.tsx`).

---

## 11. Checklist post-déploiement

- [ ] `https://<TON-DOMAINE>` charge la landing
- [ ] `https://<TON-DOMAINE>/api/health` renvoie `{ status: "ok",
       autoPublish: { ready: true } }`
- [ ] `POST /api/waitlist` accepte un email de test
- [ ] Connecté en admin, `/fr/admin/waitlist` affiche la liste
- [ ] Le bouton "Inviter" envoie bien l'email Clerk de test
- [ ] L'invité peut s'inscrire ; un non-invité voit "no such account"
- [ ] Webhook Stripe testé via `stripe trigger checkout.session.completed`
- [ ] Crons Vercel listés dans Settings → Cron Jobs

---

## 12. Surveillance pendant la bêta

| Métrique | Où | Seuil d'alerte |
|---|---|---|
| Inscrits / jour | `/admin/waitlist` (compteur SIGNED_UP) | — |
| Erreurs runtime | Vercel → Logs / Errors | > 5 / heure |
| Coût Replicate | https://replicate.com/account/billing | > 30 $ / jour |
| Crédits Stripe | https://dashboard.stripe.com | — |
| Latence DB | Neon dashboard | > 200 ms p95 |

Bonne bêta. 🚀
