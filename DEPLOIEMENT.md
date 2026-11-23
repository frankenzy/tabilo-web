# Déploiement du frontend TABILO (Vercel)

Dépôt : `tabilo-web`. L'API est dans le dépôt `tabilo-back` (déployée sur Render, voir son `DEPLOIEMENT_GRATUIT.md`).

## Créer le projet
1. Vercel → **Add New → Project** → dépôt `tabilo-web`, racine du dépôt. `vercel.json` fixe Next.js, pnpm et la région Francfort.
2. Variables d'environnement (Production) :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<projet>.vercel.app` — l'adresse du frontend lui-même |
| `API_PROXY_TARGET` | `https://tabilo-api.onrender.com` |
| `NEXT_PUBLIC_REALTIME_URL` | `https://tabilo-api.onrender.com` |

3. Déployer, puis reporter l'adresse finale dans `CORS_ORIGINS` et `PUBLIC_WEB_URL` côté Render.

## Pourquoi ce relais
Les appels `/api/*` passent par Vercel vers Render : la page et l'API sont sur le même site, le cookie de
rafraîchissement (`SameSite=Strict`) est envoyé. Les WebSockets vont directement sur Render (Vercel ne les relaie pas).

Les variables `NEXT_PUBLIC_*` sont figées au build : après un changement, redéployer.
