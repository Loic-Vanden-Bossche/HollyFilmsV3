# Fluidité — mesure du 12 novembre 2026

La passe conserve la densité du catalogue, le relief 3D sans agrandissement,
les surfaces en verre et les transitions artwork ↔ lecteur.

## Changements

- Cartes : mesures du pointeur mises en cache et invalidées au scroll/resize,
  événements regroupés par frame, reflets déplacés par `transform` plutôt que
  recalculés en dégradés à chaque mouvement. La perspective et les calques
  décoratifs sont libérés au repos après leur transition de sortie.
- Grille : `content-visibility: auto` évite le rendu des surfaces hors écran.
  La hauteur réservée conserve le ratio des affiches et le pied de carte ; les
  cartes actives ou focalisées retrouvent leur rendu complet.
- Images : suppression du calcul de layout Motion sur chaque `MediaArtwork` et
  mémorisation du composant. Le cache authentifié, les fallbacks et le système
  de transition vers/depuis le lecteur restent en place.
- Galerie publique : orbite animée via les keyframes natives du navigateur,
  sans horloge JavaScript mettant à jour sa rotation à chaque frame. Pause,
  visibilité, mouvement réduit et nettoyage sont conservés.
- Politique d'animation : abonnements de visibilité et de type de pointeur
  partagés entre composants.
- Lecteur : timeline isolée des autres commandes ; position et heure de l'aperçu
  via Motion values. React actualise l'aperçu quand sa vignette change, sans
  refaire tous les boutons à chaque mouvement. La recherche conserve son retour
  immédiat et son animation.

## Résultats

Chrome 157.0.8103.51 headless, AMD Radeon RX 7900 XTX, viewport 1440 × 900,
DPR 1, Storybook **compilé**, CPU ralenti ×4 via CDP. Trois passages de quatre
secondes après chargement. Les valeurs ci-dessous sont les médianes.

La cadence mesure les callbacks `requestAnimationFrame`, pas les images
physiquement présentées par l'écran. Ces scénarios courts sur données simulées
servent à détecter les régressions ; ils ne garantissent pas un débit sur tout
matériel, avec toute bibliothèque ou pendant le décodage de toute vidéo.

| Scénario                                   | Cadence avant → après | Intervalle p95 avant → après | JS sur 4 s avant → après |
| ------------------------------------------ | --------------------- | ---------------------------- | ------------------------ |
| Catalogue, survol d'une grille de 64 films | 24,25 → 65,5/s        | 50,1 → 16,8 ms               | 172 → 299 ms             |
| Vitrine animée                             | 117,75 → 118,25/s     | 8,5 → 8,5 ms                 | 579 → 489 ms             |
| Déplacement sur la timeline                | 92,25 → 119,75/s      | 16,8 → 8,5 ms                | 2 533 → 1 515 ms         |

Le catalogue traite davantage de frames et d'événements après optimisation ;
son temps JS total augmente donc malgré une baisse du coût par frame. Le coût
dominant initial était la composition des calques : la première trace compte
94 événements `Layerize` totalisant 2 403 ms, contre 342 événements totalisant
1 478 ms après optimisation. Les intervalles supérieurs à 33,5 ms passent de
81 à 1 par passage médian.

La cadence du catalogue varie de 65,25 à 85,25/s entre les passages optimisés :
la charge de la machine reste une source de variation. Sans ralentissement CPU,
le même scénario atteint 119,5–120/s sur ce poste, sans intervalle supérieur à
33,5 ms ni tâche longue dans les trois passages.

Les résultats bruts et les traces CDP sont conservés localement, hors Git, dans
`.playwright-mcp/performance-before*.json`, `performance-after*.json` et
`performance-native*.json`.

## Reproduire

Depuis la racine, construire puis servir le Storybook de production :

```powershell
corepack yarn build-storybook
corepack yarn workspace @hollyfilms/web exec vite preview --outDir storybook-static --host 127.0.0.1 --port 6007 --strictPort
```

Dans un autre terminal, sans build/test concurrent et en fermant les autres
aperçus animés :

```powershell
$env:PERF_OUTPUT = '.playwright-mcp/performance-latest.json'
$env:PERF_ROUNDS = '3'
$env:PERF_CPU = '4'
node apps/web/tests/animation-performance.mjs
```

