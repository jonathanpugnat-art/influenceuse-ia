# Déploiement bêta v0.11 sur Vercel

Ce guide te permet de pousser l'app en production en ~30 min.

**Mode par défaut : sign-up ouvert.** N'importe qui peut s'inscrire
depuis `/sign-up`. Le système d'invitation/waitlist reste **disponible
en réserve** : table `WaitlistEntry`, endpoint `POST /api/waitlist`,
admin dashboard `/admin/waitlist`, garde webhook Clerk — tout ça reste
inactif tant que tu ne flip pas `BETA_REQUIRE_INVITE=true`.

Tu peux fermer la bêta en une variable d'env si jamais un Reddit/Twitter
te ramène trop de monde d'un coup et que les coûts Replicate dérapent.

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
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/fr/influencers
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/fr/influencers

# App
NEXT_PUBLIC_APP_URL=https://<TON-DOMAINE>
ENCRYPTION_SECRET=<32-bytes-base64>     # openssl rand -base64 32
CRON_SECRET=<random-32+chars>           # openssl rand -hex 32

# Beta gating (laisser false = sign-up ouvert à tous)
# Flip à "true" si tu veux fermer la bêta aux seuls invités via
# /admin/waitlist (utile en cas de pic de trafic non maîtrisé).
BETA_REQUIRE_INVITE=false
ADMIN_EMAILS=jonathanpugnat@gmail.com   # ton email = admin (accès /admin/*)

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

# Premium / OnlyFans lane (Pro plan)
TOGETHER_API_KEY=              # https://api.together.xyz — FLUX open source
PREMIUM_IMAGE_PROVIDER=auto
SIGHTENGINE_API_USER=          # Modération anti-porno post-génération
SIGHTENGINE_API_SECRET=
PREMIUM_IMAGE_MODERATION=auto

# Voir docs/PROD_CHECKLIST.md pour la checklist complète prod
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

## 9. Workflow standard (mode ouvert, par défaut)

1. **Visiteur arrive** sur ta landing → clique "Démarrer gratuitement"
2. Atterrit sur `/sign-up` (Clerk) → crée son compte (email ou social)
3. Webhook `user.created` crée la row `User` en DB avec plan `FREE`
   (50 crédits offerts) → arrive sur le dashboard

C'est tout. Aucune action de ta part nécessaire.

---

## 10. Si tu veux fermer la bêta (mode invitation seule)

À utiliser **uniquement si** :
- Tu vois ton compteur Replicate dérailler (> 30 $/jour)
- Tu reçois trop de signups d'un coup (effet Reddit/HN/Twitter)
- Tu veux contrôler manuellement qui rentre pendant un sprint produit

**3 étapes** :

```env
# 1. Sur Vercel, changer la var d'env :
BETA_REQUIRE_INVITE=true
```

```tsx
// 2. (Optionnel) Remettre le formulaire waitlist sur la landing
//    pour récolter les emails au lieu de les laisser tomber.
//    Dans src/app/[locale]/page.tsx, remplacer le bouton
//    /sign-up du hero par :
import { WaitlistForm } from "@/components/landing/waitlist-form";
// …
<WaitlistForm source="hero" variant="hero" />
```

```
# 3. Aller sur /fr/admin/waitlist pour inviter au compte-gouttes
```

Quand `BETA_REQUIRE_INVITE=true` :
- Webhook `user.created` rejette toute signup dont l'email n'est pas
  en statut `INVITED` dans la table waitlist (supprime le compte
  Clerk créé, ne crée pas la row `User`)
- Tu invites depuis `/admin/waitlist` → Clerk envoie un mail
  d'invitation → l'invité clique → arrive sur `/sign-up` → s'inscrit
  normalement → row waitlist passe à `SIGNED_UP`

Pour rouvrir : flip `BETA_REQUIRE_INVITE=false`. C'est instantané, pas
de redéploiement nécessaire (Vercel pick up les env vars au prochain
cold-start, ou tu peux forcer un redeploy si tu veux que ce soit
immédiat).

---

## 11. Checklist post-déploiement

- [ ] `https://<TON-DOMAINE>` charge la landing
- [ ] `https://<TON-DOMAINE>/api/health` renvoie `{ status: "ok",
       autoPublish: { ready: true } }`
- [ ] Tu peux te sign-up depuis `/fr/sign-up` → tu arrives au dashboard
       avec 50 crédits FREE
- [ ] Connecté en admin, `/fr/admin/waitlist` est accessible (la liste
       sera vide, c'est normal)
- [ ] Webhook Stripe testé via `stripe trigger checkout.session.completed`
- [ ] Crons Vercel listés dans Settings → Cron Jobs
- [ ] (Si tu actives la gating plus tard) Un non-invité ne peut pas
       s'inscrire quand `BETA_REQUIRE_INVITE=true`

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
