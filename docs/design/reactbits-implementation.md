# HollyFilms — intégration React Bits

Livraison locale du 12 novembre 2026, sur la refonte déjà présente dans le workspace.

## Composition

| Zone                               | Adaptations intégrées                                              |
| ---------------------------------- | ------------------------------------------------------------------ |
| Vitrine                            | Dome Gallery passif, Light Rays, Gradual Blur                      |
| Textes                             | Rotating Text, Blur Text, Shiny Text                               |
| Accueil                            | Aurora, Animated Content                                           |
| Navigation                         | Staggered Menu, Flowing Menu, Gooey Nav                            |
| Affiches                           | Tilted Card, Spotlight Card, Glare Hover                           |
| Actions et authentification        | Magnet, Star Border ; réutilisation de Blur Text et Spotlight Card |
| Administration et menus du lecteur | Animated List, Count Up, Magic Bento                               |
| Confirmations réussies             | Click Spark                                                        |
| Volume                             | Elastic Slider contrôlé par la vidéo                               |

Les 21 entrées officielles ont été consultées via le MCP shadcn avec leurs URL complètes. Les sources TypeScript ont servi aux adaptations locales : shaders conservés, interfaces réduites, animations GSAP remplacées par Motion, icônes Lucide et sémantique native. Les origines, empreintes des sources et adaptations sont consignées dans [SOURCES.md](../../apps/web/src/components/reactbits/SOURCES.md), avec la [licence conservée](../../apps/web/src/components/react-bits.LICENSE.md).

Les shaders sont chargés à la demande. Paper Shaders a été retiré du workspace et du lockfile. Aucune dépendance GSAP ou gestuelle n'a été ajoutée. Le Dome ne propose ni glisser ni agrandir. Les bandes du menu utilisent les éléments du catalogue déjà reçus, leurs images authentifiées et le cache existant à 400 px.

## Animation et accessibilité

`components/reactbits/policy.ts` centralise couleurs, ressorts, durées et profondeur. `MotionEnvironment` propage la pause ; la visibilité de l'onglet, le mouvement réduit et l'intersection contrôlent les effets. Les pointeurs tactiles n'inclinent pas les cartes et n'attirent pas les boutons. Les zones cliquables restent fixes.

Les shaders dessinent au maximum à 30 images/s, indépendamment des ressorts de l'interface. Aurora est limité à 1,5 million de pixels ; Light Rays conserve le budget adaptatif officiel de 2,4 millions. Le fond statique reste présent sans WebGL. Une perte du contexte Aurora arrête sa boucle et révèle ce fond.

Le menu utilise un dialogue natif : focus contenu, fermeture par Échap ou clic extérieur, restitution du focus au déclencheur. Le volume conserve un véritable `input[type=range]`, sa valeur annoncée et les touches Home/End/flèches. Les confirmations lumineuses suivent uniquement la réussite des mutations.

La grille, la recherche, la pagination, les métadonnées, les favoris et les statuts vus sont conservés. Les transitions partagées restent limitées à artwork ↔ lecteur. Le lecteur n'attend aucune animation avant d'afficher une image décodée.

## Vérifications exécutées

- `corepack yarn lint` : aucune erreur ni avertissement.
- `corepack yarn format:check` : réussi.
- `corepack yarn build` : web et API compilés.
- `corepack yarn build-storybook` : réussi.
- `corepack yarn test` : 12 tests réussis, dont l'accès à l'API Jellyfin.
- `corepack yarn test:player` : réussi sur Jellyfin 12.4 isolé, médias synthétiques et Chrome. Vidéo décodée, audio, SRT, HLS, reprise, file d'épisodes, nouvelle tentative, lecture distante et SyncPlay. Le test vérifie désormais aussi le volume clavier réel et l'absence du shader pendant la lecture.
- Playwright : 95 stories parcourues avec succès ; 36 passages supplémentaires sur les interactions importantes en desktop, tactile et mouvement réduit. Formulaires, filtres/recherche/pagination, fermeture et focus des dialogues, favoris/vu, erreur sans étincelle, approbation/refus/nouvelle tentative et transitions artwork/lecteur.
- Formats 1440×900, 768×1024, 390×844, 320×568 et 844×390 : aucun débordement horizontal observé ; vitrine sans scroll. Contrôle supplémentaire des limites réelles des boutons et sections à 320 px pour détecter les débordements masqués.
- Dix cycles d'ouverture/fermeture du menu : un seul canvas après retour, deux callbacks RAF en attente pendant l'animation normale ; zéro canvas et zéro RAF après pause ou ouverture du lecteur.
- Mouvement réduit, WebGL indisponible, perte du contexte graphique et événement de visibilité simulé : fond statique et suspension/reprise vérifiés.
- MCP WebStorm : aucun diagnostic d'erreur sur les composants examinés. MCP Playwright sur Vite : `/api/health` et `/jellyfin/System/Info/Public` répondent 200, ouverture/fermeture de connexion et focus restauré, aucune erreur ou alerte console.

Les demandes d'inscription et les formulaires ont été exercés avec les données simulées de Storybook. Aucun compte réel n'a été approuvé ou refusé pour cette validation. Le SSO Google réel n'a pas été rejoué ; l'API, Prisma, les sessions et les règles d'approbation n'ont pas été modifiés. Les contrôles tactiles sont des émulations Chrome, pas des mesures sur téléphone physique. Les builds signalent les chunks existants de plus de 500 kB ; ce warning n'empêche pas leur compilation.

## Mesures et artefacts

Sur le média synthétique local, la lecture directe commence **192 ms après libération de la réponse de négociation**. Cela ne mesure pas le réseau, le transcodage ou le démarrage d'un média distant.

Comparaison indicative Chrome headless, story Accueil/Fond, viewport 1440×900, fenêtre de trois secondes :

| Compteur du thread principal |   Avant |    Après |
| ---------------------------- | ------: | -------: |
| TaskDuration                 | 11,5 ms | 115,3 ms |
| ScriptDuration               | 0,47 ms |  9,90 ms |
| LayoutDuration               |    0 ms |     0 ms |
| RecalcStyleDuration          | 0,12 ms |  5,61 ms |

Le shader ajoute du travail graphique et du thread principal ; cette mesure ne montre pas un gain de performance. Les valeurs restent dépendantes de la charge de la machine et ne mesurent pas le coût GPU ou une fréquence garantie sur mobile. Le contrôle déterminant pendant la lecture est l'arrêt effectif des décorations. Les instantanés mémoire ne sont pas comparables après navigation et ramasse-miettes ; aucune conclusion de fuite mémoire n'en est tirée.

Artefacts locaux dans `.playwright-mcp/` :

- `reactbits-before.zip` et `reactbits-after.zip` : traces Playwright.
- `reactbits-before.json`, `reactbits-after.json` : compteurs CDP.
- `reactbits-story-results.json`, `reactbits-extra-stories.json`, `reactbits-modes.json`, `reactbits-lifecycle.json` : résultats des parcours.
- `reactbits-public-desktop.png`, `reactbits-home-desktop.png`, `reactbits-menu-desktop.png`, `reactbits-menu-mobile.png`, `reactbits-admin-desktop.png`, `rb-landing-320.png` : captures représentatives.

Les services de développement et Storybook restent démarrés. Aucun déploiement externe n'a été effectué.
