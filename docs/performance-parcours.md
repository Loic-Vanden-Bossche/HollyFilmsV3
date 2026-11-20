# HollyFilms — mesures des parcours spectateur

Mesures du 20 novembre 2026. La référence est le commit `161bc4f` (v1.5.0). Les essais portent sur des builds de production locaux. Les seules observations sur le domaine public concernent les en-têtes HTTP des fichiers statiques.

La webapp utilise React 19.3, Vite 8.3, TanStack Query 5 et Motion 14. Le routeur maison repose sur History et `popstate`. Fastify et Prisma gèrent les comptes et les services applicatifs. Les requêtes médias authentifiées passent par le SDK Jellyfin et le proxy de même origine. Le lecteur utilise HTMLVideoElement, hls.js pour HLS et JASSUB pour les pistes ASS/SSA. Les mesures utilisent Playwright, le protocole DevTools de Chrome, Resource Timing et les compteurs de Jellyfin et du conteneur.

## Comment lire les mesures

Chaque paire utilise le même jeu de données, Chrome 157.0.8103.79 sur le même poste Windows (Core i9-14900KF, Radeon RX 7900 XTX) et le même profil par appareil. Ordinateur 1 440 × 900 à DPR 1 et mobile tactile **émulé** 390 × 844 à DPR 2. CPU ralenti ×3, latence CDP de 80 ms, téléchargement à 1,5 Mo/s. Envoi à 0,75 Mo/s pour la navigation et 1,5 Mo/s pour le lecteur. Les chiffres sont des médianes. Le premier passage dispose d’un contexte Chrome neuf. Le deuxième navigue de nouveau dans le même contexte, avec le cache HTTP du premier. Le cache React en mémoire repart avec le document. Le service worker est bloqué pour ces chronos et testé séparément en ligne et hors ligne.

- **Vitrine.** Sélection publique fixe de 18 titres et sept JPEG produits à partir des mêmes pixels. La mesure commence à la navigation. Elle s’arrête lorsque l’image centrale est décodée, son opacité et celle de sa transition atteignent 50 %, et le bouton reçoit les clics. L’ouverture du formulaire de connexion est vérifiée à chaque essai. Cinq paires par profil et version, dans un ordre alterné. Le banc reproduit la négociation HTTP des deux images web.
- **Catalogue.** 72 films déterministes, 12 reprises, images JPEG et réponses HTTP temporisées. Les deux versions utilisent gzip pour isoler les changements applicatifs. La première rangée est amenée à l’écran de manière identique. Toutes ses affiches visibles doivent être décodées et la première doit recevoir les clics. Trois paires par profil et version, avec alternance des builds. Pour la recherche, la réponse « Projection » arrive volontairement en retard. Le seul résultat de « Signal Test » doit rester affiché. Pour la fiche, on attend le bon titre et un bouton Lecture visible, actif et atteignable. Sur mobile, la mesure démarre à l’activation de la fiche depuis l’aperçu tactile. Les coordonnées du document, celles du carrousel et le focus sont contrôlés au retour.
- **Lecture.** Véritable Jellyfin 12.4 en conteneur et Chrome headless lancé avec le GPU désactivé par la suite lecteur. Film synthétique H.264 640 × 360 à 24 i/s, piste AAC française et même piste ASS anglaise. Départ à zéro, qualité automatique avec plafond de 120 Mb/s. La mesure va de l’événement de clic à `requestVideoFrameCallback`. Sur ordinateur, le banc survole Lecture, attend 350 ms, lit le compteur CPU du conteneur, puis déclenche le clic lorsque le bouton est atteignable. Sur mobile, le lecteur reçoit l’intention à l’appui. Chaque mode a été mesuré sur trois paires par profil et version. Chaque lecture est suivie pendant les quatre premières secondes. Le banc Vite Preview sert le même transport avant/après et isole ainsi le démarrage du lecteur de la compression NGINX.

