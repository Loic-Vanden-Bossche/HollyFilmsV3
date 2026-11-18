# Mise à jour des services — 18 novembre 2026

Les versions stables ont été vérifiées auprès des projets et registres mainteneurs avant intervention. Les versions de développement et release candidates sont exclues. Cette intervention concerne les services gérés par HollyFilms ; le réseau, le contrôleur ingress partagé et cert-manager restent dans l’infrastructure CHBRX.

| Service               | Version précédente                | Cible vérifiée                                                  |
| --------------------- | --------------------------------- | --------------------------------------------------------------- |
| Jellyfin              | `12.4ubu2604-ls59`                | `12.4ubu2604-ls60` (serveur 12.4 déjà à jour)                   |
| Jellyfin Enhanced     | `12.15.0.0`                       | `12.16.0.0`, archive API 12 et checksum vérifiés                |
| Radarr                | `6.3.0.10514-ls312`               | `7.0.3.10918-ls328`                                             |
| Prowlarr              | `2.5.2.5491-ls155`                | `3.0.2.5780-ls169`                                              |
| SABnzbd               | `5.0.4-ls264`                     | `5.1.3-ls281`                                                   |
| Seerr                 | `v3.4.1`                          | `v3.5.2`                                                        |
| Wizarr                | `v2026.7.1`                       | `v2026.10.1`                                                    |
| PostgreSQL production | format 17                         | `18.7-alpine`, image figée par digest                           |
| NGINX HollyFilms      | registre `nginxinc`, branche 1.28 | registre maintenu `nginx`, stable 1.30.6, digest figé           |
| Node HollyFilms       | Node 24                           | dernière corrective Node 24 LTS vérifiée : 24.22.3, digest figé |
| Conteneurs init       | Alpine 3.24.1                     | Alpine 3.24.4, digest figé                                      |

Les trois plugins installés explicitement par Terraform sont compatibles avec Jellyfin 12. File Transformation 3.0.3.0 et Jellyfin Tweaks 5.1.0.0 étaient déjà à jour. Les seize plugins installés sont actifs après redémarrage. Les nouvelles intégrations facultatives d’Enhanced n’ont pas été configurées à la place de l’administrateur ; consulter ses notes de version pour les nouvelles options de watchlist et le rafraîchissement facultatif des caches de tags.

## Sauvegardes et contrôles des médias

Le dossier privé `C:/Users/loic/.codex/private/hollyfilms-upgrades-20261118-014008` contient les états, plans, inventaires, sauvegardes natives Radarr/Prowlarr, sauvegardes SQLite cohérentes des quatre autres applications et exports PostgreSQL. Son ACL est limitée au compte Windows courant. Ne jamais le commiter ou publier : il contient des secrets.

Les six archives applicatives ont été relues et neuf bases SQLite ont passé `PRAGMA quick_check`. Les changements Terraform des médias ont été limités aux Deployments et à la ConfigMap de l’installateur Jellyfin ; les namespaces, Services, PVC/PV, chemins, clés et adresses sont conservés. Chaque service a été mis à jour puis contrôlé avant le suivant.

La sauvegarde fraîche contenait **61 films et 10 collections** : un film était arrivé depuis l’inventaire de migration initial de 60 films. Les 71 identifiants sauvegardés ont tous été retrouvés après la mise à jour Jellyfin. Seerr conserve 51 demandes ; Wizarr conserve quatre utilisateurs, quatre invitations et un serveur média. SABnzbd conserve Eweka, `/downloads/incomplete` et `/downloads/complete`. Aucun téléchargement de test n’a été demandé.

## PostgreSQL 17 vers 18.7

Le PVC historique `hollyfilms-postgres` est conservé, sans changement d’identifiant, sous l’adresse Terraform `module.database.kubernetes_persistent_volume_claim_v1.legacy_database[0]`. Le bloc `moved` réalise ce changement d’adresse sans recréation. `database_retain_legacy_volume = true` doit rester renseigné sur cette installation ; `prevent_destroy` bloque sa suppression accidentelle.

