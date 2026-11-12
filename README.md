# HollyFilms

Frontend React, Vite et TypeScript pour Jellyfin 12, avec une API Fastify et PostgreSQL. Prisma gère le schéma et les migrations du backend.

## Démarrer en local

Ces commandes se lancent depuis la racine du projet avec Node.js 24 et Docker Compose.

Si tu utilises l’instance Jellyfin fournie par Compose, lance d’abord `docker compose up -d --wait jellyfin`. Termine l’assistant sur [l’interface de Jellyfin](http://127.0.0.1:8096), puis crée une clé API dans le tableau de bord Jellyfin.

Copie `.env.example` vers `.env` et renseigne `JELLYFIN_API_KEY`. Cette clé est obligatoire au démarrage de l’API HollyFilms.

```sh
npm ci
npm run dev
```

`npm run dev` démarre Jellyfin et PostgreSQL avec Docker Compose, puis lance Vite et l’API Fastify en parallèle avec `concurrently`. Les préfixes `web` et `api` apparaissent en cyan et en magenta dans un terminal qui prend en charge les couleurs. L’API applique les migrations Prisma et génère le client avant de démarrer. Vite recharge le frontend et Node redémarre l’API à chaque modification du code serveur. Pour lancer un seul processus, utiliser `npm run dev:web` ou `npm run dev:api` avec les services nécessaires déjà démarrés.

Ouvrir [HollyFilms](http://localhost:5173) et se connecter avec un compte Jellyfin. Le jeton est conservé dans l’onglet et vérifié auprès de Jellyfin au rechargement.

Si tu avais déjà lancé l’API avec Compose, remplace `postgres` par `127.0.0.1` dans `DATABASE_URL` et lance une fois `docker compose up -d --wait --remove-orphans` pour retirer les anciens conteneurs `api` et `migrate`.

Pour ajouter des films, les placer dans le dossier `media` à la racine du projet et sélectionner `/media` dans Jellyfin. Docker conserve la configuration et le cache dans des volumes nommés.

## Gérer les inscriptions

Les utilisateurs peuvent demander un compte depuis la page de connexion. Avec ton compte Jellyfin administrateur, ouvrir [l’administration HollyFilms](http://localhost:5173/admin) pour approuver ou refuser les demandes. Les comptes approuvés accèdent à toutes les bibliothèques. Les utilisateurs inscrits par mot de passe activent leur compte en se connectant une première fois avec le mot de passe choisi à l’inscription.

## Activer Google

Créer un client OAuth de type **Application Web** dans Google Cloud et enregistrer `http://localhost:5173/api/auth/google/callback` comme URL de redirection locale. Renseigner `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et `GOOGLE_PASSWORD_KEY` dans `.env`, puis relancer `npm run dev`. Pour générer la clé de chiffrement, exécuter `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"`. Conserver la clé dans le gestionnaire de secrets pour pouvoir rouvrir les sessions Google après une restauration PostgreSQL. [Configuration OAuth Google](https://developers.google.com/identity/protocols/oauth2/web-server)

Utiliser l’adresse exacte de `PUBLIC_ORIGIN` pour le parcours Google. En production, utiliser une origine HTTPS et enregistrer l’URL correspondante, par exemple `https://films.example.com/api/auth/google/callback`. En mode test dans Google Cloud, ajouter le compte de test à la liste des utilisateurs autorisés. Vérifier l’inscription, l’approbation et la reconnexion avec ce compte avant la mise en service.

## Configuration et migrations

- Le navigateur contacte `/api` et `/jellyfin` sur la même origine. En développement, Vite relaie ces chemins vers `HOLLYFILMS_API_URL` et `JELLYFIN_URL`. L’API écoute par défaut sur `127.0.0.1:3000` et utilise aussi `JELLYFIN_URL`. Si tu changes le port de l’API, ajuste `PORT` et `HOLLYFILMS_API_URL` dans `.env`.
- En production, servir `dist` avec `index.html` comme repli pour `/admin`. Relayer `/api` vers Fastify en conservant le préfixe et `/jellyfin` vers Jellyfin en retirant le préfixe. Si Fastify est derrière un proxy, renseigner `TRUST_PROXY` avec l’adresse ou le sous-réseau de ce proxy pour appliquer les limites par IP client.
- Compose publie PostgreSQL sur `127.0.0.1:5432`. Si tu changes `POSTGRES_PORT`, ajuste aussi `DATABASE_URL`. Pour un déploiement, définir un mot de passe `POSTGRES_PASSWORD` fort avant la première initialisation du volume et renseigner le même mot de passe, encodé pour une URL, dans `DATABASE_URL`. Pour une base déjà initialisée, changer aussi le mot de passe du rôle dans PostgreSQL.
- Après modification du schéma Prisma, exécuter `npm run db:migrate -- --name nom_du_changement` sur une base de développement, puis `npx prisma generate`. Versionner la migration générée. Au déploiement, exécuter `npm run db:deploy` avant de démarrer l’API.

## Storybook

Lancer `npm run storybook` et ouvrir [Storybook](http://127.0.0.1:6006). La section **UI** présente les composants réutilisables de `src/ui`. La section **HollyFilms** présente la connexion, la demande de compte et l’administration avec des données simulées. Storybook se lance indépendamment de Jellyfin, de PostgreSQL et de l’API.

Ajouter les fichiers `*.stories.tsx` à côté des composants. `npm run build-storybook` produit un site statique dans `storybook-static`.

## Intégrations design et tests

Les serveurs MCP du projet sont déclarés dans `.codex/config.toml`. Après `npm ci`, relancer Codex depuis la racine de HollyFilms.

- **Figma** utilise le serveur officiel. Pour la connexion depuis la CLI, lancer `codex mcp login figma`. L’application Codex permet aussi de se connecter via le plugin Figma. [Configuration Figma](https://help.figma.com/hc/en-us/articles/39888629089175-Codex-and-Figma-Set-up-the-MCP-server)
- **shadcn/ui** utilise le registre officiel et la palette sombre de HollyFilms. `npx shadcn add <composant>` installe les composants dans `src/components/ui`. [Documentation shadcn/ui](https://ui.shadcn.com/docs/mcp)
- **21st.dev** lit `API_KEY_21ST` dans l’environnement du processus qui lance Codex. Générer la clé dans le compte 21st.dev. [Configuration 21st.dev](https://21st.dev/mcp)
- **Playwright** ouvre un navigateur sans fenêtre avec un profil isolé. Utiliser `http://localhost:5173` pour l’application ou `http://127.0.0.1:6006` pour Storybook. [Documentation Playwright MCP](https://github.com/microsoft/playwright-mcp)
- **Motion** fournit le MCP de documentation et la bibliothèque React, importable depuis `motion/react`. [Documentation Motion](https://motion.dev/docs/ai-kit)
- **Storybook et Chromatic**. `npm run storybook` expose le MCP local sur `http://127.0.0.1:6006/mcp`. Pour lancer les tests visuels hébergés depuis un dépôt Git, renseigner `CHROMATIC_PROJECT_TOKEN` dans l’environnement puis lancer `npm run chromatic`. La première publication fournit aussi l’URL du MCP hébergé. [Publication du MCP Storybook dans Chromatic](https://www.chromatic.com/docs/storybook-mcp/)

## Vérifier le projet

```sh
npm test
npm run lint
npm run format:check
npm run build
npm run build:api
```

`npm test` appelle `/System/Info/Public` sur le serveur Jellyfin actif et vérifie qu’il s’agit de Jellyfin 12. Le test fonctionne dès que le serveur répond, avant même la fin de l’assistant. Il utilise `JELLYFIN_URL` si cette variable est définie.

Pour tester les inscriptions, créer un PostgreSQL 17 de test et un Jellyfin 12.4 neuf dans des conteneurs isolés. Appliquer les migrations avec `npm run db:deploy` en pointant `DATABASE_URL` vers la base de test. Renseigner `HOLLYFILMS_TEST_DATABASE_URL` et `HOLLYFILMS_TEST_JELLYFIN_URL`, puis lancer `npm run test:accounts`. Le test initialise l’assistant Jellyfin de cette instance et simule le fournisseur Google.

`npm run format` applique Prettier. `docker compose down` arrête les services et conserve leurs volumes.