## Résultats

Chaque cellule donne **froid / chaud, en millisecondes**. [Tous les essais individuels](performance-parcours-essais.csv) · [Traces réseau, CPU et lecture](performance-parcours-traces.zip).

| Parcours                         |       Avant |       Après | Conditions   |
| -------------------------------- | ----------: | ----------: | ------------ |
| Connexion utilisable             |  1164 / 244 |   706 / 240 | Ordinateur   |
| Connexion utilisable             |  1176 / 250 |   700 / 258 | Mobile émulé |
| Affiche centrale                 |  1814 / 503 |  1106 / 419 | Ordinateur   |
| Affiche centrale                 |  1808 / 506 |  1091 / 440 | Mobile émulé |
| Première rangée                  | 2175 / 1744 | 1935 / 1528 | Ordinateur   |
| Première rangée                  | 1902 / 1645 | 1727 / 1449 | Mobile émulé |
| Dernière recherche               |   459 / 451 |   323 / 319 | Ordinateur   |
| Dernière recherche               |   461 / 443 |   323 / 315 | Mobile émulé |
| Affiche → fiche utilisable       |   416 / 741 |   345 / 596 | Ordinateur   |
| Affiche → fiche utilisable       |   616 / 635 |   666 / 593 | Mobile émulé |
| Lecture directe → première image |   964 / 745 |   663 / 495 | Ordinateur   |
| Lecture directe → première image |   924 / 655 |   668 / 477 | Mobile émulé |
| Incrustation → première image    | 1877 / 1607 | 1462 / 1223 | Ordinateur   |
| Incrustation → première image    | 1872 / 1620 | 1403 / 1282 | Mobile émulé |

## Ce que montrent les traces

- **Ouverture de la vitrine.** Le serveur public envoyait le JavaScript principal (456 030 octets) et libass (2 191 920 octets) en identité, même avec `Accept-Encoding: gzip`. Le build Docker prépare les variantes gzip de JS, CSS, TTF, SVG et Wasm. NGINX négocie sous `/assets/` et renvoie `Vary: Accept-Encoding`. Le JavaScript du premier affichage public passe de 926 à 298 ko transférés. La sélection est demandée depuis le document, la police est découverte avant React et seule l’affiche centrale a la priorité haute. Les sept JPEG du banc passent au total de 557 à 178 ko. La vitrine conserve son orbite, sa composition à sept affiches, la pause et le mode mouvement réduit.
- **Accueil connecté.** La référence attendait la réponse de `/Users/Me` pour commencer à télécharger le code de la page. Le navigateur donne la priorité à la requête d’identité et commence à charger le code du catalogue. Une fois l’identité acceptée, les titres en cours de lecture et les nouveautés sont demandés en parallèle, avant le montage de l’accueil. Les deux rangées s’affichent indépendamment. Leurs observateurs réutilisent les requêtes en cours. La reprise est demandée une seule fois dans chacun des douze parcours optimisés. Les images des cartes utilisent des paliers fondés sur leur largeur et le DPR. L’observation de proximité et de taille est partagée entre les cartes. Les rayons lointains diffèrent leur rendu. Le panneau de gestion des sous-titres est chargé lorsqu’il est ouvert.
- **Navigation et recherche.** Pour une vignette affichée à 308 px sur ordinateur, la requête passe de 640 à 320 px (67 052 à 15 944 octets sur le JPEG témoin). Sur mobile à DPR 2, les 177 px affichés utilisent un fichier de 400 px (30 032 octets). La carte fournit immédiatement les données de départ de sa fiche. La navigation et la requête de détails commencent au clic, pendant que View Transitions capture le visuel sortant. Les callbacks stables évitent de recalculer les cartes inchangées pendant cette transition. La clé TanStack correspond à la saisie courante, le délai de regroupement est de 120 ms et les requêtes reçoivent un signal d’annulation. Sur le même appareil, changer de jeton crée un nouveau client de requêtes. Une réponse de l’ancien compte arrivée tardivement reste attachée à son ancien client. Une transition d’image en cours est également annulée lors du changement de compte.
- **Lecture.** Seul le survol, le focus ou l’appui sur une commande Lecture prépare le module du lecteur. Un lien direct le demande dès l’ouverture. Le même chargement sert au préchargement et au montage. La négociation du flux peut commencer avant la récupération des chapitres, des segments et de la file. hls.js, JASSUB et les décodeurs de sous-titres restent conditionnels. L’adresse du média et la piste sélectionnée sont vérifiées dans `PlaybackInfo` et le mode dans `Sessions/Playing`.

