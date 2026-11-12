# Grandes fiches médias

## Inventaire des captures

| Fonction visible                              | Implémentation HollyFilms                                                                                                                                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grande fiche détaillée                        | Dialogue jusqu’à 1 560 px, défilement interne, navigation de sections et fermeture fixe ; versions mobile et paysage.                                                                                                                   |
| Synopsis, année, durée, classification, notes | Métadonnées réelles de la bibliothèque, durée en heures et minutes, note communautaire et pourcentage critiques.                                                                                                                        |
| Étiquettes                                    | Liste complète dépliable, sans tronquer les mots-clés.                                                                                                                                                                                  |
| Liens IMDb, TMDB et autres services           | Tous les liens externes fournis dans `ExternalUrls`, avec noms et URLs validées HTTP(S). Aucun lien de plugin ni identifiant de service n’est inventé.                                                                                  |
| Plateformes par pays                          | TMDB/JustWatch : logos, noms, abonnement, gratuit, publicité, location et achat. Pays France par défaut, réglage mémorisé par utilisateur.                                                                                              |
| Recherche et réglages des plateformes         | Recherche par nom et sélecteur de pays ; états vide, erreur, nouvelle tentative et intégration non configurée.                                                                                                                          |
| Ouverture d’une offre                         | Page de disponibilités fournie par TMDB. L’API ne fournit pas les liens directs de chaque plateforme.                                                                                                                                   |
| Critiques                                     | Avis TMDB et avis HollyFilms, compteur, auteur, date, provenance, note sur 10, texte complet avec « Lire la suite », carrousel, pagination et repli. Les avis externes sont affichés dans leur langue d’origine (requête TMDB `en-US`). |
| Écrire une critique                           | Texte, note facultative par demi-point ; modification et suppression de son propre avis avec confirmation. PostgreSQL impose un seul avis par utilisateur et média.                                                                     |
| Réalisation, scénario, studios, genres        | Listes issues des métadonnées du serveur, sans valeur de remplacement inventée.                                                                                                                                                         |
| Distribution et équipe                        | Portraits authentifiés, noms et rôles, navigation horizontale. Un clic ouvre les titres accessibles de cette personne, avec pagination.                                                                                                 |
| Scènes                                        | Images de chapitre, noms et temps ; clic pour lancer directement la lecture à ce temps. L’index serveur de chaque image est conservé dans le cache.                                                                                     |
| Collections                                   | Affiche, nombre de titres si fourni, année, langues si renseignées, favori/vu, exploration des membres et lecture de la collection en file.                                                                                             |
| Plus de ce genre                              | Recommandations autorisées par le serveur, carrousel et fiches navigables.                                                                                                                                                              |
| Cartes associées                              | Qualité, édition, langues, progression, année, favori/vu et lecture via les cartes existantes. Les informations secondaires apparaissent au survol ou au focus, selon la présentation existante.                                        |
| Actions supplémentaires                       | Menu des recommandations pour ouvrir la fiche ou lire depuis le début.                                                                                                                                                                  |
| Lecture, reprise, bande-annonce               | Lecture et reprise existantes conservées ; lien vers la bande-annonce lorsqu’elle est fournie.                                                                                                                                          |

Les trois icônes de services supplémentaires visibles à côté de TMDB dans les captures ne suffisent pas à identifier une configuration ou une URL. La fiche affiche tous les liens réellement fournis par le serveur, sans générer de fausses destinations. Les avis restent propres à HollyFilms : ils ne sont pas publiés sur TMDB et ne nécessitent aucun compte TMDB pour les membres.

## Sources et configuration