`PERF_SCENARIO` permet de sélectionner `catalogue`, `landing` ou `timeline`.
`PERF_CPU=1` retire le ralentissement. `PERF_BASE_URL` change l'origine du
Storybook compilé. Le script utilise Chrome installé et conserve une trace par
scénario, au premier passage. Comparer les mêmes paramètres et le même contenu.

## Vérifications

- `corepack yarn lint`, `format:check`, `build`, `build-storybook`, `test`.
- `corepack yarn test:player` : Jellyfin 12.4 isolé, vidéo décodée, audio, SRT,
  HLS, reprise, file d'épisodes, reprise après erreur, contrôle distant et SyncPlay.
  Premier décodage local 839 ms après libération de la négociation dans ce test.
- Stories : cartes, lecture au survol et clavier, erreurs des actions, aperçus
  de timeline, sauts pendant chargement, pause/reprise de la galerie répétée
  trois fois sans accumulation d'animations, artwork ↔ lecteur lent/rapide,
  absence de transition partagée carte ↔ fiche.
- Responsive cartes : desktop, 768 × 1024, 390 × 844, 320 × 568, 844 × 390 et
  mouvement réduit ; dimensions stables au survol, aucun débordement horizontal.
- Grille longue : hauteur de document identique (5 076 px sur le viewport testé)
  avant/après un aller-retour jusqu'à la dernière carte.
- Vitrine réelle sur Vite via MCP Playwright : aucun scroll aux cinq tailles
  1440 × 900, 768 × 1024, 390 × 844, 320 × 568 et 844 × 390. La pause utilisateur
  suspend l'animation native et retire le canvas ; le mouvement réduit suspend
  également l'orbite après reprise de la pause utilisateur.

Les parcours connectés ont été exercés dans les fixtures Storybook et le test
lecteur isolé ; la bibliothèque personnelle n'est pas authentifiée dans le
profil Playwright. Les avertissements Vite de chunks dépassant 500 kB subsistent.

## Ouverture et arrivée du catalogue — 12 novembre 2026

Le bouton « Passer l’introduction » est retiré à la demande de l’utilisateur.
L’ouverture conserve sa durée de 1,2 seconde ; le scroll, les commandes et la
préférence de mouvement réduit restent disponibles immédiatement.

- `DeferredMediaTile` réserve chaque emplacement avec sa hauteur exacte, puis
  monte les images, gestes et commandes à 240 px du viewport. Le titre reste un
  bouton accessible hors écran ; le focus est transféré à la carte si le clavier
  y arrive avant le scroll. Les cartes déjà montées ne sont pas démontées au scroll.
- Les transformations de l’ouverture et du hero utilisent des keyframes
  `transform` complètes pour permettre la composition native pendant le travail
  JavaScript. Le zoom du grand backdrop ne recalcule plus de filtre de flou.
- La résolution du backdrop suit la largeur et la densité de l’écran, zoom compris,
  par paliers de cache jusqu’à 3840 px. Les écrans ordinaires ne décodent plus
  systématiquement une image 4K. Les logos conservent leur résolution existante.
- Le tableau des slides et les callbacks de lecture sont stabilisés afin de ne
  pas relancer le chronomètre et les cartes lorsque l’introduction se termine.

Mesure avec Storybook compilé, Chrome headless, 1440 × 900 : une réponse simulée
livre 36 titres et 3 reprises après 400 ms, pendant l’introduction. Trois passages,
CPU ×4, mêmes données avant/après ; valeurs médianes :

| Mesure                                   | Avant   | Après   |
| ---------------------------------------- | ------- | ------- |
| Plus longue tâche JS pendant l’ouverture | 482 ms  | 238 ms  |
| Intervalle rAF p95 pendant l’ouverture   | 85,1 ms | 33,3 ms |
| Intervalle rAF p95 après l’ouverture     | 25 ms   | 8,4 ms  |
| Cartes complètes montées sans scroll     | 39      | 3       |

Sans ralentissement CPU, les trois passages optimisés n’enregistrent aucune tâche
JS longue pendant l’ouverture ni après ; l’intervalle rAF p95 médian vaut 11,6 ms
pendant l’ouverture et 8,4 ms ensuite. Des intervalles isolés restent plus longs
au démarrage à froid. Ces mesures sur fixtures ne garantissent pas l’absence de
frames perdues sur tout appareil ou pendant le décodage des médias réels.

Reproduire après `build-storybook` et démarrage de l’aperçu sur 6007 :

```powershell
$env:PERF_CPU = '4'
$env:PERF_OUTPUT = '.playwright-mcp/intro-performance.json'
node apps/web/tests/intro-performance.mjs
```