### Où le temps est gagné et où il reste à gagner

1. À la première visite, la vitrine gagne 0,71 s sur ordinateur et 0,72 s sur mobile émulé pour afficher l’affiche centrale et rendre le bouton utilisable. Le transfert des fichiers statiques domine ce gain. Le résultat en production dépendra du réseau et du cache du visiteur.
2. Sur la première rangée froide, l’ordinateur gagne 240 ms et le mobile 175 ms. La plus longue tâche du montage sur ordinateur passe néanmoins de 147 à 242 ms. Les cartes sont utilisables plus tôt, mais cette tâche peut encore interrompre une animation.
3. Sur mobile froid, la requête de fiche démarre 97 ms après le clic, contre 339 ms auparavant. La navigation change l’URL en 4 ms. Le bouton Lecture devient pourtant utilisable en 666 ms contre 616 ms. Le recalcul des styles durant l’animation passe de 85 à 154,5 ms et le layout de 52,5 à 77,4 ms. C’est la priorité pour la prochaine passe. Sur ordinateur froid, la requête démarre à 37 ms contre 246 ms et le bouton devient utilisable 71 ms plus tôt.
4. La recherche gagne entre 128 et 138 ms selon le profil. Le module du lecteur (43 ko transférés à froid) est demandé sur intention. Le premier lancement du film en lecture directe gagne 301 ms sur ordinateur et 256 ms sur mobile émulé à froid. À chaud sur mobile, les médianes passent de 655 à 477 ms.
5. Au premier usage de l’ASS, la compression économise environ 0,84 s sur le téléchargement et la compilation du module isolé. La fréquence de ces parcours en production n’a pas été mesurée.

