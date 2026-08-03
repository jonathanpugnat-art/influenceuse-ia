# Premium — unit economics & seuil self-host

Script : `npm run estimate:api-costs` (ou `tsx scripts/estimate-api-costs.ts --days 30`)

## Coûts API de référence (USD)

| Action | Coût estimé | Notes |
|--------|-------------|--------|
| Photo Social (Nano) | ~$0,035 | Filtre provider |
| Photo Premium (Replicate uncensored) | ~$0,056 | Modèle community (aisha…) |
| Photo Premium (self-host GPU) | ~$0,025 | GPU bien utilisé (~18 img/h @ $0,45/h) |
| Reel (Kling) | ~$0,35 | **Principal risque marge** |
| Portrait wizard (4 variants) | ~$0,12 | BASE_IMAGE job |
| Sightengine (si activé) | +$0,002 | Désactiver en Premium : `PREMIUM_IMAGE_MODERATION=off` |

## Revenu par crédit (EUR)

| Source | € / crédit | Commentaire |
|--------|------------|-------------|
| Pro (79 € / 1500 cr) | **5,3 c€** | Marge fine sur photos Premium |
| Agency (199 € / 5000 cr) | **4,0 c€** | Gros volume, marge serrée |
| Pack medium (39 € / 500 cr) | **7,8 c€** | **Meilleure marge** — pousser en upsell |

## Seuil self-host (RunPod + ComfyUI)

Hypothèses par défaut :

- GPU ~**$0,45/h** (4090 spot RunPod)
- **~18 images/heure** sustained
- Coût self-host ≈ **$0,025/image**
- Replicate Premium ≈ **$0,056/image**
- Économie ≈ **$0,031/image**

| Photos Premium / mois | Recommandation |
|----------------------|----------------|
| **< 250** | **Replicate** — zéro infra, pay-per-use |
| **250 – 400** | Zone grise — Replicate sauf si tu maîtrises déjà ComfyUI |
| **> 400** | **Self-host** — économie ~$12+/mois, monte en charge |

Formule :

```
seuil = coût_fixe_GPU_mensuel / (coût_Replicate - coût_GPU_par_image)
```

Sans coût fixe (pod à la demande) : dès que le volume Premium est régulier, le self-host est **plus rentable par image** — le frein est le **temps ops**, pas l’argent.

## Règles produit (marge)

1. NSFW réservé **Pro+** (79 €) — déjà en place.
2. **Ne pas** baisser REEL = 8 crédits.
3. `PREMIUM_IMAGE_MODERATION=off` en prod Premium.
4. Fin bêta : repasser Free à **50 crédits** (pas 500).
5. Upsell **packs crédits** aux users OF intensifs.

## Décision rapide

```
Peu de clients Pro ?
  → Replicate + DeepSeek, PREMIUM_IMAGE_MODERATION=off

> ~300 photos Premium / mois (voir script) ?
  → RunPod + PREMIUM_SELFHOST_URL

Tu veux Pony / Civitai qualité max ?
  → Self-host — après le seuil volume, pas avant
```
