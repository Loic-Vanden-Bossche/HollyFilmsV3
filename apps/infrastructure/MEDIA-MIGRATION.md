# Migration des services médias CHBRX

Transfert effectué le 18 novembre 2026, depuis `C:/Users/loic/IdeaProjects/chbrx-infrastructure/infrastructure` vers cette racine Terraform.

## Propriété et continuité

Les **49 instances de ressources** des modules `jellyfin`, `prowlarr`, `radarr`, `sabnzbd`, `seerr` et `wizarr` sont désormais suivies dans le backend Scaleway `chbrx-terraformstate/hollyfilms-v3.tfstate`. Elles ne sont plus suivies dans `chbrx.tfstate`. Les 11 ressources HollyFilms déjà suivies ont été conservées. Le transfert a utilisé les commandes Terraform de déplacement d’état sur des copies privées et des blocs `removed` avec `destroy = false` côté source. Aucun fichier d’état n’a été modifié manuellement.

Le plan de retrait contenait uniquement 49 actions `forget`. Les plans d’adoption et de contrôle contiennent 49 ressources sans changement : aucune création, modification, suppression ou substitution Kubernetes. Aucun rollout ni déplacement de fichiers médias n’a été demandé pendant ce transfert initial. La finalisation SABnzbd, décrite plus bas, a ensuite remplacé uniquement son pod pour reprendre le montage HDD3 existant.

| Service  | Namespace conservé | Adresse conservée                                                    |
| -------- | ------------------ | -------------------------------------------------------------------- |
| Jellyfin | `jellyfin`         | `https://hollyfilms.chbrx.com`, port interne 8096                    |
| Prowlarr | `prowlarr`         | `http://prowlarr.prowlarr.svc.cluster.local:9696`, ingress désactivé |
| Radarr   | `radarr`           | `http://radarr.radarr.svc.cluster.local:7878`, ingress désactivé     |
| SABnzbd  | `sabnzbd`          | `http://sabnzbd.sabnzbd.svc.cluster.local:8080`, ingress désactivé   |
| Seerr    | `seerr`            | `https://seerr.chbrx.com`, port interne 5055                         |
| Wizarr   | `wizarr`           | `https://invite.hollyfilms.chbrx.com`, port interne 5690             |

**Aucun changement d’URL, namespace, clé ou configuration d’intégration n’est nécessaire.** Le frontend/API reste sur `hollyfilms-v3.chbrx.com`. Le contrôleur NGINX partagé, cert-manager, son ClusterIssuer, le réseau et le provisionneur de stockage restent dans le dépôt CHBRX : ne pas supprimer cette infrastructure commune.

Les versions en production, les trois plugins installés par le script Jellyfin, les scripts Abyss et home-defaults, les identifiants PUID/PGID et les paramètres des services ont été repris. Les namespaces ont reçu une protection Terraform `prevent_destroy`, sans modification Kubernetes.

Le Secret et la ConfigMap `home-defaults` Jellyfin sont également protégés contre la suppression. Un déploiement qui oublie leur clé doit échouer au plan plutôt que désactiver cette automatisation existante.

## Stockage et sauvegardes

Les dix PVC médias et leurs PV conservent leurs identifiants et associations. Les chemins restent :

- Jellyfin : `/mnt/HDD3/jellyfin/config` et `/mnt/HDD3/jellyfin/media`.

- Radarr : `/mnt/HDD3/radarr/config`, le même dossier média Jellyfin et `/mnt/HDD3/downloads`.

- SABnzbd : `/mnt/HDD3/sabnzbd/config` et le même dossier `/mnt/HDD3/downloads`.

- Prowlarr : `/mnt/HDD3/prowlarr/config`.

- Seerr : `/mnt/HDD3/seerr/config`.

- Wizarr : PVC existant `wizarr-data`, PV `pvc-609bd127-4fed-4cd3-9c5e-56405d59c595`, sur `serveur-loic`.

Les PV statiques restent en `Retain`. Le PV dynamique Wizarr conserve sa politique historique `Delete` : son PVC et son namespace sont protégés dans Terraform ; une suppression manuelle Kubernetes reste dangereuse. Aucun PVC n’a été recréé.

Les sauvegardes privées sont dans `C:/Users/loic/.codex/private/hollyfilms-migration-20261118-001721`, avec une ACL limitée au compte Windows courant. Ce dossier contient les deux états avant/après, les plans, les inventaires Kubernetes, les copies de configuration, les sources originales et les sauvegardes applicatives. Il ne doit pas être publié ni commité : il contient des secrets.

