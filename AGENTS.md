# HollyFilms — Guide des agents

## Structure du projet

- `apps/web` (`@hollyfilms/web`) contient React, Vite, TypeScript, Tailwind CSS et TanStack Query. Les composants réutilisables sont dans `apps/web/src/ui` et la configuration Storybook dans `apps/web/.storybook`.
- `apps/api` (`@hollyfilms/api`) contient Fastify, Prisma et l’intégration Jellyfin. Le schéma est dans `apps/api/prisma/schema.prisma` et les migrations SQL dans `apps/api/prisma/migrations`.
- `apps/shared` (`@hollyfilms/shared`) contient les contrats d’inscription et les fonctions communes du SDK Jellyfin. Utilise les exports du workspace pour les imports entre applications.

Utilise Node.js 24 et la version de Yarn Berry déclarée dans `package.json`. Lance les commandes depuis la racine avec Corepack. Déclare chaque dépendance dans le workspace qui l’utilise et mets à jour le seul `yarn.lock` de la racine.

## Démarrage local

1. Utilise le `.env` existant. Pour une installation neuve, suis le [README](README.md#démarrer-en-local) et utilise [`.env.example`](.env.example) comme modèle.
2. Exécute `corepack yarn install --immutable`, puis `corepack yarn dev`. Compose démarre Jellyfin 12.4 et PostgreSQL 17. `concurrently` lance Vite et Fastify en local avec rechargement automatique et préfixes colorés. L’API valide sa configuration, applique les migrations et génère le client Prisma au démarrage.
3. Ouvre `http://localhost:5173`. Vite relaie `/api` vers Fastify (port 3000 par défaut) et `/jellyfin` vers Jellyfin (port 8096 par défaut). Vérifie `/api/health` et `/jellyfin/System/Info/Public` depuis cette origine si un service répond mal. Avec les services nécessaires déjà démarrés, `corepack yarn dev:web` et `corepack yarn dev:api` lancent chaque processus séparément.

`JELLYFIN_API_KEY` et `DATABASE_URL` sont obligatoires côté API. Garde cette validation au démarrage. Les clés Jellyfin et Google et la clé de chiffrement restent côté serveur. Préserve la session utilisateur par onglet et le contrôle du rôle administrateur par Jellyfin sur les routes `/api/admin`.

## Serveurs MCP du projet

Les six serveurs sont déclarés dans [`.codex/config.toml`](.codex/config.toml). Ouvre Codex à la racine dans un projet de confiance. Vérifie les entrées avec `codex mcp list` et relance la session si la configuration vient de changer. [Documentation MCP de Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

- **WebStorm** (`webstorm`). Ouvre HollyFilms dans WebStorm avec son serveur MCP actif. L’URL locale est `http://127.0.0.1:64542/stream` dans la configuration actuelle. Utilise-le en priorité pour explorer le projet, suivre les symboles, examiner les diagnostics et effectuer des refactorings. Passe le chemin de la racine aux outils qui acceptent `projectPath`. Si l’IDE est indisponible, utilise les fichiers et les scripts Yarn pour poursuivre.
- **Figma** (`figma`). Le serveur distant est `https://mcp.figma.com/mcp`. Utilise la connexion Figma de l’application ou `codex mcp login figma` dans la CLI. Quand la tâche fournit une maquette, ouvre le nœud de référence et récupère le contexte de design, la capture, les composants et les variables utiles. Charge la compétence Figma adaptée à l’opération avant l’appel et utilise les composants et tokens existants quand ils correspondent à la maquette. Modifie un fichier Figma lorsque la tâche le demande.
- **shadcn/ui** (`shadcn`). Codex lance le serveur local après installation des dépendances. Le serveur cible `apps/web`, où se trouve `components.json`. Cherche d’abord dans les composants du projet, puis dans les registres via le MCP. Si un composant doit être ajouté, utilise `corepack yarn workspace @hollyfilms/web shadcn add <composant>` et vérifie le diff, les dépendances et les styles générés dans le workspace web.
- **React Bits** utilise le MCP `shadcn` existant via le registre `@react-bits` configur� dans `apps/web/components.json` (`https://reactbits.dev/r/{name}.json`). Rechercher les composants via ce MCP, puis installer avec `corepack yarn workspace @hollyfilms/web shadcn add @react-bits/<Nom>-TS-CSS`. Si une session MCP conserve une ancienne configuration, utiliser les URL de registre compl�tes ou relancer la session. Le composant `apps/web/src/components/TiltedCard.tsx` adapte Tilted Card et Spotlight Card � Motion, aux images authentifi�es et aux contr�les des cartes HollyFilms. Pr�server la licence voisine et les variantes tactiles, clavier et mouvement r�duit. [Configuration officielle](https://reactbits.dev/get-started/mcp)
- **Storybook** (`storybook`). Démarre `corepack yarn storybook` avant d’utiliser le MCP à `http://127.0.0.1:6006/mcp`. Utilise-le pour retrouver les stories, consulter les variantes et vérifier les interactions avec les outils exposés. Les stories utilisent des données simulées et peuvent tourner indépendamment de l’API et de Jellyfin.
- **Playwright** (`playwright`). Codex lance le serveur local en mode headless avec un profil isolé. Utilise-le sur Vite (`http://localhost:5173`) pour les parcours complets et sur Storybook (`http://127.0.0.1:6006`) pour les composants. Inspecte les états et erreurs utiles, vérifie le comportement au clavier et sur les tailles d’écran concernées, puis prends une capture si elle aide à vérifier le résultat. Une session Jellyfin de test doit être ouverte dans le profil Playwright pour vérifier les parcours authentifiés.
- **Motion** (`motion`). Consulte le MCP de documentation à `https://mcp.motion.dev` pour choisir les API d’animation et de transition. Implémente dans React avec `motion/react` et vérifie les interactions avec Playwright, y compris le comportement avec la préférence de mouvement réduit si l’animation est concernée.

## Modifier une interface

Pour la vitrine publique, utilise **Motion for React** (`motion/react`) pour l’ouverture, les fonctionnalités et la galerie d’affiches en perspective. Paper Shaders (God Rays) fournit le faisceau. Le temps d’animation est centralisé dans `apps/web/src/use-landing-motion.ts`, la galerie dans `apps/web/src/ui/CatalogueGallery.tsx` et le shader dans `apps/web/src/ui/ProjectorBackdrop.tsx`. Préserve la page sans scroll, le catalogue non interactif, la pause commune, la préférence de mouvement réduit, le fond statique sans WebGL et le nettoyage au démontage. Les textes de l’interface utilisent la marque HollyFilms ; les références techniques au SDK et les routes restent inchangées.

1. Repère les composants et les stories existants avec WebStorm et Storybook. Pour un changement guidé par une maquette, relève les états et les variantes dans Figma. Utilise shadcn/ui pour rechercher un composant manquant et Motion pour les changements d’animation.
2. Implémente dans `apps/web` en réutilisant les couleurs sémantiques et le dégradé de `apps/web/tailwind.config.js`, chargé par `apps/web/src/index.css`. Les appels de données du navigateur passent par `/api` et `/jellyfin` selon le service.
3. Ajoute une story à côté d’un nouveau composant réutilisable ou mets à jour les stories dont le comportement change. Utilise les compétences locales [`discover-storybook-jetbrains`](.agents/skills/discover-storybook-jetbrains/SKILL.md) pour auditer la couverture et [`author-storybook-jetbrains`](.agents/skills/author-storybook-jetbrains/SKILL.md) pour écrire les stories et leurs interactions. Reproduis les états pertinents avec des données simulées.
4. Vérifie le composant isolé dans Storybook, puis le parcours intégré dans Vite avec Playwright si la tâche touche à un écran ou à une interaction utilisateur. Pour un changement de connexion, vérifie aussi le rechargement dans le même onglet.

## Modifier l’API ou la base

- Pour un changement de schéma, exécute `corepack yarn db:migrate --name nom_du_changement` sur une base de développement, puis `corepack yarn db:generate`. Versionne le schéma et la migration SQL générée. Le client généré est ignoré par Git.
- Utilise `corepack yarn db:deploy` pour appliquer les migrations existantes. Pour valider une migration, applique-la sur une base de test vide et relance la commande pour vérifier la réexécution.
- Pour tester les inscriptions et l’approbation, utilise un PostgreSQL 17 de test et un Jellyfin 12.4 neuf dans des conteneurs isolés. Applique les migrations en pointant `DATABASE_URL` vers la base de test, renseigne `HOLLYFILMS_TEST_DATABASE_URL` et `HOLLYFILMS_TEST_JELLYFIN_URL`, puis lance `corepack yarn test:accounts`. Le test initialise cette instance Jellyfin et simule Google. Pour valider Google en conditions réelles, utilise un compte de test et l’origine exacte de `PUBLIC_ORIGIN` conformément au [README](README.md#activer-google).

## Vérifications avant livraison

- `corepack yarn lint` et `corepack yarn format:check` vérifient le code et le format.
- `corepack yarn build` vérifie et compile le web et l’API. `corepack yarn build-storybook` vérifie le build des stories.
- `corepack yarn test` vérifie l’accès à l’API publique Jellyfin 12. Lance `corepack yarn test:accounts` avec les services isolés si le changement concerne les comptes ou les migrations.
- Indique les commandes exécutées, les parcours vérifiés via MCP et les vérifications encore en attente.

## Lecteur HollyFilms

Le lecteur se trouve dans `apps/web/src/PlaybackPlayer.tsx`, `apps/web/src/playback` et les composants UI associés. Il utilise le SDK Jellyfin, le HTML vidéo et hls.js avec son worker Vite. Garde le jeton de session utilisateur côté navigateur et les clés serveur côté API. Les rapports d’arrêt et les changements de flux préservent la progression.

Après un changement de lecture, lancer `corepack yarn test:player` avec Docker et Chrome. Le test lance son propre Jellyfin 12.4 et des médias synthétiques.