Les résultats de comparaison sont conservés dans `.playwright-mcp/intro-before.json`,
`intro-after.json` et `intro-native.json`. Les contrôles navigateur couvrent les
cartes différées, lecture au survol, favoris/vu, recherche, navigation immersive,
focus clavier et hauteur de page inchangée après aller-retour dans le catalogue
(5 076 px sur les 64 titres correspondant au filtre Films de la fixture de 96 titres).

## Catalogue virtualisé et pagination progressive — 13 novembre 2026

`VirtualMediaGrid` utilise TanStack Virtual avec le scroll natif de la fenêtre.
Les colonnes et espacements viennent de la grille responsive existante ; seules
les rangées visibles, deux rangées de marge et la rangée portant le dernier focus
restent montées. La hauteur totale est réservée et les rangées sont mesurées.
Le focus reste disponible pour le retour des fiches et du lecteur. Cette stratégie
remplace la conservation de toutes les cartes après leur première apparition.

`DeferredMediaTile` et `MediaArtwork` conservent le chargement différé des images
authentifiées et leurs caches. Les cartes éloignées sont démontées, leurs ressources
visuelles libérées ; les métadonnées des pages restent dans TanStack Query pour
permettre le retour en arrière sans recharger le catalogue.

À 800 px de la fin, `CatalogueLoadTrigger` demande la page suivante de 36 titres.
Une même page ne déclenche pas plusieurs requêtes simultanées. Le chargement
automatique s'arrête en cas d'erreur, à la fin du catalogue, dans un onglet caché,
pendant une fiche, le menu immersif ou la lecture. Le bouton manuel et « Réessayer »
restent disponibles. Le hero et les reprises, déjà limités à 20 et 12 titres,
conservent leur fonctionnement. La recherche du navigateur ne voit que les titres
montés ; la recherche HollyFilms continue d'interroger tout le catalogue autorisé.

Contrôles Playwright via MCP sur les fixtures Storybook :

- 1 000 titres à 1440 × 900 : 34 à 54 emplacements montés aux positions mesurées
  après navigation au clavier, contre 1 000 emplacements auparavant ; hauteur
  stable de 71 160 px pendant les allers-retours. 120 appuis sur Tab atteignent
  bien le titre 121, sans perdre le focus.
- Tests début/milieu/fin et retour en haut aux formats 768 × 1024, 390 × 844,
  320 × 568 et 844 × 390 : aucune erreur d'interaction ni débordement horizontal.
  Même parcours validé avec mouvement réduit, et redimensionnement desktop/mobile.
- Pagination intégrée sur 108 titres : chargement automatique, erreur de la
  troisième page, reprise manuelle, absence de doublon et arrêt à la dernière page.
- Ouverture, arrivée différée des données, recherche/filtres, lecture depuis les
  cartes, favoris/vu et trois cycles lecteur → fiche → accueil validés.

Ces mesures portent sur le DOM, pas sur une garantie de fréquence d'affichage.
Les contrôles `lint`, `format:check`, `build`, `build-storybook`, `test` (19 tests)
et `test:player` passent. Le test lecteur utilise Jellyfin 12.4 isolé et des médias
synthétiques ; la bibliothèque personnelle n'est pas authentifiée dans Playwright.
Les avertissements de taille de chunks Vite déjà présents subsistent.

## Profils adaptatifs

Le navigateur démarre en mode automatique avec le profil Équilibré. Les cinq
profils pilotent les effets réellement exécutés, sans modifier les droits d’accès
aux médias ni les réglages de qualité du lecteur.

| Profil    | Effets                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| Essentiel | Fond statique, mouvements physiques désactivés, surfaces opaques, une rangée de marge pour la grille virtuelle.         |
| Léger     | Fond statique, fondus courts, verre limité à 4 px, aucune inclinaison au pointeur.                                      |
| Équilibré | Fond CSS animé, profondeur des cartes à 50 %, verre à 8 px, deux rangées de marge, shaders et aperçus vidéo désactivés. |
| Élevé     | Shaders à DPR 0,85 avec une couche Aurora, profondeur à 80 %, verre à 16 px, aperçus vidéo.                             |
| Ultra     | Shaders à DPR 1 avec deux couches Aurora, profondeur complète, verre à 24 px et trois rangées de marge.                 |