Radarr et Prowlarr ont produit leurs sauvegardes natives. Jellyfin, Seerr, SABnzbd et Wizarr ont été sauvegardés avec des montages de configuration en lecture seule et l’API SQLite de sauvegarde. Une septième archive conserve séparément la configuration et la base réellement utilisées par le pod SABnzbd, différentes de celles actuellement résolues sur HDD3. Les archives ont été relues et les **dix sauvegardes SQLite** vérifiées avec `PRAGMA quick_check`. `backup-manifest.json` conserve tailles et SHA-256. Les affiches/cache et fichiers vidéo volumineux ne sont pas dupliqués : ils restent sur les mêmes volumes, sans déplacement. Ces sauvegardes sont un point de reprise de migration, à intégrer ensuite à la stratégie de sauvegarde durable.

## Écart de stockage SABnzbd préexistant

Le pod SABnzbd existant utilise encore des montages `/config` et `/downloads` sur le système de fichiers Ubuntu (`/dev/mapper/ubuntu--vg-ubuntu--lv`). Les chemins du PVC actuellement résolus sur HDD3 contiennent une autre configuration, avec le fournisseur **Eweka** et les dossiers `/downloads/incomplete` et `/downloads/complete`. Cette différence est compatible avec un bind mount établi avant le montage du disque, puis conservé par le pod ancien ; elle n’a pas été provoquée par le transfert d’état.

La configuration du pod actif ne déclare aucun serveur Usenet et conserve les dossiers par défaut `Downloads/incomplete` et `Downloads/complete`. La clé SABnzbd enregistrée dans la base Radarr correspond à la configuration HDD3, **pas à celle du pod actif**. Cela explique l’erreur de connexion au client déjà présente dans Radarr avant la migration. La file du SABnzbd actif était vide pendant le contrôle.

Les deux configurations et bases ont été conservées séparément dans les sauvegardes. Le pod a été laissé intact pendant le transfert initial, puis relancé le 18 novembre 2026 après la demande de finalisation. Ses deux montages utilisent désormais `/dev/sdd1` (HDD3), le fournisseur Eweka est chargé et le test du client SABnzbd depuis Radarr retourne HTTP 200. L’erreur de client de téléchargement Radarr a disparu après son contrôle de santé. Aucun ensemble de données n’a été écrasé ; aucun changement de namespace ou DNS n’a été nécessaire.

## Reprise des déploiements

Le workflow GitHub `Check And Deploy Chbrx Infrastructure` (`check-and-deploy.yml`) du dépôt `Loic-Vanden-Bossche/chbrx-infrastructure` a été **désactivé pendant le transfert**. Aucune exécution n’était active. Sa version distante antérieure déclare encore les anciens modules : un apply depuis cette version pourrait tenter de créer à nouveau les ressources qui viennent de changer d’état.

Avant de le réactiver :

1. Faire intégrer dans le dépôt CHBRX la suppression des six modules, de leurs entrées/sorties et les blocs de `infrastructure/hollyfilms-migration.tf`. Conserver `destroy = false`. Le dépôt contenait déjà d’autres modifications locales ; elles n’ont pas été annulées et ne doivent pas être publiées sans leur propre revue.

2. Faire intégrer les modules et protections dans le dépôt HollyFilms. Conserver les fichiers de variables secrets hors Git et les provisionner sur la machine de déploiement. Ne pas réimporter les ressources : le transfert distant est déjà effectué.

3. Vérifier le plan des deux racines. Aucun ancien module média ne doit réapparaître dans le plan CHBRX. Le plan HollyFilms doit conserver les PVC/PV et ne prévoir aucune recréation des services. Les modifications applicatives locales préexistantes ne font pas partie de cette migration et n’ont pas été déployées.

4. Réactiver explicitement le workflow après intégration de ces changements :

```powershell

gh workflow enable check-and-deploy.yml --repo Loic-Vanden-Bossche/chbrx-infrastructure

```

Il n’y a eu ni commit, ni push des modifications locales, ni publication GHCR pendant cette intervention. Les sorties d’état historiques CHBRX éventuellement encore en cache ne signifient pas que cette racine possède les ressources ; leur retrait sera enregistré au prochain apply revu de cette racine.

## Comptes et abonnements fournisseurs

Audit sans achat, téléchargement de média ni changement de compte. Eweka a été testé par authentification NNTP sur TLS vérifié, sans lecture d’article. Chaque indexeur a reçu une requête de métadonnées limitée à un résultat ; aucun fichier NZB ni média n’a été téléchargé.

| Service / fournisseur    | Constat                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SABnzbd / Eweka          | Authentification du compte réussie. Après finalisation, le pod utilise HDD3, charge Eweka et accepte les appels de Radarr. Date d’expiration non renseignée ; aucun abonnement confirmé manquant. |
| Prowlarr / NZBgeek       | Indexeur activé et **accès API vérifié**, réponse HTTP 200 avec un résultat. Date `vipExpiration` vide : niveau d’abonnement et échéance non certifiés par ce contrôle.                           |
| Prowlarr / NZBFinder     | Indexeur activé et **accès API vérifié**, réponse HTTP 200 avec un résultat. Date `vipExpiration` vide : niveau d’abonnement et échéance non certifiés par ce contrôle.                           |
| Jellyfin / OpenSubtitles | Plugin actif, nom de compte et mot de passe renseignés. L’état de l’abonnement/VIP et les quotas ne sont pas certifiés par cet audit local.                                                       |
| Radarr, Seerr, Wizarr    | Aucun compte fournisseur manquant identifié dans leur configuration ; pas d’abonnement externe identifié comme prérequis local supplémentaire.                                                    |