Les 12 retours depuis une fiche du build candidat ont conservé la position horizontale, la position verticale et le focus. Quatre contrôles supplémentaires avec mouvement réduit couvrent Entrée au clavier, activation tactile émulée et retour par l’historique. Les deux axes sont restaurés au pixel. Les scénarios Storybook passent pour la [transition aller-retour](http://127.0.0.1:6006/iframe.html?id=ui-transitions-des-images--shared-artwork&viewMode=story) et [l’image décorée](http://127.0.0.1:6006/iframe.html?id=ui-transitions-des-images--decorated-hero&viewMode=story). En déplaçant la fenêtre de Chrome entre deux écrans virtuels à DPR 1 et 2, une carte de 180 px garde la même largeur et passe de 240 à 400 px source, puis revient à 240 px.

### Fichiers et vérifications

| Domaine                             | Fichiers principaux                                                                                                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distribution des fichiers statiques | [Dockerfile web](../apps/infrastructure/docker/Dockerfile), [NGINX](../apps/infrastructure/docker/nginx.conf.template)                                                                                         |
| Vitrine et dérivées d’affiches      | [Document HTML](../apps/web/index.html), [CatalogueGallery](../apps/web/src/ui/CatalogueGallery.tsx), [route Fastify](../apps/api/src/showcase.ts)                                                             |
| Accueil, recherche et cache         | [App](../apps/web/src/App.tsx), [requêtes des rangées](../apps/web/src/home-queries.ts), [HomeScreen](../apps/web/src/HomeScreen.tsx), [MediaArtwork](../apps/web/src/ui/MediaArtwork.tsx)                     |
| Fiche et transition                 | [ArtworkHero](../apps/web/src/ui/ArtworkHero.tsx), [routeur](../apps/web/src/use-app-route.ts), [MediaDetails](../apps/web/src/ui/MediaDetails.tsx)                                                            |
| Démarrage et pistes                 | [PlaybackPlayer](../apps/web/src/PlaybackPlayer.tsx), [négociation Jellyfin](../apps/web/src/playback/playback-api.ts), [rendu conditionnel des sous-titres](../apps/web/src/playback/use-player-subtitles.ts) |

La suite de comptes utilise PostgreSQL 17.12 et Jellyfin 12.4 isolés. L’inscription en attente ne reçoit pas de session, l’appel anonyme à `/Items` renvoie 401 et la session approuvée peut lire le catalogue. Le test navigateur change de compte entre deux onglets qui partagent le même appareil, avec une affiche encore en vol. Il contrôle l’identité du pixel rendu, une seconde origine, la déconnexion, le rechargement et le jeton refusé. La vitrine publique continue à servir sa sélection autorisée.

Les builds web/API et Storybook, le lint, le format, les 53 tests web et les suites vitrine, comptes, PWA, sous-titres et lecteur ont été exécutés. Les conteneurs de production sont construits localement et testent les deux représentations HTTP d’un même script, les migrations, Range et WebSocket. Terraform est validé avec le backend désactivé. Les 13 scénarios avec provider simulé passent sur une copie des fichiers suivis, isolée des variables automatiques de production présentes sur ce poste.

### Lecture des traces Chrome

Entre le clic sur une affiche et le bouton Lecture utilisable, les événements du thread principal sont mesurés par CDP. Les classes peuvent se recouvrir et ne doivent pas être additionnées.

| Mobile ou ordinateur à froid                     |  Avant |  Après |
| ------------------------------------------------ | -----: | -----: |
| Ordinateur, script                               | 269 ms | 193 ms |
| Ordinateur, recalcul des styles                  |  65 ms |  61 ms |
| Ordinateur, layout                               |  45 ms |  37 ms |
| Ordinateur, peinture                             |  10 ms |   6 ms |
| Ordinateur, JS transférés avant la rangée        | 379 ko | 375 ko |
| Ordinateur, images transférées avant la rangée   | 335 ko | 320 ko |
| Mobile émulé, script                             | 430 ms | 417 ms |
| Mobile émulé, recalcul des styles                |  85 ms | 154 ms |
| Mobile émulé, layout                             |  52 ms |  77 ms |
| Mobile émulé, peinture                           |  11 ms |  14 ms |
| Mobile émulé, JS transférés avant la rangée      | 379 ko | 375 ko |
| Mobile émulé, images transférées avant la rangée | 164 ko | 186 ko |

### API réelle

Avec Fastify, PostgreSQL 18.7 et Jellyfin 12.4, trois remplissages du cache de la sélection de 18 films, séparés par son expiration de 60 secondes, donnent **17,62 ms côté Fastify à froid et 0,45 ms à chaud**. Sur la boucle locale, la requête complète prend 19,18 et 1,28 ms. Le premier appel du processus a pris 58 ms côté Fastify. La même affiche réelle pèse 18 981 octets à 400 px, 8 025 à 240 px et 5 055 à 160 px. Ces valeurs décrivent le serveur de laboratoire. Les temps de la vitrine et du catalogue synthétiques incluent leur propre réseau et leurs propres images.

### WebAssembly et sous-titres

Le lecteur possède déjà un chemin local ASS/SSA avec JASSUB/libass et un repli par incrustation Jellyfin. Le banc impose les paramètres du repli dès la négociation pour comparer les deux modes à partir du même clic. Le flux en lecture directe garde la vidéo H.264 et la piste AAC originales. En incrustation, Jellyfin signale que la vidéo est réencodée et que l’audio est copié. Les pixels de la couche ASS locale sont vérifiés et aucun worker JASSUB ne démarre en mode incrusté. Le test fonctionnel actionne également le vrai bouton de repli après une erreur de rendu. La négociation annonce alors la capacité Encode et précise la source pour respecter une langue différente du choix par défaut. Un lien HLS sans source explicite est renégocié seulement si Jellyfin propose d’autres pistes que celles demandées.

À froid sur mobile émulé, le rapport de session confirme **DirectPlay en 668 ms** et **Transcode en 1 403 ms** pour la même piste incrustée. À chaud, les valeurs sont 477 et 1 282 ms. Du clic à quatre secondes de lecture, le cgroup Jellyfin consomme 202 et 6 952 ms de CPU à froid, puis 164 et 6 898 ms à chaud. Ces chiffres cumulent le temps CPU des cœurs.

Aucune remise en mémoire tampon après la première image sur les 48 lectures. En lecture directe mobile, les trois essais froids totalisent 3 sur 317 images perdues avant et 3 sur 316 après. À chaud, 1 sur 318 puis 1 sur 316. Le repli incrusté du build final perd 2 sur 315 images à froid et 0 sur 315 à chaud. Les deux variantes gardent la définition, la langue audio et la piste de sous-titres sélectionnées.

Le premier POST de négociation part à 244 ms du clic contre 539 ms auparavant sur ordinateur froid. Sur mobile froid il passe de 507 à 251 ms. Sur mobile chaud, la somme médiane des tâches de plus de 50 ms entre le clic et la première image passe de 68 à 151 ms. Après la réponse de négociation, la première image prend encore 294 ms en DirectPlay et 1096 ms en HLS avec incrustation sur mobile froid. Ce délai mérite une mesure sur téléphone physique.

**Livraison du module seul.** Avec le même binaire moderne libass, contrôlé par SHA-256, les deux images NGINX locales transfèrent 2 191 920 et 920 366 octets à froid. Sur mobile émulé, le téléchargement et la compilation passent de **1 600 à 760 ms** (trois paires). La compilation prend 4,6 ms dans les deux versions. À chaud, le cache évite tout transfert, le total passe de 27 à 36 ms. Ce test isolé est distinct du temps de lancement du film, qui peut présenter une image avant que le module de sous-titres soit prêt.

**Décalage manuel.** Cinq comparaisons sur 1 800 répliques WebVTT et une timeline de deux heures. Mesure du geste jusqu’à la deuxième frame d’interface suivant la mise à jour des véritables `VTTCue`. Le navigateur vérifie les bornes et le texte affiché. Les résultats incluent téléchargement, compilation, messages et application au `TextTrack`.

| Implémentation               | Ordinateur froid / chaud | Mobile émulé froid / chaud |
| ---------------------------- | -----------------------: | -------------------------: |
| JavaScript existant          |           20,8 / 19,4 ms |             19,9 / 19,5 ms |
| Wasm sur le thread principal |          129,0 / 19,1 ms |            134,7 / 20,1 ms |
| Wasm dans un Web Worker      |          239,6 / 34,2 ms |            239,8 / 21,1 ms |

Le noyau expérimental pèse 297 octets. Son instanciation prend moins d’une milliseconde, mais son chargement à froid ajoute environ un aller-retour réseau. Le worker ajoute le chargement de son script et l’échange des valeurs. L’écriture des répliques natives reste sur le thread principal. Le lecteur conserve sa correction manuelle en JavaScript. Ces prototypes tournent uniquement dans les tests.

Trois mesures par profil et cache donnent des médianes sensibles à la variation du navigateur. Une répétition indépendante avec le même code du lecteur a donné 615 ms à froid et 663 ms à chaud en DirectPlay mobile. Les fichiers player-release.json et player-release-burn.json de l’archive conservent cette répétition. Le tableau principal utilise le même répertoire de production que les autres parcours.

## Reproduire

Depuis la racine, avec Node 24, Corepack, Chrome et Docker. Construire la référence dans un second worktree. Conserver le script de mesure candidat pour **les deux** builds. Dans les exemples PowerShell, `$avant` et `$apres` désignent les chemins absolus vers les deux répertoires Vite `dist`.

```powershell
git worktree add --detach ../hollyfilms-ref-161bc4f 161bc4f
Push-Location ../hollyfilms-ref-161bc4f
corepack yarn install --immutable
corepack yarn build:web
$avant = (Resolve-Path apps/web/dist).Path
Pop-Location
corepack yarn build
$apres = (Resolve-Path apps/web/dist).Path
node apps/web/tests/landing-journey.mjs $avant landing.json $apres
$env:CATALOGUE_COMPARE_DIST = $apres
node apps/web/tests/catalogue-journeys.mjs $avant catalogue.json 3
Remove-Item Env:CATALOGUE_COMPARE_DIST
$env:CATALOGUE_REDUCED = $env:CATALOGUE_KEYBOARD = $env:CATALOGUE_BACK = '1'
node apps/web/tests/catalogue-journeys.mjs $apres catalogue-mouvement-reduit.json 1
Remove-Item Env:CATALOGUE_REDUCED, Env:CATALOGUE_KEYBOARD, Env:CATALOGUE_BACK
node apps/web/tests/session-isolation.e2e.mjs $apres
corepack yarn workspace @hollyfilms/web exec node tests/artwork-density.e2e.mjs
foreach ($build in @($avant, $apres)) {
  $env:HOLLYFILMS_PLAYER_PERF = $build
  $env:HOLLYFILMS_PERF_OUTPUT = Join-Path (Split-Path $build) 'lecture-mesures.json'
  corepack yarn test:player
}
Remove-Item Env:HOLLYFILMS_PLAYER_PERF, Env:HOLLYFILMS_PERF_OUTPUT
$env:HOLLYFILMS_PLAYER_PREVIEW = '1'
corepack yarn test:player
corepack yarn workspace @hollyfilms/api exec node tests/requests.e2e.mjs tests/showcase-performance.mjs
corepack yarn workspace @hollyfilms/web exec node tests/benchmarks/subtitle-timing/run.mjs
```

Pour les contrôles du dépôt, exécuter `corepack yarn lint`, `corepack yarn format:check`, `corepack yarn test`, `corepack yarn build-storybook`, `corepack yarn test:pwa` et `corepack yarn test:subtitle-sync`. La suite `corepack yarn test:accounts` utilise les deux services de test indiqués dans [le guide du projet](../AGENTS.md). La commande `corepack yarn workspace @hollyfilms/api exec node --test tests/showcase.test.ts` vérifie les largeurs autorisées de la sélection publique.

Le banc de calcul requiert également FFmpeg, Clang avec cible `wasm32` et `wasm-ld`. Pour mesurer le transport du module indépendamment du film, construire les deux images web et passer leurs noms au script `node apps/web/tests/benchmarks/wasm-transport.mjs <image-avant> <image-après> transport.json`. Les images de test et la suite `test:infrastructure` sont décrites dans [le guide infrastructure](../apps/infrastructure/README.md).

Pour un téléphone réel, servir le build de test et le même média sur une origine HTTPS accessible au téléphone. Utiliser le même compte approuvé, l’audio français, l’ASS anglais et la qualité automatique. Refaire une lecture après nettoyage des données du site puis une seconde sans nettoyage. Relever la première image par rVFC, `getVideoPlaybackQuality()`, les événements `waiting` après démarrage et le mode de la session dans Jellyfin. Les mesures ci-dessus ne couvrent ni un décodeur mobile physique, ni une charge serveur de production, ni un long métrage UHD.