`apps/web/src/performance` contient les profils, le contrôleur et un seul collecteur
par application. Toutes les deux secondes, il publie la cadence rAF, le p95 des
intervalles entre images, la proportion d’intervalles supérieurs à 25 ms, le temps
de tâches longues et la latence maximale d’interaction. Les API PerformanceObserver
sont optionnelles. La latence entrée → prochaine image sert aussi de repli. Une
mesure absente s’affiche avec « — ». La cadence rAF mesure les possibilités de
rendu du navigateur, elle ne mesure pas directement l’utilisation du GPU.

Deux fenêtres actives lentes déclenchent une baisse, avec au moins quatre secondes
entre les changements. Une fenêtre est lente si son p95 dépasse 28 ms, si plus de
16 % des images dépassent 25 ms, si les tâches longues occupent plus de 15 % du
temps, ou si une interaction dépasse 200 ms. Une dégradation sévère peut retirer
deux niveaux. La remontée ajoute un seul niveau après quinze fenêtres actives
stables et au moins trente secondes depuis le dernier changement. Les mesures
de démarrage, les périodes masquées, les périodes sans activité ni décoration
animée et la lecture vidéo sont exclues des décisions. Les écouteurs, observers
et la boucle rAF sont nettoyés au démontage. Le mouvement réduit système reste
prioritaire, y compris en sélection manuelle.

Après vérification du rôle par Jellyfin, un bouton **Performances** permet aux
administrateurs de choisir Auto ou un des cinq profils. Les autres comptes
utilisent Auto. Une perte du rôle annule le choix manuel. Le graphe conserve
120 échantillons et 60 événements au maximum, uniquement en mémoire, avec le
profil actif, les changements et leurs raisons. Aucun appel réseau de télémétrie
n’est ajouté. Le choix Auto ou manuel est conservé dans `localStorage`, par
origine/serveur Jellyfin et identifiant de compte. Il est restauré uniquement
après vérification du rôle administrateur par Jellyfin. Un compte ordinaire
ne lit pas cette préférence et reste en Auto. La déconnexion et le nettoyage
React ne remplacent pas le choix enregistré. Un stockage bloqué ou une valeur
invalide laisse l’application fonctionner en Auto. Le profil calculé par Auto
et l’historique des mesures ne sont pas persistés.

Les tests du contrôleur couvrent dégradation, remontée, temporisations, exclusions,
mesures manquantes, contrôle admin et limites des historiques. Le test navigateur
avec une charge réelle du thread principal a mesuré un p95 de 109 ms et 75 % de
temps bloqué, puis un passage automatique Équilibré → Essentiel. Les cinq choix
manuels, la fermeture au clavier, le focus restauré, le format 390 × 844 et le
fonctionnement sans PerformanceObserver ont été vérifiés dans Storybook. Un test
de visibilité simulée confirme l’arrêt des mesures pendant la période masquée.

## Rechargement et contrôle Ultra — 17 novembre 2026

Le sélecteur privilégie le dialogue natif qui le contient, même en plein écran,
afin que ses options restent dans la couche interactive du dialogue. La fermeture
du panneau exige maintenant un geste commencé et terminé sur son fond : une
sélection ou un glissement commencé dans le panneau ne le ferme plus. Échap
ferme d’abord la liste ouverte, puis le panneau, avec restitution du focus.

Le profilage a été effectué avec le CLI Chrome DevTools fourni par WebStorm,
dans Chrome isolé headless, viewport 1440 × 900, DPR 1 et CPU ralenti ×4.
La session Chrome personnelle n’exposait pas le débogage distant. Les traces
portent donc sur la story **Ultra — catalogue de 96 titres**, compilée et
servie sur 6007, avec données simulées, sans réseau Jellyfin ni vidéo réelle.
Les mesures de la version de développement comportaient une forte surcharge
de débogage React ; elles ne sont pas utilisées comme référence de production.

Deux lectures synchrones au montage ont été corrigées : la grille attend la
première mesure de taille du navigateur avant d’activer sa virtualisation,
regroupe les lectures de géométrie par frame et conserve les styles de grille
tant que sa largeur reste identique. L’accueil ne lance plus un `scrollTo(0)`
au montage ; ce retour en haut reste appliqué aux changements de destination.
Les animations, la navigation immédiate et le scroll natif restent disponibles.

Les traces initiales relevaient un recalcul forcé de 209 ms déclenché par la
grille. Dans la dernière trace, ses recalculs forcés sont limités à 8 ms ;
des recalculs importants restent déclenchés par l’instrumentation Storybook.
Ce déplacement du coût ne démontre pas une réduction équivalente du coût total
du premier rendu. Le CLS mesuré reste à 0.

