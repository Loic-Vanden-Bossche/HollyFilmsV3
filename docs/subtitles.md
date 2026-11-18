# Sous-titres externes

HollyFilms utilise le SDK et les fournisseurs de sous-titres **déjà configurés dans Jellyfin**, notamment Open Subtitles. Aucune clé Open Subtitles n’est ajoutée au navigateur ou à HollyFilms. Les identifiants et quotas du fournisseur restent gérés dans Jellyfin.

## Utilisation

- Dans la fiche d’un film ou d’un épisode, ouvrir **Sous-titres externes**. Le choix de version correspond au fichier précis, y compris les éditions alternatives.
- Dans le lecteur, ouvrir **Sous-titres**. Ce bouton reste disponible même si aucune piste n’est installée. Le panneau travaille sur la version en cours de lecture.
- Un administrateur choisit une langue, lance la recherche, compare les résultats (fournisseur, format, auteur, note, téléchargements, correspondance du fichier, sous-titres forcés ou malentendants, traduction automatique), puis confirme le téléchargement.
- Un utilisateur normal peut demander une langue. Il ne peut ni rechercher chez les fournisseurs ni télécharger directement via les routes HollyFilms.
- Les pages **Mes demandes** et **Demandes de médias** proposent un onglet **Sous-titres**, conservé dans l’URL `?section=subtitles`. L’administrateur peut refuser une demande ou choisir un résultat et **Approuver et télécharger**. Chaque utilisateur ne voit que ses propres demandes.

Les langues proviennent de Jellyfin et sont affichées dans la langue de l’interface. Les sélecteurs restent natifs sur mobile. Les entrées, confirmations et panneaux utilisent Motion avec la politique commune de mouvement réduit.

Le panneau présente les étapes de configuration, recherche/approbation et
installation. Les pistes déjà installées se déplient avec leur langue et leur
format. Les résultats fournisseur affichent leurs drapeaux, correspondance,
accessibilité et métadonnées disponibles ; les entrées sont décalées et limitées
à des fondus en mouvement réduit.

La demande utilisateur, l’installation administrateur et le refus ouvrent une
confirmation native animée, avec contexte version/langue et reçu du résultat.
Les envois sont protégés contre les doubles clics. Les skeletons et barres
indéterminées distinguent le chargement, la recherche et la vérification : aucun
pourcentage d’acquisition n’est inventé. Le bouton d’envoi reste bloqué tant que
l’appel est en cours ; le reçu est disponible dès sa réponse, sans attendre les
rafraîchissements secondaires. Une demande active bloque les doublons dans le
panneau. Le statut installé n’est affiché qu’après confirmation du serveur.

Échap et le clic extérieur ferment les confirmations hors envoi. Le focus et le
scroll sont restitués ; les raccourcis du lecteur n’interceptent pas les touches
de la confirmation. Les contrôles restent accessibles sur tactile et les loaders
respectent le mouvement réduit et la visibilité de l’onglet.
Les échecs d’actualisation conservent les données déjà chargées avec un message
d’erreur ; ils ne remplacent plus le panneau ou la liste entière par un écran vide.

## Téléchargement et lecture en cours

Jellyfin 12.4 peut répondre HTTP 204 alors qu’un téléchargement de fournisseur a échoué. HollyFilms compare donc les pistes externes après l’opération à leur état précédent ; il ne considère pas la réponse HTTP seule comme une installation réussie. L’opération reste « Vérification du sous-titre… » pendant l’indexation. Les pages visibles interrogent son état toutes les deux secondes ; après deux minutes sans confirmation, elles signalent explicitement que l’installation n’a pas pu être vérifiée. Une panne temporaire n’est jamais transformée en faux succès.

Dans le lecteur, seules les métadonnées des sous-titres sont rafraîchies. L’élément vidéo, son URL, sa session, sa position et son état pause/lecture sont conservés. Les deux pistes sélectionnées sont retrouvées par leur identité, car Jellyfin peut renuméroter les sous-titres après un ajout. Une révision de la liste est ajoutée aux URL de sous-titres pour éviter de réutiliser un fichier mis en cache sous un ancien index. Les pistes audio et vidéo ne sont pas remplacées.

Si aucune nouvelle piste n’apparaît, vérifier la configuration et les quotas Open Subtitles, les autorisations d’écriture des dossiers média et les journaux Jellyfin. Les recherches vides peuvent également venir du fournisseur ; désactiver « Correspondance exacte uniquement » permet d’élargir les résultats.

## Persistance et autorisations

La migration Prisma `20261117210557_subtitle_requests` ajoute les demandes et leur historique : utilisateur, média, version, langue, état, auteur/date de décision et échec éventuel. Les chemins de fichiers servent uniquement à produire des empreintes côté serveur et ne sont pas renvoyés par l’API HollyFilms.

Les appels authentifient l’utilisateur auprès de Jellyfin et vérifient son accès au média et à la version. Le rôle administrateur est revérifié sur chaque action privilégiée. La sélection à télécharger doit appartenir à une recherche fraîche pour ce fichier et cette langue. La clé serveur Jellyfin reste côté API.

Les créations et décisions sont sérialisées par version avec un verrou transactionnel PostgreSQL. Les doubles demandes actives d’un utilisateur sont dédupliquées. Une opération de téléchargement est enregistrée avant l’appel distant ; après un redémarrage de l’API, les lectures suivantes reprennent sa vérification sans redéclencher automatiquement l’acquisition. Une installation vérifiée satisfait aussi les autres demandes en attente pour la même version et la même langue.

En production, le Job existant applique la migration via `prisma migrate deploy`. Aucune nouvelle variable serveur, aucun changement de schéma Jellyfin et aucun service supplémentaire ne sont nécessaires. La version actuelle n’est pas publiée automatiquement.

## Validation

- `corepack yarn test:subtitles` : PostgreSQL 17 isolé, migrations appliquées deux fois, Jellyfin/fournisseur simulés, droits et isolation, version/langue, confirmation réelle, doublons, refus, reprise après redémarrage et échecs.
- `corepack yarn test` : notamment conservation des flux vidéo/audio et remappage des deux pistes de sous-titres.
- `corepack yarn test:player` : Jellyfin 12.4 et médias synthétiques. Le transport fournisseur est simulé ; le fichier téléchargé est réellement créé puis indexé dans le conteneur isolé. Le test vérifie son apparition dans le lecteur, les deux langues conservées, le même élément vidéo et l’absence de nouvelle session de lecture.
- Storybook : panneau administrateur, demande utilisateur, approbation, versions et clavier, chargement, absence de résultats, panne fournisseur, vérification et installation non confirmée, fiche média et onglet de suivi.

Aucun téléchargement n’est lancé sur l’instance de production pendant ces contrôles. La lecture de sa bibliothèque et des langues a permis de vérifier la compatibilité des métadonnées et le contexte utilisateur requis par Jellyfin 12.
