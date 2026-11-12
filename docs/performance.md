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
