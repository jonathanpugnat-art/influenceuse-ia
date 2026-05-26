# Instagram Login (connexion directe)

Aura utilise par défaut **Instagram API with Instagram Login** (`INSTAGRAM_OAUTH_MODE=instagram`).

## Pour l’utilisateur

1. Compte Instagram **Professionnel** (Business ou Creator)
2. Aura → **Réseaux** → **Connecter**
3. Écran **Instagram** (pas Facebook)
4. Pas besoin de créer une Page Facebook

## Meta Developer

1. App → **Instagram** → **API setup with Instagram login**
2. **Set up Instagram business login** → **Business login settings**
3. Copier **Instagram App ID** et **Instagram App Secret**
4. **OAuth redirect URIs** : `https://TON-DOMAINE/api/auth/instagram`

## Vercel

```
INSTAGRAM_OAUTH_MODE=instagram
INSTAGRAM_LOGIN_APP_ID=<Instagram App ID>
INSTAGRAM_LOGIN_APP_SECRET=<Instagram App Secret>
NEXT_PUBLIC_APP_URL=https://TON-DOMAINE
```

`INSTAGRAM_APP_ID` / `SECRET` peuvent rester les mêmes valeurs si Meta affiche un seul ID.

## Mode Facebook (ancien)

```
INSTAGRAM_OAUTH_MODE=facebook
FACEBOOK_LOGIN_CONFIG_ID=...
```

Voir `docs/INSTAGRAM-META-SETUP.md`.
