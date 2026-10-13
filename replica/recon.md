# Recon map — concurrents « AI influencer »

> Produit par le skill `replica-recon`. On reconstruit **des patterns de conversion et de
> flow (UX), en clean-room** : jamais le code, les logos, les textes ou les visuels d'un
> concurrent. Sources publiques uniquement. Captures = référence, jamais shippées.

- **Notre produit (la cible) :** Ofmia — SaaS pour managers OFM qui créent des influenceuses IA.
  Boucle : visage verrouillé → niche → posts Instagram → download. Esthétique « Phosphor console »
  (dark + accent lime), FR.
- **Slice étudiée :** (1) landing / conversion publique, (2) flow produit décrit publiquement.
- **Date recon :** 2026-10-12.

## Step 1 — scope

| Question | Réponse |
| --- | --- |
| Quelle app / plateforme | Web (SaaS), concurrents AI-influencer |
| Quelle slice | Landing de conversion + boucle produit « trouver ce qui marche → refaire avec son visage → publier » |
| Pour qui | Managers OFM / créateurs solo / brands qui veulent du contenu à volume, visage constant |

## Step 2 — sources (publiques)

| # | concurrent | source | URL | valeur |
| --- | --- | --- | --- | --- |
| 1 | Higgsfield | home | https://higgsfield.ai/ | positionnement « hype machine », marketplace de modèles, presets « Recreate » |
| 2 | Higgsfield | pricing | https://higgsfield.ai/pricing | tiers + unlimited promo + quiz « find the best plan » + grosse table compare + FAQ crédits |
| 3 | Higgsfield | AI Influencer | https://higgsfield.ai/ai-influencer-studio | « Pick the look. Add motion. Build hype. » |
| 4 | Influencer Studio | home | https://influencerstudio.com/ | boucle « Find what works → Re-make it → Post it », scoring viral/outlier, 4 étapes |
| 5 | Influencer Studio | pricing | https://influencerstudio.com/pricing | crédits, rollover x3, « which plan should I choose », grille de features |
| 6 | Influencer Studio | features | https://influencerstudio.com/features/ai-influencer-generator | LoRA, consistance, comparo vs « general AI art tool » |
| 7 | The Influencer AI | home | https://www.theinfluencer.ai/ | la landing de conversion la plus complète (voir winners) |
| 8 | The Influencer AI | pricing | section #pricing | 4 tiers, « Most Popular », essai 3 j + 10 crédits, badge Stripe |
| 9 | DeepAgency | home | https://www.deepagency.com/ | **signal faible** : closed beta, « redefining product » → écarté |

## Step 3 — inventaire d'écrans (références concurrents)

IDs stables (`S0x`). Servent à mapper vers nos écrans Ofmia.

