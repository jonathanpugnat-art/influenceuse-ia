/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V4 */
/* hallmark audit · HEAD 8b28935 (PR #26) · genre déclaré: aucun · grading modern-minimal */
/* Do not edit UI. Phase 2 blocked. */

# AUDIT — Aura Influences

Lecture seule. Aucun changement visuel. Cible produit = `HEAD` (`8b28935`, merge PR #26). Le disque n’est pas ce produit.

## Blocker

- Working tree ≠ `main`. `git status` : **774 fichiers supprimés**, 9 modifiés. Écart annoncé : `783 files changed, 1543 insertions(+), 137163 deletions(-)`.
- Absents du disque, présents sur `HEAD` : routes `[locale]` (`home`, `pricing`, `sign-in` / `sign-up`, dashboard `influencers`, `content/photo`, `content/reel`, `content/remix`, `billing`), `components.json`, `src/components/ui/*`, `src/messages/{fr,en}.json`, Prisma, Stripe, moteurs.
- Présent à la place : prototype « Personnages » (`/`, `/creer`, `/personnages/[id]`, `/connexion`, `/inscription`). Clerk + Tailwind. Pas de shadcn, pas de next-intl, pas de marketing.
- **Phase 2 ne démarre pas.** Critères d’arrêt du brief : absence de shadcn, i18n cassée. Restaurer `HEAD` écraserait le prototype non commité. Il faut un OK explicite avant de revenir au produit.

## Carte des routes

`HEAD` (préfixe `/fr` et `/en` via `src/app/[locale]`) :

- Marketing : `/` redirige vers `/home` (invité) ou `/influencers` (session) · `/home` · `/pricing` · `/changelog` · légal (`privacy`, `terms`, `mentions`, `data-deletion`) · preview `/preview/landing-premium`.
- Auth : `/sign-in`, `/sign-up` (Clerk).
- App : `/influencers` (+ `new`, `[id]`, `edit`, `scene`, `talking-head`) · `/content` · `/content/photo` · `/content/reel` · `/content/remix` · `/calendar` · `/library` · `/trends` · `/analytics` · `/billing` · `/settings`.

Disque : `/` · `/creer` · `/personnages/[id]` · `/connexion` · `/inscription`.

Écran app dense audité : `/influencers`, rendu par `InfluencerList` (`src/app/[locale]/(dashboard)/influencers/page.tsx`). `InfluencerGrid` n’est importé nulle part.

## Système actuel (HEAD)

- Typo : Geist + Geist Mono seuls (`src/app/layout.tsx`). Display = UI. Tracking serré sur le H1 (`tracking-tight`), kickers mono très lâches (`tracking-[0.18em]`).
- Couleurs : fond `oklch(0 0 0)`, encre `oklch(0.985 0 0)` (`src/app/globals.css` ~148–150). Accent marketing `--aurora: oklch(0.62 0.22 293)` (violet). Échelle violet + indigo encore dans `@theme` (~52–88). `--primary` est blanc.
- Radius : `--radius: 1rem`. Boutons `rounded-full`. Cartes `rounded-2xl`. Pas 2–3 valeurs.
- Motion : `fade-in` 0.5s, `slide-in-*` 0.3s, `gradient-shift`, `wizard-appearance-progress` 1.8s ease-in-out. Cartes studio : framer-motion `y: 16`. Pas une courbe + une durée.
- Densité : marketing aéré (`py-24 md:py-32` répété). Studio = cartes filtres, pas un casting board.
- Preuve : coûts crédits réels (`par photo`, `par reel`, `Instagram + TikTok`, `interface`). Pas de ROAS, pas de logos, pas de faux prénoms. Témoignages = principes produit.
- CTA : bouton plein blanc, secondaire outline. Accent violet réservé au badge « populaire » et à l’app.
- A11y : `focus-visible` ring global dans `globals.css`. Menu carte visible au focus. Chiffres sans `tabular-nums`.

Pas de `design.md`. Pas de stamp Hallmark. `components.json` sur HEAD : shadcn `new-york`, `baseColor: neutral`, CSS variables, icônes Lucide.

## hallmark audit — home, pricing, studio

### Critical

- **Structural AI template** — `src/app/[locale]/(public)/home/page.tsx` ~133–820. Hero centré, quatre tuiles égales, steps, pricing 4 colonnes, CTA centré, footer. Rythme SaaS, pas un studio.
  → Hero = timeline cast → clip 9:16 → publish. Casser la colonne centrée répétée.
- **The AI nav** — `home/page.tsx` ~137–164. Wordmark à gauche, Fonctionnalités / Comment / Tarifs, CTA à droite, barre fixe pleine largeur.
  → Destinations métier (cast, studio, tarifs), pas le trio SaaS.
- **Pure black, pure white** — `src/app/globals.css` ~148–150. `--background: oklch(0 0 0)`, `--foreground: oklch(0.985 0 0)`.
  → Neutres near-black teintés. Pas le noir pur.
- **Inter-everywhere** — `src/app/layout.tsx`. Geist sert de display et de body. Une seule famille.
  → Une display pour H1/H2 + une sans pour l’UI.
- **The purple-gradient** — état vide du studio, `src/components/influencer/influencer-list.tsx` ~338 : `bg-gradient-to-r from-violet-500 to-indigo-500`. Même paire dans `src/components/dashboard/influencer-grid.tsx` ~125 et ~160 (fichier non monté). `--aurora` hue 293 sur le plan mis en avant (`pricing/page.tsx` ~167).
  → Un aplat, une teinte hors violet/cyan.

### Major

- **Eyebrow on every section** — `home/page.tsx` ~240, ~276, ~334, ~344, ~506. Mono uppercase au-dessus du hero, de la preuve, du showcase, des steps.
  → Zéro kicker décoratif.
- **Hanging header** — `home/page.tsx` ~600. Steps en `grid-cols-[3rem_1fr]` avec numéros `01`–`04`.
  → Numéro au-dessus du titre, même colonne, ou liste sans étiquette.
- **The 3-column feature grid** — `home/page.tsx` ~567–575. Quatre tuiles égales `rounded-2xl`. Pricing : même grille 4 colonnes (`pricing/page.tsx` ~144).
  → Asymétrie ou spec sheet. Pas quatre clones.
- **Glassmorphism without purpose** — utilities `glass` / `surface` (`globals.css` ~207–224) · `src/components/ui/card.tsx` ~10 (`backdrop-blur-sm`) · `src/components/layout/sidebar.tsx` ~256 (`backdrop-blur-2xl`) · carte studio classe `surface`.
  → Surfaces opaques, hairline.
- **Centred everything** — hero et chaque `<h2>` home en `text-center max-w-2xl mx-auto`. `pricing/page.tsx` ~137 idem.
  → Titre d’un côté, produit de l’autre.
- **transition-all** — `src/components/ui/button.tsx` ~8 · `influencer-card.tsx` ~93 et ~101.
  → Propriétés nommées seulement.
- **Shadow-glow on dark** — `influencer-card.tsx` ~93 : `hover:shadow-lg hover:shadow-black/30` avec `transition-all`.
  → Bordure ou léger décalage. Pas d’ombre.
- **Animate-on-scroll on everything** (montage) — `influencer-card.tsx` ~88–92 : `initial={{ opacity: 0, y: 16 }}` sur chaque carte. État vide liste : `y: 20` (~323).
  → La grille est là, sans stagger.
- **Mid-render token improvisation** — home/pricing en `zinc-950` / `white/10` / `var(--aurora)` ; studio en `slate-800` + violet Tailwind ; `--primary` blanc à côté de l’échelle violet.
  → Un jeu de tokens.

### Minor

- **Padding identique** — home, `py-24 md:py-32` sur presque chaque section.
- **Hover-only affordance (atténué)** — `influencer-card.tsx` ~101 : menu `md:opacity-0` au repos, visible mobile + focus. Le pointeur fin ne le voit qu’au survol.
- **Tabular data without tabular-nums** — strip de preuves home et crédits sidebar (`sidebar.tsx` `CreditsSection` ~122–197) sans `tabular-nums`.

## Déjà retiré par #26 (ne pas réintroduire)

- H1 solide : utilities `text-gradient-*` neutralisées (`globals.css` ~227–235).
- Pas de mesh / glow branchés sur home ou pricing. Les keyframes existent encore.
- Pas de marquee « Trusted by », pas de témoignage « Sarah Chen ».
- Preuve = coûts crédits, pas de métrique inventée.
- Plan mis en avant = bordure 1px `--aurora`, pas un halo.

## Écarts vs brief studio (faits, pas des tells Hallmark)

- Mark sidebar = icône `Sparkles` (`sidebar.tsx` ~8, ~263).
- Hero = mosaïque photo + badge « 100% générées par notre IA » (`landing.heroPhotoBadge`). Pas de timeline produit.
- Copy encore « influenceuse IA » : metadata layout, H1, CTA final `landing.ctaFinalTitle`.
- Studio = filtres Active / Paused / Archived, avatars ronds. Pas de statut Draft / Live / Performing, pas de mini KPI, pas de hover play, pas de 9:16.
- Crédits : `CreditsSection` lit `creditsRemaining`. À préserver tel quel côté données.
- Radius pill partout (`rounded-full` boutons, `--radius: 1rem`).
- Plusieurs durées et easings. `prefers-reduced-motion` non appliqué aux entrées framer-motion du studio.

## Prototype disque (hors produit)

- `src/app/page.tsx` : grille « Personnages », CTA `rounded-full` lime `#d1fe17`, portraits `rounded-2xl`.
- `src/app/globals.css` : near-black `#0b0c0e`, Space Grotesk + Inter, `page-in` 320ms, `prefers-reduced-motion` respecté sur cette animation.
- `src/app/layout.tsx` : hex Clerk dupliqués hors tokens, `borderRadius: 1rem`.
- Ce n’est pas l’app du brief (pas de pricing, pas de remix, pas de crédits métier).

## Verdict

HEAD : **5 critical · 9 major · 3 minor**. La structure lit encore comme un template SaaS. Le nettoyage #26 a enlevé le glow du hero, pas le rythme ni le violet de l’app.

Phase 2 (study, `design.md`, rebuild) **stoppée** : shadcn et i18n absents du working tree.
