# Demandes de médias

HollyFilms réutilise l’instance **Seerr existante**. Seerr reste la source des demandes, décisions et téléchargements ; Radarr et Sonarr gèrent leur acquisition avec les indexeurs Prowlarr déjà configurés. Il n’y a ni seconde file de téléchargement, ni nouvelle table Prisma.

## Configuration serveur

Renseigner ensemble `SEERR_URL` et `SEERR_API_KEY` dans `.env`. Par exemple, `SEERR_URL=https://seerr.chbrx.com` et la clé API disponible dans les réglages généraux de Seerr. Sans les deux variables, la découverte est indisponible ; avec une seule variable, le démarrage échoue pour signaler une configuration incomplète. Aucune clé n’est envoyée au navigateur ni intégrée au build Vite.

Seerr doit être relié au **même serveur Jellyfin** que HollyFilms. Un service Radarr par défaut, non 4K, permet les demandes de films ; un Sonarr par défaut, non 4K, permet celles de séries. HollyFilms ne modifie pas les services existants. Une demande de série porte sur toutes ses saisons disponibles après confirmation. Le service absent est affiché comme non configuré, sans simuler de téléchargement.

En production, utiliser l’objet Terraform sensible `seerr = { url = "https://seerr.chbrx.com", api_key = "…" }`. Ces valeurs vont au Secret API, jamais au conteneur web. Le déploiement habituel reste explicite ; préparer ces variables ne publie pas les modifications.

## Identités et autorisations

Chaque requête vérifie la session utilisateur auprès de Jellyfin. L’identité Seerr est retrouvée par **l’identifiant Jellyfin**, jamais par le nom ou l’adresse email. Au premier envoi explicite, seul ce compte est importé s’il n’existe pas ; consulter une liste ou une recherche ne crée aucun compte.

La création utilise la clé serveur et `X-Api-User` avec ce compte Seerr, afin de préserver l’auteur, les quotas et les permissions. Les utilisateurs Jellyfin normaux doivent avoir le droit de demande Seerr, sans droits d’auto-approbation ou de gestion. Si un compte Seerr existant possède de tels droits alors que son compte Jellyfin n’est pas administrateur, HollyFilms bloque son envoi et invite un administrateur à corriger cette incohérence. Il ne change pas silencieusement les permissions Seerr.

Une demande d’un administrateur Jellyfin est automatiquement approuvée. Si son compte Seerr n’a pas ce droit, le serveur approuve la demande créée à son nom. Seerr peut alors enregistrer le propriétaire de la clé comme auteur de la décision. Les demandes ordinaires attendent une approbation. Les règles globales d’automatisation ou les actions effectuées directement dans Seerr continuent de s’appliquer.

Les routes admin vérifient le rôle Jellyfin à chaque appel. Les décisions concurrentes HollyFilms sont sérialisées par demande avec un verrou transactionnel PostgreSQL, partagé entre replicas. Un rechargement frais précède chaque décision ; le refus d’une demande déjà traitée retourne un conflit. La création est dédupliquée dans le processus ; après une interruption ou un conflit Seerr, elle recherche la demande active de cet utilisateur avant de réessayer.

## Parcours

- La recherche conserve les résultats de la bibliothèque et ajoute **Titres à demander** pour les films et séries trouvés par Seerr qui ne sont pas entièrement disponibles. Les personnes et résultats adultes sont exclus. La recherche est temporisée, paginée et annulable côté navigateur.
- L’envoi ouvre une modale animée avec l’affiche et les règles d’approbation.
  Elle passe à l’état d’envoi puis au reçu de succès, ou conserve la confirmation
  avec une erreur et la possibilité de réessayer. Un double-clic n’envoie qu’une
  demande ; le badge « Déjà demandé » est appliqué immédiatement après succès.
  Échap, Annuler et le clic extérieur ferment la modale hors envoi, avec
  restitution du focus et du scroll. Le mouvement réduit est respecté.
- Après le premier envoi réussi, le reçu propose **Voir mes demandes** ou
  **Continuer à explorer**. Cette proposition est affichée une seule fois par
  compte Jellyfin et navigateur, y compris après rechargement, via `localStorage`.
  Elle est considérée comme présentée dès le succès : fermer le reçu ne la fait
  pas réapparaître. Une erreur n’enregistre pas cette préférence. Si le stockage
  est bloqué, un repli mémoire évite les répétitions pendant la session courante.
  Le lien permanent **Mes demandes** reste disponible dans la recherche.
- Le menu de la photo de profil ouvre **Mes demandes**, `/requests`. Cette page ne reçoit que les demandes de l’utilisateur, sans noms d’autres membres, dossiers ou métadonnées techniques.
- Les administrateurs ont aussi **Demandes de médias**, `/admin/requests` : demandes de tous les membres, approbation, refus confirmé, nouvelle tentative des échecs, services et statistiques, auteur, décision, profil, dossier et liens de gestion disponibles.
- Les pages se rafraîchissent toutes les dix secondes lorsqu’elles sont visibles. Les statuts incluent attente, approbation, refus, échec, traitement, disponibilité partielle ou complète. Le filtre utilise uniquement les états pris en charge par Seerr ; les refus restent visibles dans « Toutes ».
- Les téléchargements affichent la progression réelle `(taille − octets restants) / taille`, l’état et le temps restant remontés par Seerr. Sans taille connue, aucun pourcentage n’est inventé. Les noms techniques des téléchargements sont réservés aux administrateurs.

Les données publiques de description sont mises en cache cinq minutes, avec au maximum 256 titres. Les décisions, identités et téléchargements restent frais. La recherche et les mutations sont authentifiées et limitées en fréquence. Les erreurs distantes sont nettoyées, sans renvoyer de clé ou de message technique privé.

## Vérification

`corepack yarn test:requests` démarre un PostgreSQL 17 isolé et des serveurs Jellyfin/Seerr simulés. Il vérifie l’isolation utilisateur, les permissions, la déduplication, les décisions concurrentes, l’import ciblé, les téléchargements mesurés, la configuration incomplète et la reprise après panne. Il ne contacte pas Seerr réel et ne déclenche aucun téléchargement de production.

Les stories « UI/Recherche/Demandes » et « HollyFilms/Demandes de médias » couvrent les parcours, les états d’erreur, de chargement, vides, l’administration, les filtres et la pagination. Les textes sont disponibles en français, anglais et chinois.

La configuration réelle consultée pendant l’intégration expose Radarr et 50 demandes existantes, mais aucun service Sonarr. Une demande réelle, son approbation et son téléchargement doivent être validés avec un titre choisi avant ouverture aux utilisateurs ; les tests automatisés utilisent des simulations pour éviter de lancer une acquisition réelle.
