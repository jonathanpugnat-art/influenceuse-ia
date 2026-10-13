# Ce qui marche chez eux → ce qu'on reproduit (clean-room)

Classé par impact pour Ofmia. « Reproduire » = le **pattern** (structure, promesse, ordre),
réécrit dans notre voix FR + esthétique Phosphor console. Jamais leurs mots/visuels/chiffres.

## 1. Une vraie landing publique (le plus gros levier)
**Constat :** Higgsfield, Influencer Studio et The Influencer AI ont tous une landing de
conversion dense. **Ofmia n'en a aucune** — le `/` est derrière l'auth, un prospect déconnecté
est renvoyé direct sur `/connexion`. On perd 100 % du trafic froid.
**Reproduire :** page publique qui enchaîne hero → boucle 3 étapes → consistance → showcase →
breakout reels → comparatif/ROI → pricing → FAQ → CTA. CTA primaire unique et répété :
« Créer mon influenceuse ».

## 2. La boucle « trouve ce qui marche → refais-le → publie »
**Constat :** c'est LE message central d'Influencer Studio (« Find what works. Re-make it. Post
it. ») et de The Influencer AI (breakout reels recréés en ~2 min). Ça vend parce que ça retire
l'angoisse de « quoi poster ».
**Reproduire :** on l'a déjà dans le produit (`/tendances` → **Refaire** → `/contenu`). On le
raconte tel quel sur la landing, et on pointe le CTA de l'étape 1 vers `/tendances`.

## 3. Consistance du visage comme argument n°1
**Constat :** « One persona. Infinite content. », « same face every prompt » — tout le monde
martèle que les autres changent de visage, pas eux.
**Reproduire :** c'est notre promesse native (« visage verrouillé »). Section dédiée : un visage,
des dizaines de posts, droits commerciaux à toi.

## 4. Showcase en onglets des formats qui marchent
**Constat :** The Influencer AI montre Photos/Vidéos/Edit/Try-on/Motion en onglets ; Higgsfield
une galerie de presets avec « Recreate ».
**Reproduire :** onglets de nos `FORMATS` réels (POV, GRWM, Journée, Confession, Avant/après)
avec la raison (« reach ») de chacun, chaque onglet → `/contenu?format=…`.

## 5. Scoring « outlier / viral » sur les reels (produit)
**Constat :** Influencer Studio met un badge « 12.4× » (bat la moyenne du créateur) + « Viral
5/5 ». C'est ce qui rend le feed de tendances crédible et actionnable.
**Reproduire :** sur `/tendances`, afficher un multiplicateur quand on peut l'inférer (plays vs
médiane du hashtag/créateur). À défaut de donnée fiable → ne pas inventer, afficher juste les vues.

## 6. Prix + essai gratuit lisibles
**Constat :** 3–4 tiers, un tag « Most Popular », essai gratuit + crédits offerts bien visibles,
badge Stripe.
**Reproduire :** teaser pricing avec nos vrais prix (Découverte 0 € / 30 cr, Starter 29 €,
Creator 79 € — « le plus choisi », Agence 199 €). Mettre en avant le plan Découverte gratuit.
Détail complet → `/facturation`.

## 7. FAQ dense (SEO + objections)
**Constat :** Influencer Studio aligne 20+ Q/R bourrées de mots-clés ; The Influencer AI traite
droits commerciaux, légalité, « ça coûte combien ».
**Reproduire :** FAQ FR honnête : c'est quoi, consistance, prix, droits, légalité/consentement.

## Garde-fous
- Zéro stat inventée (créateurs, pays, posts générés) → slot `TODO` tant que le chiffre n'est pas réel.
- Pas de nom/visuel/texte concurrent. Nos propres visages (locked) uniquement.
- Rester dans le design system (`globals.css` : `btn`, `panel`, `bezel`, `veil`, `tabular`, `font-display`).