Un nouveau PVC protégé `hollyfilms-postgres-18` a été créé. Un PostgreSQL 18 isolé, non sélectionné par le Service de production, y a restauré l’export logique. Les empreintes et nombres de lignes des cinq tables HollyFilms, migrations comprises, étaient identiques entre 17 et 18.

Pour la bascule finale, le Deployment HollyFilms a été arrêté afin de terminer les écritures, puis une nouvelle sauvegarde a été restaurée et vérifiée. Le pod temporaire PostgreSQL 18 a été arrêté avant que le Deployment primaire utilise ce même volume. Le primaire utilise `/var/lib/postgresql/18/docker` sur un montage `/var/lib/postgresql`, conformément au format de l’image officielle 18. Le Service, le Secret de connexion et la clé de chiffrement Google restent identiques.

Les empreintes de toutes les tables ont été vérifiées une seconde fois sur le primaire avant réouverture de HollyFilms. L’ancien volume 17 reste un point de reprise ; il ne reçoit plus les nouvelles écritures. Un retour ultérieur doit réconcilier ces écritures, sous maintenance. Ne pas remplacer aveuglément le volume 18 par la copie 17 et ne pas appliquer un ancien checkout Terraform : utiliser la configuration actuelle et une procédure de restauration vérifiée.

Le fichier privé `upgrade.auto.tfvars.json` conserve les paramètres de cette installation migrée. Une installation neuve utilise directement PostgreSQL 18 sans créer de volume historique. Les tests Terraform couvrent ces deux cas et le maintien temporaire de PostgreSQL 17 pendant la préparation.

## Application et validation

Les images API/web sont reconstruites pour HollyFilms `v1.1.1`, avec Node 24.22.3 et NGINX 1.30.6 provenant du registre maintenu. Les tests conteneurs vérifient les migrations, l’isolation des secrets, les routes SPA, Range et WebSocket sur ces images et PostgreSQL 18.7. Les suites demandes et sous-titres ont également été exécutées avec PostgreSQL 18.7 : 13 et 10 tests réussis. Les dix scénarios Terraform passent avec provider simulé.

Les volumes de développement existants conservent le format 17 et passent uniquement à la corrective 17.12 dans Compose. Ils ne sont pas migrés implicitement au format 18 au prochain `yarn dev`.

## Références mainteneurs

- [Jellyfin 12.4](https://github.com/jellyfin/jellyfin/releases/tag/v12.4) et [images LinuxServer](https://github.com/linuxserver/docker-jellyfin/releases).
- [Radarr 7.0.3](https://github.com/Radarr/Radarr/releases/tag/v7.0.3.10918), [Prowlarr 3.0.2](https://github.com/Prowlarr/Prowlarr/releases/tag/v3.0.2.5780), [SABnzbd 5.1.3](https://github.com/sabnzbd/sabnzbd/releases/tag/5.1.3).
- [Seerr 3.5.2](https://github.com/seerr-team/seerr/releases/tag/v3.5.2), [Wizarr 2026.10.1](https://github.com/wizarrrr/wizarr/releases/tag/v2026.10.1), [Enhanced 12.16](https://github.com/n00bcodr/Jellyfin-Enhanced/releases/tag/12.16.0.0).
- [Versions PostgreSQL](https://www.postgresql.org/docs/release/), [migration majeure](https://www.postgresql.org/docs/current/upgrading.html), [image officielle et stockage versionné](https://hub.docker.com/_/postgres).
- [Registre NGINX maintenu](https://hub.docker.com/r/nginx/nginx-unprivileged), [avis de transfert du registre précédent](https://hub.docker.com/r/nginxinc/nginx-unprivileged), [versions Node](https://nodejs.org/dist/index.json).
