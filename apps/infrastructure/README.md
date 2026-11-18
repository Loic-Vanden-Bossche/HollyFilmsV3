# Infrastructure HollyFilms

Cette racine Terraform reprend l’architecture du [portfolio](https://github.com/Loic-Vanden-Bossche/portfolio/tree/master/infrastructure) pour la plateforme CHBRX : modules `database`, `app`, `domain`, backend Scaleway, images GHCR et migrations Prisma avant la mise à jour de l’application.

- **HollyFilms :** `https://hollyfilms-v3.chbrx.com`.
- **Jellyfin existant :** `https://hollyfilms.chbrx.com`, consommé via HTTPS et désormais administré par le module `jellyfin` de cette racine.
- **Namespaces :** `hollyfilms-v3` pour le frontend/API/PostgreSQL ; les services médias conservent leurs namespaces historiques.
- **État distant :** bucket `chbrx-terraformstate`, clé **`hollyfilms-v3.tfstate`**, endpoint Scaleway Paris. Aucun état du portfolio n’est réutilisé.

## Architecture

| Module          | Ressources                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Racine          | Backend S3, provider Kubernetes, namespace protégé, variables et outputs.                                                                                                               |
| `database`      | PostgreSQL 18.7, Secret, Service privé, Deployment `Recreate`, PVC 5 Gi protégé et répertoire de données versionné. Le volume PostgreSQL 17 est conservé sur les installations migrées. |
| `app`           | Secret de configuration, authentification GHCR facultative, Job de migration et Deployment avec deux conteneurs : API Node 24 et web NGINX non privilégié.                              |
| `domain`        | Ingress NGINX vers le port web 8080 et certificat via `letsencrypt-production`.                                                                                                         |
| Services médias | Modules `jellyfin`, `prowlarr`, `radarr`, `sabnzbd`, `seerr`, `wizarr`, repris sans recréation depuis `chbrx.tfstate`. Voir [le compte rendu de migration](MEDIA-MIGRATION.md).         |

Le web sert Vite et relaie `/api` vers l’API du même pod et `/jellyfin` vers le serveur existant. Le Service n’expose que le port web. PostgreSQL n’a ni NodePort ni ingress. Les cookies Google et les appels du navigateur restent sur la même origine.

Les flux vidéo ne sont pas mis en tampon ou en cache par les proxies. Range, les en-têtes d’authentification et l’upgrade WebSocket sont conservés. Le DNS de Jellyfin est résolu périodiquement et son certificat HTTPS vérifié. Les logs d’accès sont désactivés pour éviter de journaliser les jetons présents dans certaines URLs vidéo. Le contrôleur NGINX commun reste administré par la plateforme.

## Prérequis et configuration

Terraform **1.15.8+**, Docker/Buildx, Git, GitHub CLI (`gh`), Node 24 et Corepack. Le kubeconfig doit cibler CHBRX ; préciser `kubeconfig_context` pour éviter de dépendre du contexte courant. NGINX, cert-manager, le ClusterIssuer et le provisionneur `local-path` restent gérés par l’infrastructure CHBRX. Les StorageClasses statiques `*-protected` des services médias sont gérées ici. Le stockage dynamique `local-path` utilise `WaitForFirstConsumer`, d’où `wait_until_bound = false` sur les PVC concernés.

Depuis la racine du dépôt :

```powershell
Copy-Item apps/infrastructure/terraform.tfvars.example apps/infrastructure/terraform.tfvars
```

Renseigner le fichier ignoré par Git :

- `database_password` : au moins 16 caractères alphanumériques aléatoires. Exemple de génération : `node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"`.
- `jellyfin_api_key` : clé API du **serveur de production** `hollyfilms.chbrx.com`. L’API refuse de démarrer sans elle.
- `google` : facultatif, mais ses trois champs sont requis ensemble. Pour une nouvelle installation, `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` génère `password_key`. Conserver la clé existante si une base contenant des comptes Google est restaurée.
- `tmdb_api_token` : facultatif, jeton de lecture TMDB.
- `seerr` : facultatif, objet `url` et `api_key` de l’instance Seerr existante ; transmis uniquement au Secret API. Voir [les demandes de médias](../../docs/media-requests.md).
- `ghcr_credentials` : compte et jeton `read:packages` si les images sont privées ; `null` pour des images publiques.
- `media-variables.tf` : versions, hôtes et chemins persistants des six services médias. Les valeurs effectivement utilisées lors du transfert sont conservées dans `media.auto.tfvars.json`, ignoré par Git. `jellyfin_home_defaults_api_key` conserve la clé du sidecar historique ; elle est distincte de la configuration du backend HollyFilms et ne doit pas être supprimée pendant une mise à jour.
- `production-images.auto.tfvars.json`, ignoré par Git, conserve les digests actuellement déployés. Le script `deploy` fournit explicitement les images de la nouvelle release et prend ainsi priorité sur ces valeurs.

Les Secrets Kubernetes gérés par Terraform figurent aussi dans son état, malgré `sensitive = true`. Protéger le bucket, les sauvegardes, le fichier de variables et les plans. Les variables peuvent également être fournies avec `TF_VAR_*`. Aucun `.env` local n’est chargé par le script de déploiement ni copié dans les images.

Exporter les identifiants du backend Scaleway. Authentifier Docker avec un jeton autorisé à publier sur GHCR et GitHub CLI avec un compte autorisé à créer des releases dans `HollyFilmsV3`.

```powershell
$env:AWS_ACCESS_KEY_ID = "<accès Scaleway>"
$env:AWS_SECRET_ACCESS_KEY = "<secret Scaleway>"
docker login ghcr.io
gh auth login --hostname github.com
```

Le DNS de `hollyfilms-v3.chbrx.com` doit pointer sur l’endpoint de l’ingress CHBRX, comme le portfolio. La configuration ne crée pas d’enregistrement DNS. Pour Google, ajouter exactement cette URI de redirection dans la console OAuth :

```text
https://hollyfilms-v3.chbrx.com/api/auth/google/callback
```

## Construire, publier et préparer le déploiement

Pousser d’abord le commit à publier sur [HollyFilmsV3](https://github.com/Loic-Vanden-Bossche/HollyFilmsV3). Le script construit les deux images depuis le commit courant. Les modifications locales doivent être commitées et poussées pour entrer dans les images.

```powershell
corepack yarn deploy v1.0.0
```

Le script initialise Terraform, vérifie la configuration, construit et publie :

```text
ghcr.io/loic-vanden-bossche/hollyfilms-v3-api:v1.0.0
ghcr.io/loic-vanden-bossche/hollyfilms-v3-web:v1.0.0
```

Les images portent le label OCI `org.opencontainers.image.source` de `HollyFilmsV3` pour leur association au dépôt, ainsi que le commit et la version. Si un package publié auparavant sans label reste dissocié, utiliser **Connect repository** dans [GitHub Packages](https://docs.github.com/en/packages/learn-github-packages/connecting-a-repository-to-a-package#connecting-a-repository-to-a-user-scoped-package-on-github).

Le script récupère les **digests** et prépare `apps/infrastructure/hollyfilms.tfplan`. Il publie ensuite la [release GitHub](https://github.com/Loic-Vanden-Bossche/HollyFilmsV3/releases) avec les notes générées par GitHub et les deux références immuables. Le tag de la release pointe vers le commit des images. Une release existante bloque la republication de la version avant la construction. Le tag `latest` est réservé. `GHCR_IMAGE` change le préfixe des deux images, `GHCR_SOURCE_URL` surcharge le label source OCI et `DOCKER_PLATFORM` vaut `linux/amd64` par défaut.

Après lecture du plan :

```powershell
terraform -chdir=apps/infrastructure apply hollyfilms.tfplan
```

Pour construire, publier et appliquer dans la même commande, utiliser explicitement :

```powershell
corepack yarn deploy v1.0.1 --apply
```

Cette option applique le plan enregistré après la publication de la release. En cas d’échec d’`apply`, reprendre avec la commande Terraform ci-dessus. Exécuter les déploiements un à la fois, comme pour le backend Scaleway du portfolio.

Le Job `hollyfilms-migrate-<hash de l’image API>` utilise **`prisma migrate deploy`**. Terraform attend sa réussite avant le rollout ; un échec conserve les anciens pods de l’application. Les Jobs terminés sont suivis par Terraform sans TTL automatique. Les migrations doivent être compatibles avec l’ancienne version, encore active pendant le rollout. Les modifications de Secrets applicatifs déclenchent un redémarrage des pods.

Les probes web vérifient NGINX ; la readiness API vérifie PostgreSQL, sa liveness vérifie le serveur TCP sans provoquer de boucle de redémarrage lors d’une panne de base. Les conteneurs applicatifs s’exécutent sans root, sans capacités supplémentaires et avec une racine en lecture seule ; seuls leurs `/tmp` respectifs sont inscriptibles.

## Vérifier et exploiter

```powershell
kubectl -n hollyfilms-v3 get pods,jobs,svc,pvc,ingress
kubectl -n hollyfilms-v3 rollout status deployment/hollyfilms
kubectl -n hollyfilms-v3 logs deployment/hollyfilms -c api --tail=100
Invoke-RestMethod https://hollyfilms-v3.chbrx.com/api/health
Invoke-RestMethod https://hollyfilms-v3.chbrx.com/jellyfin/System/Info/Public
```

Vérifier ensuite connexion, restauration de session, lecture/déplacement dans une vidéo, sous-titres, Google et approbations avec un compte de test. Le contrôleur ingress doit fournir une chaîne `X-Forwarded-For` correcte ; le proxy local conserve cette chaîne et Fastify ne fait confiance qu’au saut loopback. Les limites de fréquence sont locales à chaque replica.

PostgreSQL est initialisé vide lors de la première installation. Pour reprendre demandes, décisions, liens Google et critiques du développement, sauvegarder puis restaurer cette base explicitement avant ouverture aux utilisateurs, en conservant `GOOGLE_PASSWORD_KEY`. Les comptes médias restent sur Jellyfin.

Pour sauvegarder PostgreSQL (exemple manuel, à automatiser dans la stratégie de sauvegarde de l’infrastructure) :

```powershell
kubectl -n hollyfilms-v3 exec deployment/hollyfilms-postgres -- pg_dump -U hollyfilms -d hollyfilms -Fc -f /tmp/hollyfilms.dump
$databasePod = kubectl -n hollyfilms-v3 get pod -l app.kubernetes.io/component=database -o jsonpath='{.items[0].metadata.name}'
kubectl -n hollyfilms-v3 cp "${databasePod}:/tmp/hollyfilms.dump" ./hollyfilms.dump
```

`prevent_destroy` protège le PVC et le namespace dans Terraform ; il ne remplace pas une sauvegarde. Le stockage local dépend du nœud. Changer `database_password` dans Terraform ne change pas le mot de passe déjà enregistré par PostgreSQL : effectuer une rotation coordonnée du rôle, du Secret et des pods. Un retour à une ancienne image se fait en planifiant ses anciens digests ; il ne rétrograde jamais le schéma de la base.

## Validation locale sans déploiement

```powershell
terraform -chdir=apps/infrastructure init -backend=false
terraform -chdir=apps/infrastructure fmt -check -recursive
terraform -chdir=apps/infrastructure validate
terraform -chdir=apps/infrastructure test
docker build --target api -f apps/infrastructure/docker/Dockerfile -t hollyfilms-infra-api:qa .
docker build --target web -f apps/infrastructure/docker/Dockerfile -t hollyfilms-infra-web:qa .
corepack yarn test:infrastructure
```

Les tests Terraform utilisent un provider simulé, sans connexion au cluster ni au backend distant. Le test conteneurs utilise une base PostgreSQL isolée, les deux images de production et un serveur média simulé. Il vérifie l’application et la réexécution des migrations, le démarrage sans secrets côté web, les routes SPA, le cache des assets, les refus d’accès API, les requêtes Range et les WebSockets. Il nettoie uniquement ses conteneurs et son réseau.

Les scénarios `media.tftest.hcl` vérifient également la conservation des adresses publiques et internes, des interfaces d’administration privées, du stockage partagé Radarr/SABnzbd et du PVC Wizarr existant.

Le Compose racine reste réservé au développement : Vite et Fastify continuent à démarrer localement avec autoreload et `concurrently`.

### Vérification initiale

Les builds Docker web/API, les quatre scénarios Terraform simulés et le test de conteneurs ont été exécutés. Lint, format, builds applicatifs/Storybook et les tests web passent également. Une requête à l’API publique du Jellyfin réel via l’image NGINX a confirmé le routage HTTPS et la validation de sa chaîne TLS (Jellyfin 12.4.0).

Le cluster a été consulté en lecture seule pour confirmer l’ingress `nginx`, le ClusterIssuer prêt et la StorageClass par défaut. Aucun push GHCR, plan contre l’état distant ou apply n’a été exécuté pendant cette préparation. Le certificat et les parcours utilisateurs sur le nouveau domaine restent à vérifier après le premier déploiement.

## Versions et migration PostgreSQL 18

Les services ont été mis à jour le 18 novembre 2026 ; les versions, sauvegardes et contrôles sont décrits dans [SERVICE-UPGRADES.md](SERVICE-UPGRADES.md). Les images de base Node 24 et NGINX sont figées par digest. Le registre NGINX maintenu est `nginx/nginx-unprivileged`.

Une nouvelle installation utilise PostgreSQL 18 et le PVC `hollyfilms-postgres-18`, monté sur `/var/lib/postgresql`, avec `PGDATA=/var/lib/postgresql/18/docker`. Les installations migrées conservent le PVC original `hollyfilms-postgres` grâce à `database_retain_legacy_volume = true`, enregistré dans leur fichier de variables privé. Le bloc `moved` conserve l’identité Terraform de cet ancien volume. Ne pas retirer cette option sur une installation migrée : la protection de suppression doit rester active.

Le changement de version majeure n’est jamais une simple modification d’image : créer le nouveau volume, restaurer une sauvegarde logique, tester la compatibilité, arrêter les écritures, refaire la sauvegarde/restauration finale et vérifier toutes les tables avant de changer le Deployment. Le Service et son Secret conservent leurs noms et identifiants. `database_major_version = 17` avec l’image 17 correspondante sélectionne le volume historique uniquement pour une reprise contrôlée ; les écritures arrivées depuis la migration doivent être prises en compte avant tout retour arrière. Ne pas appliquer une ancienne version du code Terraform pour effectuer ce retour.

Le Compose de développement conserve le format PostgreSQL 17 avec sa dernière version corrective 17.12 pour ne pas rendre les volumes locaux existants incompatibles. Les tests de demandes, sous-titres et conteneurs de production utilisent PostgreSQL 18.7 ; `HOLLYFILMS_TEST_POSTGRES_IMAGE` permet de tester également une autre version avec le harness API.
