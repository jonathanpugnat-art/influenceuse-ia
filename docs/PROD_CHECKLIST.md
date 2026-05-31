# Checklist production — Aura Influence AI

Ce document résume **tout ce qui a été mis en place** et **ce qu’il te reste à faire** pour que tout fonctionne en prod sur [aurainfluenceai.com](https://aurainfluenceai.com).

---

## 1. Récap des fonctionnalités déployées (code)

### Studio photo
| Feature | Statut |
|---------|--------|
| Scène libre en français + enrichissement LLM serveur | ✅ |
| Pose **Candid** par défaut (plus de selfie forcé) | ✅ |
| Selfie uniquement si angle Selfie ou mot « selfie/miroir » | ✅ |
| Props scène (bonbons, accessoires) conservés à l’enrichissement | ✅ |
| Expression **seductive** auto sur scènes sexy/sensuelles | ✅ |
| Bouton Générer grisé sans tenue + scène | ✅ |
| Layout studio 40/60, sidebar 3 piliers, mock IG | ✅ |

### Moteurs IA
| Usage | Provider |
|-------|----------|
| Photos social SFW (visage verrouillé) | Nano Banana → fallback Kontext |
| Scènes borderline (bikini, lingerie…) | Kontext Pro |
| Décor scene-first + wizard fallback | FAL FLUX → Replicate |
| Reels I2V | FAL Kling v3 → Replicate |
| **Premium / OnlyFans (hot suggestif)** | **Together FLUX → self-host → Replicate** + **filtre Sightengine** |

### Premium (lane « hot mais pas porno »)
- Niveaux autorisés : `suggestive` / `soft` uniquement (pas `explicit`)
- Filtre **entrée** : mots interdits (porno, nudité explicite, illégal)
- Filtre **génération** : negative prompt anti-explicite
- Filtre **sortie** : Sightengine nudity-2.0 (+ regen 1× si refus)
- Plan requis : **Pro** ou **Agency** (`hasNsfw: true`)

---

## 2. Variables d’environnement Vercel (obligatoires)

### Déjà en place (à vérifier)
```env
DATABASE_URL=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
NEXT_PUBLIC_APP_URL=https://aurainfluenceai.com
ENCRYPTION_SECRET=
CRON_SECRET=
DEEPSEEK_API_KEY=
REPLICATE_API_TOKEN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_*_PRICE_ID=...
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=          # URL publique HTTPS — obligatoire pour verrouillage visage
```

### Nouvelles variables Premium (à ajouter)
```env
# Together AI — lane Premium (prioritaire)
TOGETHER_API_KEY=           # https://api.together.xyz/settings/api-keys
PREMIUM_IMAGE_PROVIDER=auto # auto | together | selfhost | replicate

# Modération anti-porno (fortement recommandé en prod)
SIGHTENGINE_API_USER=       # https://sightengine.com
SIGHTENGINE_API_SECRET=
PREMIUM_IMAGE_MODERATION=auto
```

### Optionnelles mais utiles
```env
FAL_KEY=                    # FLUX T2I décor + Kling reels
IMAGE_T2I_PROVIDER=auto
VIDEO_I2V_PROVIDER=auto
TOGETHER_FLUX_MODEL=black-forest-labs/FLUX.2-dev
PREMIUM_SELFHOST_URL=       # Si tu self-hostes plus tard
PREMIUM_MODERATION_RAW_THRESHOLD=0.55
PREMIUM_MODERATION_PARTIAL_THRESHOLD=0.82
```

### Instagram OAuth (si pas encore fait)
```env
INSTAGRAM_OAUTH_MODE=instagram
INSTAGRAM_LOGIN_APP_ID=
INSTAGRAM_LOGIN_APP_SECRET=
```

---

## 3. Actions de ton côté (par priorité)

### P0 — Bloquant prod
- [ ] **Vercel** : ajouter `TOGETHER_API_KEY` + créer compte [Together AI](https://www.together.ai/)
- [ ] **Vercel** : ajouter `SIGHTENGINE_API_USER` + `SIGHTENGINE_API_SECRET` ([Sightengine](https://sightengine.com) — free tier pour tester)
- [ ] **Vercel** : vérifier `R2_PUBLIC_URL` est une URL **HTTPS publique** (sinon verrouillage visage KO en prod)
- [ ] **Vercel** : redeploy après ajout des vars (Settings → Deployments → Redeploy)
- [ ] **Together** : vérifier que le modèle `black-forest-labs/FLUX.2-dev` est accessible sur ton compte (billing activé)

### P1 — Qualité photo social
- [ ] Tester une scène libre : `chambre rose, bonbons, regard sensuel` → angle **Candid** → pas de selfie miroir
- [ ] Tester bikini/lingerie en mode **Social** → doit passer par Kontext si Nano bloque
- [ ] Hard refresh (Cmd+Shift+R) après chaque deploy

### P2 — Lane Premium (Pro)
- [ ] Passer un compte test en plan **Pro** (Stripe test ou prod)
- [ ] Studio photo → Options avancées → mode **Premium / OnlyFans**
- [ ] Générer lingerie boudoir → doit être suggestif, **pas** nudité explicite
- [ ] Si refus modération : reformuler (message utilisateur clair)

### P3 — Business / légal
- [ ] CGU : mentionner contenu synthétique + interdiction contenu illégal/explicite
- [ ] Stripe : documenter que Premium = suggestif modéré (pas porno hardcore)
- [ ] `BETA_HIDE_PAYMENTS` → passer à `false` quand tu ouvres les paiements live

### P4 — Self-host (plus tard, optionnel)
- [ ] Déployer un handler GPU (RunPod / Modal / ComfyUI) qui accepte :
  ```json
  POST {PREMIUM_SELFHOST_URL}
  { "prompt", "negative_prompt", "width", "height", "steps", "guidance_scale", "seed" }
  → { "url": "https://..." }
  ```
- [ ] Vercel : `PREMIUM_SELFHOST_URL=https://...` + `PREMIUM_IMAGE_PROVIDER=auto`

### P5 — Instagram / TikTok
- [ ] Meta Developer : app Instagram Login + redirect URI prod
- [ ] TikTok Developer : Content Posting API + redirect URI prod
- [ ] Vérifier domaine R2 dans Meta/TikTok URL ownership

---

## 4. Tests manuels rapides (5 min)

| Test | Attendu |
|------|---------|
| Photo social, scène « café parisien » | Candid, pas selfie |
| Photo social + « bonbons » | Bonbons visibles |
| Photo social sexy sans Premium | Suggestif SFW, pas blocage brutal |
| Photo Premium Pro + lingerie | Hot suggestif, pas nudité |
| Prompt Premium « nude explicit » | Refus avant génération |
| Reel preset standard | Kling via FAL ou Replicate |

---

## 5. Coûts estimés par génération

| Action | Coût API approx. |
|--------|------------------|
| Photo social (Nano) | ~$0.03 |
| Photo Premium (Together FLUX.2-dev) | ~$0.02–0.05 |
| Modération Sightengine | ~$0.002 / image |
| Reel (Kling) | ~$0.25–0.55 |

---

## 6. Dépannage

| Symptôme | Cause probable | Fix |
|----------|----------------|-----|
| Selfie miroir non demandé | Cache navigateur | Hard refresh |
| « Replicate ne peut pas lire localhost » | Dev local sans R2 | Désactiver verrouillage visage ou config R2 |
| Premium toujours sur Replicate | `TOGETHER_API_KEY` manquant | Ajouter la clé Vercel |
| Premium sans filtre image | Sightengine absent | Ajouter clés Sightengine |
| Génération Premium refusée | Image trop explicite | Reformuler boudoir suggestif |
| Instagram « APP_ID non configuré » | OAuth Meta absent | Vars § Instagram |

---

## 7. Architecture Premium (résumé)

```
Prompt FR → enrichissement LLM → garde-fou mots interdits
    → Together FLUX.2-dev (ou self-host / Replicate fallback)
    → Sightengine nudity-2.0
    → OK → upload R2 → affichage
    → KO → regen 1× prompt adouci → sinon erreur utilisateur
```

---

*Dernière mise à jour : mai 2026 — commits récents sur `main` (selfie/candy fix + Premium Together/Sightengine).*