- Le SDK utilise la session de l’onglet pour les détails, acteurs, chapitres, collections et recommandations.
- Fastify vérifie le compte et l’accès au média auprès du serveur pour chaque route `/api/media/:id/*`. Les identités d’auteur ne sont jamais acceptées depuis le navigateur.
- `TMDB_API_TOKEN` est un **API Read Access Token** côté serveur, obtenu dans les [paramètres TMDB](https://www.themoviedb.org/settings/api). Redémarrer l’API après modification du `.env`.
- Les films et séries sont associés par leur identifiant TMDB existant ; aucune correspondance approximative par titre. Une fiche sans correspondance l’indique explicitement.
- Les réponses publiques TMDB sont mises en cache 15 minutes, avec une limite de 200 entrées. Le cache ne contient pas de décisions d’autorisation.
- Les avis des membres persistent dans `MediaReview` via la migration Prisma versionnée. Les erreurs TMDB ne bloquent pas leur lecture ou leur écriture.
- Les écritures sont limitées en fréquence, soumises au contrôle d’origine et réservées à l’auteur. Le texte des avis est rendu comme texte, jamais comme HTML.

Documentation : [disponibilités TMDB](https://developer.themoviedb.org/reference/movie-watch-providers), [critiques TMDB](https://developer.themoviedb.org/reference/movie-reviews), [attribution TMDB](https://developer.themoviedb.org/docs/faq). JustWatch est crédité près des offres ; le logo TMDB officiel et la mention requise figurent dans « Sources et crédits ».

Logo `apps/web/public/tmdb.svg` : [asset officiel TMDB, non modifié](https://www.themoviedb.org/assets/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg). La marque reste la propriété de TMDB.

## Interaction et performances

Les médias restent indépendants des panneaux externes : l’ouverture montre immédiatement le résumé déjà chargé, puis enrichit la fiche. Les images utilisent le cache authentifié de `MediaArtwork`. Les portraits et scènes hors écran sont chargés à la demande. Les sections entrent avec Motion sur l’opacité et la translation ; les carrousels utilisent le défilement natif et aucune boucle décorative.

La préférence de mouvement réduit supprime les déplacements. Échap et un clic sur le fond ferment la fiche ; le dialogue natif conserve le focus modal puis le rend au déclencheur. La fermeture annule le chargement d’une file de collection. La transition d’image partagée reste réservée à artwork ↔ lecteur.

## Vérifications reproductibles

- `corepack yarn test` : mapping des détails et images de chapitres, authentification SDK, requêtes de collections et personnes, erreurs partielles.
- `corepack yarn test:media` : PostgreSQL isolé avec migrations appliquées et `HOLLYFILMS_TEST_DATABASE_URL` renseigné ; fournisseurs simulés et avis persistants.
- `corepack yarn test:accounts` : PostgreSQL et Jellyfin neufs isolés ; non-régression de l’inscription et de l’approbation.
- `corepack yarn test:player` : Jellyfin 12.4 isolé, médias synthétiques et Chrome ; décodage, reprise, pistes, files et commandes distantes.
- Stories `UI/Fiche média`, `UI/Fiche média/Communauté` et `UI/Fiche média/Carrousel` : démonstration complète, métadonnées incomplètes, chargement, erreur, avis, scènes, collections et acteurs.

La validation réelle des offres et critiques d’un titre nécessite le jeton TMDB du déploiement. Les tests automatiques utilisent des réponses simulées et ne valident pas ce jeton.

### Contrôles effectués le 12 novembre 2026

Lint, Prettier, builds web/API/Storybook, les 15 tests web, `test:media`, `test:accounts` et `test:player` passent. La migration a été appliquée à une base vide, puis réexécutée sans changement. Les 23 stories contrôlées couvrent aussi les transitions d’images existantes ; la fermeture clavier et le retour du focus ont été vérifiés après correction.

Playwright a contrôlé chaque section aux formats 320×568, 390×844, 768×1024, 844×390 et 1440×900 sans débordement horizontal, ainsi que le clic extérieur, Échap et le mouvement réduit. Sur Vite, les deux services répondent et les nouvelles routes refusent les requêtes non authentifiées. Aucun parcours complet sur la bibliothèque personnelle n’a été validé dans ce profil de navigateur, qui n’a pas de session utilisateur. Les tests authentifiés utilisent des services isolés et des données de démonstration.

`TMDB_API_TOKEN` n’étant pas renseigné dans l’environnement local, les disponibilités et critiques TMDB réelles restent à vérifier après configuration.
