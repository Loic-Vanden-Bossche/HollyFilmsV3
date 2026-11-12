# HollyFilms

Frontend React, Vite et TypeScript pour Jellyfin 12, avec une API Fastify et PostgreSQL. Prisma gère le schéma et les migrations du backend.

## Workspaces

- `apps/web` (`@hollyfilms/web`) contient le frontend Vite, Storybook et shadcn/ui.
- `apps/api` (`@hollyfilms/api`) contient l’API Fastify, le schéma et les migrations Prisma.
- `apps/shared` (`@hollyfilms/shared`) contient les types et les fonctions Jellyfin utilisés par les deux apps.

Yarn Berry utilise un seul fichier `yarn.lock` à la racine. Les dépendances se déclarent dans le workspace qui les utilise, par exemple avec `yarn workspace @hollyfilms/web add <paquet>`.

## Démarrer en local

Ces commandes se lancent depuis la racine du projet avec Node.js 24, Corepack et Docker Compose. Corepack sélectionne la version de Yarn déclarée dans `package.json`.

Si tu utilises l’instance Jellyfin fournie par Compose, lance d’abord `docker compose up -d --wait jellyfin`. Termine l’assistant sur [l’interface de Jellyfin](http://127.0.0.1:8096), puis crée une clé API dans le tableau de bord Jellyfin.

Copie `.env.example` vers `.env` et renseigne `JELLYFIN_API_KEY`. Cette clé est obligatoire au démarrage de l’API HollyFilms.

```sh
corepack enable
yarn install --immutable
yarn dev
```

Si le terminal utilise déjà un autre exécutable Yarn, lance `corepack yarn install --immutable` et `corepack yarn dev`.

`yarn dev` démarre Jellyfin et PostgreSQL avec Docker Compose, puis lance Vite et l’API Fastify en parallèle avec `concurrently`. Les préfixes `web` et `api` apparaissent en cyan et en magenta dans un terminal qui prend en charge les couleurs. L’API applique les migrations Prisma et génère le client avant de démarrer. Vite recharge le frontend et Node redémarre l’API à chaque modification du code serveur. Pour lancer un seul processus, utiliser `yarn dev:web` ou `yarn dev:api` avec les services nécessaires déjà démarrés.

Ouvrir [HollyFilms](http://localhost:5173) et se connecter avec un compte Jellyfin. Le jeton est conservé dans l’onglet et vérifié auprès de Jellyfin au rechargement.

Si tu avais déjà lancé l’API avec Compose, remplace `postgres` par `127.0.0.1` dans `DATABASE_URL` et lance une fois `docker compose up -d --wait --remove-orphans` pour retirer les anciens conteneurs `api` et `migrate`.

Pour ajouter des films, les placer dans le dossier `media` à la racine du projet et sélectionner `/media` dans Jellyfin. Docker conserve la configuration et le cache dans des volumes nommés.

## Accueil connecté

`/app` affiche les bibliothèques accessibles à l’utilisateur après vérification de sa session. L’accueil propose un carrousel de vingt titres maximum, les lectures en cours, les ajouts récents, les filtres films/séries et une recherche paginée côté serveur. Les cartes ouvrent une fiche avec le synopsis, les genres et la progression ; les actions Lire, Reprendre et Depuis le début ouvrent le lecteur intégré.

Le carrousel utilise les logos transparents du serveur (PNG, jusqu’à 1 600 px), les fonds jusqu’à 3 840 px, les notes, la classification, les genres et l’heure de fin estimée. Les favoris sont enregistrés avec le SDK pour l’utilisateur connecté. Les images restent authentifiées par en-tête. Un titre sans logo conserve son nom en texte.

Les aperçus privilégient les vidéos de thème et bandes-annonces locales, puis les bandes-annonces YouTube présentes dans les métadonnées (VF en priorité). Seul l’aperçu courant est chargé, en sourdine, sans modifier la progression du film. Les vidéos locales utilisent leur flux direct : un format incompatible, une vidéo absente, un blocage d’autoplay ou une intégration YouTube refusée conserve le fond fixe. YouTube utilise son lecteur officiel sur `youtube-nocookie.com` et reçoit l’origine du site, jamais le jeton HollyFilms. Sa qualité dépend du flux disponible. Aucune clé YouTube n’est nécessaire.

La rotation dure dix secondes par affiche ou trente secondes avec un aperçu. Le survol et le focus suspendent la rotation ; le bouton pause suspend aussi la vidéo. L’aperçu est démonté quand le carrousel sort de l’écran, que l’onglet devient invisible, qu’une fiche s’ouvre ou que le lecteur démarre. La préférence de mouvement réduit désactive les vidéos et la rotation automatique. Les stories **UI / Carrousel cinéma** et **UI / Aperçu vidéo** couvrent les variantes avec un petit média synthétique local.

L’ouverture Motion dure environ 2,3 secondes : ident HollyFilms 3.0, ouverture des volets, recul du visuel puis arrivée du titre et des rangées. Elle peut être passée ou rejouée depuis le pied de page, respecte le mouvement réduit et ne redémarre pas lors d’une recherche. `HomePage` gère la présentation et `HomeScreen` les requêtes TanStack Query. Le SDK utilise le jeton de l’utilisateur et son identifiant ; les images sont chargées avec l’en-tête d’autorisation puis affichées via des URL Blob révoquées au démontage.

Les stories **HollyFilms/Accueil** couvrent l’ouverture, la navigation, le chargement et les erreurs avec des visuels fictifs locaux. `yarn test` vérifie aussi l’adaptateur de bibliothèque, la pagination et le transport du jeton dans les en-têtes.

## Lecteur intégré

Les cartes affichent la meilleure résolution disponible (dimensions des pistes vidéo, y compris les films recadrés), le score critique Rotten Tomatoes lorsqu’il est renseigné, les langues audio et l’état vu/non vu. Les drapeaux SVG sont servis localement et accompagnés du nom de la langue ; un code texte remplace les langues sans drapeau associé. Les sous-titres ne sont pas comptés comme langues audio. Les éditions reconnues dans le nom de la source (version longue, director’s cut, etc.) ou un marqueur `{edition-…}` sont affichées sans exposer le nom du fichier. Les métadonnées absentes sont omises.

Les actions Favori et Vu apparaissent au survol, au focus clavier et en permanence sur écran tactile. Le SDK enregistre les changements pour l’utilisateur connecté ; les cartes et le carrousel sont mis à jour ensemble. Marquer un titre comme vu ou non vu actualise aussi la liste des lectures en cours.

Les images de `MediaArtwork` participent automatiquement aux transitions partagées de `ArtworkHeroProvider` : leur identité repose sur l’image serveur et son tag, indépendamment de la résolution demandée. La transition partagée est réservée aux passages entre une image visible et le lecteur, dans les deux sens lorsque l’image source est encore affichée. Ouvrir ou fermer une fiche, changer de carte ou de diapositive ne déclenche aucune transition partagée. Une couche visuelle Motion traverse les dialogues natifs sans modifier leur focus. Elle développe le verre dépoli à l’entrée du lecteur et termine son mouvement même si la première image vidéo arrive immédiatement, sans retarder la lecture. Les images déjà chargées servent de prévisualisation pendant le chargement haute résolution. Sans image source visible, avec mouvement réduit ou sans prise en charge de Popover, l’affichage normal reste disponible.

Le lecteur React de HollyFilms se trouve dans `apps/web/src/playback` et `apps/web/src/PlaybackPlayer.tsx`. Vite le compile avec le reste de l’application. La session de l’onglet négocie la lecture directe, le remux ou le transcodage via le SDK. HLS et les moteurs de sous-titres sont chargés selon le flux. Les commandes de lecture, les pistes, les chapitres, les segments et la file sont disponibles dans le lecteur.

Le proxy `/jellyfin` doit relayer les requêtes Range et les WebSockets. Les URLs des flux peuvent contenir le jeton de l’utilisateur. La diffusion Google Cast ou AirPlay demande une URL HTTPS joignable depuis le récepteur. Le build Vite contient les workers et les fichiers WASM utilisés par le lecteur.

Les aperçus au survol utilisent les images Trickplay générées par le serveur. Dans la gestion de chaque bibliothèque vidéo, activer l’extraction des images Trickplay (et l’extraction pendant l’analyse pour les futurs ajouts), puis lancer la tâche « Générer les images Trickplay » pour les titres existants. La génération initiale peut prendre du temps. Le lecteur utilise les images de chapitre disponibles en secours ; sans image générée, il affiche le temps et « Aperçu indisponible ». Les images sont récupérées avec l’en-tête d’autorisation utilisateur et un cache de trois planches maximum, libéré à la fermeture. L’ouverture n’a pas d’écran d’introduction et la fermeture enregistre la progression en arrière-plan.

`corepack yarn test:player` lance un Jellyfin 12.4 isolé avec Docker, des médias générés et Chrome headless. Les tests vérifient le décodage de l’image, les pistes, les changements de flux et la progression. Ils ne touchent ni aux comptes ni aux médias du serveur local.

## Gérer les inscriptions

La vitrine publique est accessible sur `/` et l’espace membre sur `/app`. Les accès à la connexion, à Google et à l’inscription utilisent les parcours existants. Les demandes attendent l’approbation d’un administrateur.

La vitrine tient dans la hauteur de l’écran. Motion for React orchestre l’ouverture, la galerie d’affiches en perspective et le texte des fonctionnalités dans `apps/web/src/use-landing-motion.ts`. Le composant `ProjectorBackdrop` utilise God Rays de Paper Shaders, chargé à la demande : palette bleu nuit/vert/bleu, lumière en haut à gauche et résolution limitée à 1,5 million de pixels. Pause, formulaire ouvert et onglet masqué suspendent les animations. La préférence de mouvement réduit et l’absence de WebGL conservent une présentation statique. Les animations et ressources GPU sont libérées au démontage. Le catalogue reste non interactif et affiche les titres du serveur.

`GET /api/showcase` présente jusqu’à 18 films et séries récemment ajoutés à Jellyfin, avec leur titre, leur année et leur affiche. Cette sélection est mise en cache pendant une minute. Les affiches sont relayées par le serveur pour les seuls éléments de cette sélection. Une bibliothèque vide affiche un message de préparation. Le test `corepack yarn workspace @hollyfilms/api node --test tests/showcase.test.ts` vérifie le contenu public et le filtrage des affiches.

Les utilisateurs peuvent demander un compte depuis la page de connexion. Avec ton compte Jellyfin administrateur, ouvrir [l’administration HollyFilms](http://localhost:5173/admin) pour approuver ou refuser les demandes. Les comptes approuvés accèdent à toutes les bibliothèques. Les utilisateurs inscrits par mot de passe activent leur compte en se connectant une première fois avec le mot de passe choisi à l’inscription.

## Activer Google

Créer un client OAuth de type **Application Web** dans Google Cloud et enregistrer `http://localhost:5173/api/auth/google/callback` comme URL de redirection locale. Renseigner `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et `GOOGLE_PASSWORD_KEY` dans `.env`, puis relancer `yarn dev`. Pour générer la clé de chiffrement, exécuter `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"`. Conserver la clé dans le gestionnaire de secrets pour pouvoir rouvrir les sessions Google après une restauration PostgreSQL. [Configuration OAuth Google](https://developers.google.com/identity/protocols/oauth2/web-server)

Utiliser l’adresse exacte de `PUBLIC_ORIGIN` pour le parcours Google. En production, utiliser une origine HTTPS et enregistrer l’URL correspondante, par exemple `https://films.example.com/api/auth/google/callback`. En mode test dans Google Cloud, ajouter le compte de test à la liste des utilisateurs autorisés. Vérifier l’inscription, l’approbation et la reconnexion avec ce compte avant la mise en service.

## Configuration et migrations

- Le navigateur contacte `/api` et `/jellyfin` sur la même origine. En développement, Vite relaie ces chemins vers `HOLLYFILMS_API_URL` et `JELLYFIN_URL`. L’API écoute par défaut sur `127.0.0.1:3000` et utilise aussi `JELLYFIN_URL`. Si tu changes le port de l’API, ajuste `PORT` et `HOLLYFILMS_API_URL` dans `.env`.
- En production, servir `apps/web/dist` avec `index.html` comme repli pour `/app` et `/admin`. Relayer `/api` vers Fastify en conservant le préfixe et `/jellyfin` vers Jellyfin en retirant le préfixe. Si Fastify est derrière un proxy, renseigner `TRUST_PROXY` avec l’adresse ou le sous-réseau de ce proxy pour appliquer les limites par IP client.
- Compose publie PostgreSQL sur `127.0.0.1:5432`. Si tu changes `POSTGRES_PORT`, ajuste aussi `DATABASE_URL`. Pour un déploiement, définir un mot de passe `POSTGRES_PASSWORD` fort avant la première initialisation du volume et renseigner le même mot de passe, encodé pour une URL, dans `DATABASE_URL`. Pour une base déjà initialisée, changer aussi le mot de passe du rôle dans PostgreSQL.
- Après modification du schéma Prisma, exécuter `yarn db:migrate --name nom_du_changement` sur une base de développement, puis `yarn db:generate`. Versionner la migration générée. Au déploiement, exécuter `yarn db:deploy` avant de démarrer l’API.

## Storybook

Lancer `yarn storybook` et ouvrir [Storybook](http://127.0.0.1:6006). La section **UI** présente les composants réutilisables de `apps/web/src/ui`. La section **HollyFilms** présente la connexion, la demande de compte et l’administration avec des données simulées. Storybook se lance indépendamment de Jellyfin, de PostgreSQL et de l’API.

Ajouter les fichiers `*.stories.tsx` à côté des composants. `yarn build-storybook` produit un site statique dans `apps/web/storybook-static`.

## Intégrations design et tests

Les serveurs MCP du projet sont déclarés dans `.codex/config.toml`. Après `yarn install --immutable`, relancer Codex depuis la racine de HollyFilms.

- **Figma** utilise le serveur officiel. Pour la connexion depuis la CLI, lancer `codex mcp login figma`. L’application Codex permet aussi de se connecter via le plugin Figma. [Configuration Figma](https://help.figma.com/hc/en-us/articles/39888629089175-Codex-and-Figma-Set-up-the-MCP-server)
- **shadcn/ui** utilise le registre officiel et la palette sombre de HollyFilms. `yarn workspace @hollyfilms/web shadcn add <composant>` installe les composants dans `apps/web/src/components/ui`. [Documentation shadcn/ui](https://ui.shadcn.com/docs/mcp)
- **React Bits** utilise le MCP `shadcn` existant via le registre `@react-bits` configur� dans `apps/web/components.json` (`https://reactbits.dev/r/{name}.json`). Rechercher les composants via ce MCP, puis installer avec `corepack yarn workspace @hollyfilms/web shadcn add @react-bits/<Nom>-TS-CSS`. Si une session MCP conserve une ancienne configuration, utiliser les URL de registre compl�tes ou relancer la session. Le composant `apps/web/src/components/TiltedCard.tsx` adapte Tilted Card et Spotlight Card � Motion, aux images authentifi�es et aux contr�les des cartes HollyFilms. Pr�server la licence voisine et les variantes tactiles, clavier et mouvement r�duit. [Configuration officielle](https://reactbits.dev/get-started/mcp)
- **Playwright** ouvre un navigateur sans fenêtre avec un profil isolé. Utiliser `http://localhost:5173` pour l’application ou `http://127.0.0.1:6006` pour Storybook. [Documentation Playwright MCP](https://github.com/microsoft/playwright-mcp)
- **Motion** fournit le MCP de documentation et la bibliothèque React, importable depuis `motion/react`. [Documentation Motion](https://motion.dev/docs/ai-kit)
- **Storybook** expose son MCP local sur `http://127.0.0.1:6006/mcp` avec `yarn storybook`.

## Vérifier le projet

```sh
yarn test
yarn lint
yarn format:check
yarn build
```

`yarn test` appelle `/System/Info/Public` sur le serveur Jellyfin actif et vérifie qu’il s’agit de Jellyfin 12. Le test fonctionne dès que le serveur répond, avant même la fin de l’assistant. Il utilise `JELLYFIN_URL` si cette variable est définie. `yarn build` vérifie et compile le web, son lecteur et l’API.

Pour tester les inscriptions, créer un PostgreSQL 17 de test et un Jellyfin 12.4 neuf dans des conteneurs isolés. Appliquer les migrations avec `yarn db:deploy` en pointant `DATABASE_URL` vers la base de test. Renseigner `HOLLYFILMS_TEST_DATABASE_URL` et `HOLLYFILMS_TEST_JELLYFIN_URL`, puis lancer `yarn test:accounts`. Le test initialise l’assistant Jellyfin de cette instance et simule le fournisseur Google.

`yarn format` applique Prettier. `docker compose down` arrête les services et conserve leurs volumes.