| ID | écran | où | but | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S01 | Landing hero | `/` | promesse + CTA + preuve | claim gras, sous-copy, CTA primaire, micro-proof, 2 portraits | desktop, mobile |
| S02 | Boucle 3 étapes | home | expliquer le workflow | timeline numérotée, mock cartes « trending / your influencer / analytics » | — |
| S03 | Showcase outils (tabs) | home | montrer la largeur | onglets Photos/Vidéos/Edit/Try-on/Motion, panneau prompt + output | — |
| S04 | Consistance persona | home | argument #1 (même visage) | grille d'un même visage en 6 scènes, 3 ✓ (locked / batch / rights) | — |
| S05 | Breakout reels recreated | home | « jamais quoi poster » | reel source + recréation, badge « 6× la moyenne », 3 sous-étapes | New badge |
| S06 | Slop vs no-slop | home | qualité modèles | 2 colonnes ✗ / ✓ | — |
| S07 | Comparatif vs concurrents | home | différenciation | table capacité × (— / ✓) | — |
| S08 | ROI / coût | home | lever le prix | « 19$ vs 500–5000$ », « 5 min vs 5 semaines » | — |
| S09 | Earning potential | home | désir (gagner de l'argent) | Aitana Lopez €10k/mois, brand deals, affiliate 25% | — |
| S10 | Preuve sociale | home | confiance | testimonials visage, « Featured in », bande de stats | — |
| S11 | Pricing | `/pricing` ou #pricing | convertir | 3–4 tiers, « Most Popular », crédits, essai gratuit, badge paiement | mensuel/annuel |
| S12 | FAQ | home / pricing | SEO + objections | accordéon dense | — |
| S13 | CTA final | home | dernier push | bande + CTA | — |
| S14 | Trends feed (produit) | in-app (décrit) | trouver les hits | cartes reels + score outlier/viral + « Recreate » | — |

## Step 4 — user flows (boucle commune)

```
F01 Boucle de contenu (le cœur, ce que tout le monde vend)
    Trouver un format/reel qui marche  ->  Le refaire avec SON influenceuse (visage constant)
    ->  Générer image/vidéo  ->  (caption/hashtags)  ->  Publier / planifier / télécharger
    edge: pas de persona encore -> onboarding ; crédits épuisés -> upsell ; export sans publication
```

- **Influencer Studio :** Find trending → Copy with your influencer → Post + track (3 étapes) ; variante 4 étapes « Build cast → Make content → Caption → Schedule ».
- **The Influencer AI :** 2 points d'entrée persona — **Builder** (traits, sans photo) **ou AI Clone** (1–4 photos). Puis Photos / Vidéos / Edit / Try-on / Motion. Puis « breakout reels recreated » (coller un lien reel → recréation 1 clic ~2 min).
- **Higgsfield :** galerie de presets/effets avec bouton **Recreate** → éditeur ; marketplace de modèles.

**Ofmia aujourd'hui (déjà aligné !) :** `/creer` (visage + niche) → `/tendances` (scrape hashtag → **Refaire**) ou **Formats qui marchent** (POV, GRWM, Journée, Confession, Avant/après) → `/contenu` (post-creator) → download. La boucle produit **existe déjà** et colle au pattern gagnant.

## Step 5 — composants récurrents (chez les concurrents)

Boutons CTA répétés (toujours la même action : « Create / Start free »), onglets de showcase, cartes
média 9:16, **badges de score** (outlier « 12.4× », viral « 5/5 »), tables de comparaison, accordéon FAQ,
bande de logos « Featured in », bande de stats, cartes de pricing avec tag « Most Popular / Best value ».

## Step 6 — modèle de données inféré (côté nous, déjà en place)

`Character(face locked, niche)` · `Trend(hashtag, reels[])` · `Reel(url, thumbnail, plays, owner, caption)`
· `Format(id, label, reach, shot, angle)` · `Credits(ledger, post=1, video=10)` · `Plan/Pack`.
→ Rien à inventer : le schéma Ofmia couvre déjà la boucle. Manque surtout un champ « multiplicateur
d'outlier » (plays vs médiane du créateur) pour reproduire le scoring viral — **inférable**, pas garanti.

## Step 7 — feature matrix

Voir `replica/features.csv`.

## Step 8 — ce qu'on NE clone pas

- Les **modèles** propriétaires / marques de modèles (Seedance, Kling, Nano Banana…) : on garde notre pipeline Replicate.
- Les **textes, visuels, logos** des concurrents.
- Les **chiffres de preuve sociale** : on n'invente aucune stat. Tout chiffre affiché doit être réel (sinon slot `TODO`).
- Le **multi-compte publishing / scheduling natif** (Influencer Studio) : hors scope v1, download suffit.

## Step 9 — taille

- Reproduire la **landing de conversion** : **S** (une page, composants existants réutilisés).
- Reproduire le **scoring outlier** sur `/tendances` : **S/M** (dépend de la donnée dispo côté scraper).
- Boucle produit : **déjà là** — polish seulement.

## Sortie / next

Boucle cœur = « trouve ce qui marche → refais-le avec ton visage → publie ». Ofmia a déjà la boucle
produit mais **aucune landing publique** (tout est derrière l'auth). Les 3 plus gros leviers sont dans
`replica/winners.md`. Next step du pack : `/replica-build` (ici : construire la landing).