Trois passages de huit secondes de scroll haut → catalogue → haut en Ultra :
avant, cadence rAF médiane 113,75/s et p95 médian 8,4 ms ; après, 102/s et
11,6 ms (97,5–114,125/s selon le passage). La variance ne permet pas de conclure
à un gain global de cadence : aucune promesse de FPS sur tous les appareils.
Les résultats et traces sont conservés localement dans le répertoire temporaire
Windows sous `hollyfilms-ultra-*`. La story permet de reproduire le contrôle.

Vérifications Playwright : Ultra puis Auto conservés après rechargement de
`/app` avec identité Jellyfin simulée ; liste dans le dialogue en plein écran ;
sélection, Échap, restitution du focus et vrai clic extérieur ; grille de
1 000 titres, arrivée de contenu au-dessus et animations d’introduction.
Les tests unitaires couvrent aussi l’isolation des comptes/serveurs et le
stockage invalide ou indisponible.

## Catalogue, images et lecture — 20 novembre 2026

Les deux versions ont été comparées dans Chrome avec les mêmes données et les
animations activées. Les valeurs de temps sont des médianes locales.

| Scénario                                                               |    Avant |    Après |
| ---------------------------------------------------------------------- | -------: | -------: |
| Montage React de 13 rangées, 89 emplacements                           | 29,65 ms |  9,50 ms |
| Du montage à la deuxième frame du navigateur                           | 43,55 ms | 21,40 ms |
| Cartes complètes au premier affichage                                  |       89 |       25 |
| Éléments DOM dans ces rangées au premier affichage                     |    1 542 |      654 |
| Requêtes d’image pour 12 fonds et 48 vignettes reprenant ces fonds     |       24 |       12 |
| Octets transférés pour ces images JPEG de test                         |  421 536 |  335 088 |
| Textes de sous-titres extraits au chargement et au premier déplacement |    1 803 |        2 |
| Mutations DOM dans les commandes masquées, sur 8 s de lecture          |      286 |        0 |

La vitrine publique avec le bouton Google a transféré **368 570 octets** de
ressources au lieu de **468 919**. Sur `/app/movies`, le JavaScript et le CSS
transférés pour afficher le catalogue passent de **465 286 à 423 676 octets**.
Le code du lecteur se charge à la demande, en parallèle des données du film.
Dans ce scénario, la première carte sélectionnable est apparue après **1 633 ms**
contre **1 693 ms** auparavant.

Ces mesures d’ouverture comparent cinq passages alternés par version, sur des
builds de production servis en gzip, dans des contextes Chrome neufs à 1 366 × 850. Le réseau simulé fournit 500 ko/s avec 60 ms de latence et le CPU est
ralenti d’un facteur deux. Le catalogue contient un film de test. La police et
les réponses des services sont servies localement. Les octets proviennent de
`PerformanceResourceTiming.encodedBodySize`, avec le service worker désactivé
pour mesurer une première visite.

Les rangées ont été mesurées en version de production sur huit passages par
version à 1 440 × 900. Elles gardent la même hauteur de page de 4 082 px et
montent les cartes complètes à proximité du viewport ou dès la première
interaction. Une rangée visitée reste montée pour le retour au catalogue.
La grille conserve aussi son index pendant le défilement. Sur vingt déplacements
avec 1 000 titres, les lectures d’identifiants ont diminué d’environ 91 %.

Le test d’images affiche d’abord douze fonds de 960 px, puis quarante-huit
vignettes de 320 px. Le cache réutilise le fond déjà décodé pour la vignette du
même titre. Le nombre d’URL de blob créées pendant ce parcours passe de 108 à 12. Le gain réseau dépend des titres et des résolutions déjà en cache.

Le test de lecture utilise une vidéo de deux heures et une piste WebVTT de
1 800 répliques. Le lecteur extrait le texte des répliques actives pendant la
lecture et construit la transcription complète à l’ouverture de l’éditeur de
synchronisation. Les 30 événements de progression vidéo arrivent toujours
pendant les huit secondes où les commandes sont masquées.

Les stories `OffscreenKeyboard`, `OffscreenPointer`, `ThousandTitles` et
`ResolutionUpgrade` couvrent la première interaction, le maintien du focus
et le remplacement d’une image par une résolution supérieure.
`corepack yarn test:player` exerce le lecteur avec Jellyfin 12.4 et Chrome.