Les alertes Radarr concernant SABnzbd existaient avant la migration ; elles ont été résolues lors de la finalisation du montage HDD3. Seerr conserve sa connexion Jellyfin, son Radarr par défaut et ses 51 demandes. Aucun Sonarr n’est configuré : les séries nécessiteraient une intégration supplémentaire, indépendamment des abonnements. Wizarr conserve son serveur média, ses quatre utilisateurs et ses quatre invitations. Ces éléments n’ont pas été reconfigurés dans cette migration.

## Contrôles de livraison

- Les 49 instances médias sont présentes uniquement dans l’état HollyFilms. Le plan distant final, avec rafraîchissement des ressources médias, retourne le code détaillé **0** : aucun changement ni dérive observée pour ces services. Le plan ciblé de l’ancienne racine ne contient plus aucune ressource ou action média. Aucun plan global des modifications applicatives préexistantes n’a été appliqué.
- Pendant le transfert initial d’état, les identifiants des neuf pods initiaux, huit Deployments, onze PVC/PV (base HollyFilms comprise), huit Services, quatre Ingress, sept namespaces, dix ConfigMaps, huit Secrets et cinq StorageClasses inventoriés sont conservés. Les spécifications, associations de volumes et contenus des ConfigMaps/Secrets contrôlés sont identiques. Les pods temporaires de sauvegarde ont été supprimés après copie et vérification des archives.
- Les compteurs applicatifs avant/après sont identiques : Jellyfin **60 films, 10 collections, 6 utilisateurs** ; Radarr **52 titres** et les deux indexeurs ; Seerr **51 demandes** ; Wizarr **4 utilisateurs, 4 invitations, 1 serveur média**.
- Les six interfaces/services répondent en HTTP 200 depuis le cluster. Les trois interfaces publiques, `/api/health` et le proxy Jellyfin de HollyFilms répondent également en HTTPS 200.
- `init -backend=false`, `fmt -check -recursive` et `validate` passent dans les deux racines. `terraform test` passe côté HollyFilms : **7 scénarios**, provider Kubernetes simulé.
- Les deux images Docker locales de validation ont été reconstruites. `corepack yarn test:infrastructure` passe : migrations, SPA, isolation des secrets, API, Range vidéo et WebSocket dans des conteneurs isolés.
- `corepack yarn lint`, `format:check`, `build`, `build-storybook` et `test` passent (**37 tests web**). Aucun changement de lecteur n’a été effectué ; `test:player` n’a pas été relancé pour ce transfert d’infrastructure.

## Finalisation exécutée le 18 novembre 2026

À la demande de lancement de la migration, le plan médias a été vérifié et appliqué sur le backend distant HollyFilms : 49 ressources conservées, aucune création, suppression ou modification d’infrastructure. L’ancienne racine possède zéro ressource média.

La copie active SABnzbd sur le disque système et la copie HDD3 ont été sauvegardées intégralement avant intervention dans `C:/Users/loic/.codex/private/hollyfilms-migration-completion-20261118-005505`. Les deux archives ont passé les contrôles gzip/tar, SHA-256 et SQLite. Les dossiers de téléchargement des deux copies étaient vides et la file active ne contenait aucun travail.

Seul le pod SABnzbd a été relancé pour reprendre les PVC existants. Les huit autres pods inventoriés, les huit Deployments, les onze PVC et les onze PV sont conservés, avec les mêmes spécifications et identifiants. Les pods temporaires de vérification ont été supprimés.

Contrôles après intervention :

- `/config` et `/downloads` SABnzbd sont sur `/dev/sdd1`, fournisseur Eweka activé, chemins `/downloads/incomplete` et `/downloads/complete` conservés.
- Le test du client SABnzbd depuis Radarr retourne HTTP 200 et son contrôle de santé ne signale plus d’erreur de client de téléchargement. L’avertissement de version disponible reste indépendant de la migration.
- Jellyfin conserve 60 films et 10 collections ; Seerr 51 demandes ; Wizarr 4 utilisateurs, 4 invitations et un serveur média.
- Jellyfin, Seerr, Wizarr et l’API HollyFilms répondent en HTTPS 200.
- Le plan médias final contient 49 actions `no-op`. Aucun nouveau frontend/API n’a été publié.

Le workflow de déploiement de l’ancien dépôt reste désactivé jusqu’à intégration des changements de propriété dans les dépôts, conformément aux instructions de reprise ci-dessus. Le montage HDD3 doit être disponible avant le démarrage des workloads lors des prochains redémarrages du nœud.
