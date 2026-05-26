# Connexion Instagram (Meta) — guide Aura

Si Facebook affiche **« Confirmez votre compte »** puis **« Service indisponible »**, le problème est presque toujours côté **Meta Developer**, pas dans Aura. Ce guide liste les étapes dans l’ordre.

## Prérequis côté toi (compte Instagram)

1. Compte Instagram en **Professionnel** (Business ou Creator).
2. Une **Page Facebook** créée (même vide).
3. Instagram **lié** à cette Page : app Instagram → Paramètres → Compte → Partage sur d’autres applis → Facebook → sélectionner la Page.
4. Tu te connectes avec le **même compte Facebook** qui administre la Page.

## Prérequis côté app Meta (developers.facebook.com)

### 1. Produits activés

- **Facebook Login** (ou **Facebook Login for Business** si tu l’utilises).
- **Instagram** → **API setup with Facebook login** (publication de contenu).

### 2. Mode de l’application

| Mode | Qui peut se connecter |
|------|------------------------|
| **Développement** | Uniquement rôles sur l’app : Administrateur, Développeur, **Testeur** |
| **Live** | Tous les utilisateurs (après App Review des permissions) |

**Si tu es en Développement** : ajoute ton compte Facebook dans **Rôles → Testeurs**, accepte l’invitation par email, puis réessaie « Connecter ».

### 3. URI de redirection OAuth

Dans **Facebook Login → Paramètres → URI de redirection OAuth valides**, ajoute **exactement** :

```
https://TON-DOMAINE/api/auth/instagram
```

(`TON-DOMAINE` = valeur de `NEXT_PUBLIC_APP_URL` sur Vercel, sans slash final.)

**Production Aura** : le domaine canonique est en général **`https://aurainfluenceai.com`** (sans `www`).  
Si tu navigues avec `www`, ajoute **les deux** URI dans Meta :

- `https://aurainfluenceai.com/api/auth/instagram`
- `https://www.aurainfluenceai.com/api/auth/instagram`

L’URI envoyée à Facebook est toujours celle de `NEXT_PUBLIC_APP_URL` — elle doit figurer dans la liste Meta.

### 4. Permissions (scopes)

Aura demande :

- `instagram_basic`
- `instagram_content_publish`
- `pages_show_list`
- `pages_read_engagement`

Pour le mode **Live**, soumets ces permissions dans **App Review** avec une démo vidéo si demandé.

### 5. Vérification Business

Si le login échoue pour tout le monde sauf le propriétaire de l’app :

- Complète **Vérification Business** dans Meta Business Suite.
- Vérifie qu’aucune alerte « Login indisponible » n’apparaît sur le tableau de bord de l’app.

Attente possible : **24–48 h** après mise à jour des infos Business.

### 6. Facebook Login for Business (obligatoire pour Aura Influence AI)

Si ton app a le produit **Facebook Login for Business** (cas d’usage Instagram), les scopes
`instagram_basic`, `pages_show_list`, etc. dans l’URL OAuth provoquent **Invalid Scopes**.

1. Menu **Facebook Login for Business** → **Configurations**
2. **Créer une configuration** (ou modifier) → type **Jeton d’accès utilisateur** (User access token)
3. Permissions : publication Instagram + Pages (selon l’assistant Meta)
4. Copie l’**ID de configuration** (nombre long)
5. Vercel :

```
FACEBOOK_LOGIN_CONFIG_ID=1234567890123456
```

6. **Redeploy** — Aura n’envoie plus de `scope` invalide, seulement `config_id`.

Sans `FACEBOOK_LOGIN_CONFIG_ID`, tu verras :  
`Invalid Scopes: instagram_basic, instagram_content_publish...`

## Variables d’environnement (Vercel)

| Variable | Rôle |
|----------|------|
| `INSTAGRAM_APP_ID` ou `FACEBOOK_APP_ID` | ID de l’app Meta |
| `INSTAGRAM_APP_SECRET` ou `FACEBOOK_APP_SECRET` | Secret |
| `NEXT_PUBLIC_APP_URL` | URL publique (ex. `https://aura.example.com`) |
| `ENCRYPTION_SECRET` | Chiffrement des tokens en base |
| `R2_PUBLIC_URL` | URLs HTTPS des médias (obligatoire pour la publication IG) |
| `FACEBOOK_LOGIN_CONFIG_ID` | Optionnel, Login for Business |

## « Service indisponible » pendant le login (pas la publication)

Causes fréquentes :

1. App en **Développement** et utilisateur **pas testeur**.
2. Compte Facebook en **checkpoint** (« Confirmez votre compte ») — termine la vérif dans l’app Facebook.
3. **Vérification Business** incomplète ou en cours.
4. Bug / maintenance Meta — voir [metastatus.com](https://metastatus.com/).

Ce n’est **pas** le même message que l’erreur API `(#2) Service temporarily unavailable` lors de la **publication** (souvent transient côté Meta).

## Contournement produit (en attendant Meta)

Aura permet toujours :

- Générer photos / reels / légendes.
- **Télécharger** le média et copier la légende pour publication **manuelle** dans l’app Instagram.

La publication automatique ne fonctionne qu’après une connexion OAuth réussie.

## Test rapide

1. Connecte-toi à Aura avec ton compte.
2. Profil influenceuse → onglet **Réseaux sociaux** → **Connecter**.
3. Si erreur, note l’URL de retour (`instagram_error=...`) et vérifie les points ci-dessus.

Support Meta : [developers.facebook.com/support](https://developers.facebook.com/support)
