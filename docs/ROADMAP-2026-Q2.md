# Roadmap produit Aura Influence AI — Q2 2026

Objectif : boucle créateur/agence **propre et fiable** — pas de features « bricolées ».

**Principe** : API Meta officielle uniquement (pas de bots engagement / proxies).

---

## Statut (mai 2026)

| Semaine | Thème | Statut |
|---------|--------|--------|
| S1 | Reels parlants (lip-sync UI) | ✅ Livré |
| S2 | Voix TTS + bibliothèque audio | ✅ Livré (Replicate Kokoro) |
| S2b | Photos scène en 2 étapes (valider décor) | ✅ Livré |
| S3 | Instagram bout-en-bout + confiance | 🟡 OAuth + publisher existants, UX à polir |
| S4 | Trends → création (photo/reel) | 🟡 Apply existant, calendrier à lier |
| S5 | Agent 30 jours + validation | ⬜ |
| S6 | Agence / transparence crédits | ⬜ |

---

## S1 — Reel parlant ✅

- Preset **Reel parlant (lip-sync)** (`reel-style-options.ts`)
- Panneau audio unifié : **Générer / Bibliothèque / URL** (`reel-audio-panel.tsx`)
- Backend : Kling → Sync 1.6 si `audioUrl` présent

## S2 — Voix ✅

- `ai-speech.service.ts` — TTS Replicate (défaut Kokoro)
- `content.speechConfig` + `content.generateReelNarration` (0,5 cr)
- Intégré dans le panneau audio du Reel

## Photos — Scène d'abord ✅

- Étape 1 : `generatePhotoScenePlate` (décor seul)
- Étape 2 : `composePhotoOnScene` (validation utilisateur)
- Indicateur `WorkflowSteps` dans l'aperçu

---

## S3 — Instagram (prochaine priorité produit)

**Livrable** : parcours rassurant et complet.

- [ ] Onboarding OAuth testé de bout en bout (Business + Page FB)
- [ ] Preview + checklist avant publish
- [ ] Créneaux suggérés depuis heatmap → planification
- [x] Copy « API officielle, pas de bots » (`influencer-social.tsx`)

**Hors scope** : proxies, likes auto, DMs auto.

---

## S4 — Trends → action

- [x] Apply → photo ou reel (`recommendationToCreatorParams`)
- [x] Reels talking → preset lip_sync auto depuis Trends
- [ ] Bouton « Planifier au calendrier » + deep link

---

## S5 — Agent 30 jours

- [ ] Plan éditorial 30 posts (LLM)
- [ ] Validation par lot dans le calendrier
- [ ] Batch sur posts approuvés uniquement

---

## S6 — Polish agence

- [ ] Page crédits : photo (1+1 scène), reel (8), voix (0,5)
- [ ] Workspaces : invit + rôles UI
- [ ] Rapport analytics exportable

---

## Fichiers clés

| Domaine | Fichiers |
|---------|----------|
| Reel audio | `reel-audio-panel.tsx`, `ai-speech.service.ts` |
| Reel styles | `reel-style-options.ts`, `video-prompts.ts` |
| Photo 2 étapes | `photo-preview.tsx`, `scene-first-photo.ts` |
| Roadmap | Ce fichier |

---

## Métriques (6 semaines)

1. % Reels Pro générés avec preset parlant + audio
2. % comptes IG connectés qui publient ≥1 post via Aura
3. Taux de regénération décor photo (étape 1) < 40 %
4. Upgrade Creator → Pro à J+7
