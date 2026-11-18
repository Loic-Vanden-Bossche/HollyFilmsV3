# Synchronisation personnelle des sous-titres

Dans le menu **Sous-titres**, ouvrir **Corriger la synchronisation** pour la piste souhaitée. La vidéo continue à jouer. **Trop tôt** retarde le texte de 200 ms, **Trop tard** le fait apparaître 200 ms plus tôt. Maintenir le bouton répète le réglage. **Réglage précis** utilise un pas de 100 ms.

Pour un écart important, choisir **Recaler sur une réplique**. La vidéo se met en pause et présente quatre répliques proches du passage. La recherche porte sur toute la piste. Sélectionner la bonne occurrence, écouter le passage et appuyer sur **C’est maintenant** au début de la voix. Le bouton devient actif une fois la lecture effectivement repartie. **Rejouer pour vérifier** reprend le même extrait. Il s’arrête après l’ancre, puis la fermeture restitue l’intention de lecture. Un déplacement volontaire sur la timeline demande de confirmer une nouvelle référence.

**C’est bon** enregistre dans PostgreSQL. Fermer ou annuler abandonne l’aperçu, y compris après une réinitialisation. En cas de conflit avec un autre appareil, rouvrir le panneau pour récupérer la dernière version. Les pistes principale et secondaire peuvent garder deux corrections différentes. Le curseur des versions antérieures était en mémoire et ne contenait aucune préférence à migrer.

## Temps et formats

Le modèle utilise des millisecondes entières dans le film complet. L’ajustement manuel est un résidu signé appliqué après la transformation automatique. Pour un repérage, il devient l’heure entendue moins le début de la réplique transformé automatiquement. Les deux bornes de chaque réplique passent par la même transformation. Le lecteur soustrait une seule fois l’origine de la session HLS, en secondes. Les pistes de texte sont demandées à Jellyfin à partir de zéro, indépendamment des segments HLS. Le SDK expose les durées en ticks de 100 ns. La vitesse de lecture ne modifie aucune préférence.

| Chaîne de lecture                                                            | Réglages disponibles                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WebVTT affiché par HollyFilms, issu d’une piste texte séparée ou extractible | Ajustement immédiat, recherche et repérage dès le chargement des répliques. Analyse automatique si Jellyfin fournit également le SRT et l’audio sélectionné est identifiable dans le fichier.    |
| ASS/SSA                                                                      | Décalage dans l’horloge JASSUB. Le mode bilingue ou l’apparence personnalisée utilise la conversion WebVTT existante et permet le repérage. L’analyse de cadence est désactivée pour ces pistes. |
| Bitmap pris en charge par libbitsub                                          | Décalage de l’horloge du renderer.                                                                                                                                                               |
| Incrustation ou lecture distante                                             | Choisir une piste séparée et la lecture locale pour modifier son affichage. En SyncPlay, les réglages locaux restent disponibles et le rejeu individuel est désactivé.                           |

## Moteur serveur

L’image API inclut FFmpeg, Python et **ffsubsync 0.5.1**. En développement, installer FFmpeg dans le PATH et créer un environnement Python 3.11. Depuis la racine, par exemple sous PowerShell :

```powershell
python -m venv "$env:LOCALAPPDATA/hollyfilms-sync"
& "$env:LOCALAPPDATA/hollyfilms-sync/Scripts/python.exe" -m pip install -r apps/api/worker/requirements.txt
$env:SUBTITLE_SYNC_PYTHON = "$env:LOCALAPPDATA/hollyfilms-sync/Scripts/python.exe"
corepack yarn dev
```

Sous Windows, l’API détecte automatiquement l’environnement installé à cet emplacement. Pour utiliser un autre emplacement, renseigner le chemin absolu de l’interpréteur dans le `.env` de l’API. Sous Linux, utiliser le chemin `bin/python` de l’environnement. L’API contrôle la version du moteur et la présence de FFmpeg. Le réglage manuel fonctionne indépendamment de ces exécutables. [Moteur ffsubsync](https://github.com/smacke/ffsubsync)

| Paramètre côté API              | Défaut               | Fonction                                                                 |
| ------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `SUBTITLE_SYNC_PYTHON`          | environnement local¹ | Interpréteur de l’environnement contenant ffsubsync. Fourni par l’image. |
| `SUBTITLE_SYNC_FFMPEG`          | `ffmpeg`             | Exécutable de décodage.                                                  |
| `SUBTITLE_SYNC_ENABLED`         | activé               | `false` désactive les nouvelles analyses.                                |
| `SUBTITLE_SYNC_CONCURRENCY`     | 1                    | Nombre de calculs simultanés pour toute la base, jusqu’à 4.              |
| `SUBTITLE_SYNC_MAX_SECONDS`     | 10800                | Durée maximale du média analysé, jusqu’à 18000 s.                        |
| `SUBTITLE_SYNC_TIMEOUT_SECONDS` | 900                  | Durée réelle maximale d’un travail, jusqu’à 3600 s.                      |
| `SUBTITLE_SYNC_TEMP_MIB`        | 32                   | Limite par fichier du worker sur Linux, jusqu’à 128 Mio.                 |

¹ Sous Linux, la valeur par défaut est `python3`. Sous Windows, l’API cherche d’abord l’environnement décrit ci-dessus, puis `python` dans le PATH.

Le backend vérifie la session, le droit de lecture et la version du média auprès de Jellyfin. Il récupère le SRT de l’index demandé et fait lire à FFmpeg le fichier via un relais HTTP Range éphémère sur loopback. Le relais transmet le jeton de l’utilisateur uniquement à l’origine Jellyfin configurée. Le navigateur transmet des identifiants. Aucun montage du répertoire vidéo n’est nécessaire. Les jetons et les adresses de lecture ne sont ni enregistrés avec les jobs ni fournis au moteur Python.

FFmpeg sélectionne explicitement le flux audio demandé. Le PCM mono 16 kHz est envoyé par tube à la détection de voix WebRTC. Le worker compare l’activité vocale avec les plages des sous-titres, indépendamment de leur langue. Il teste les rapports de cadence pris en charge par ffsubsync et un décalage global allant jusqu’à 180 s. Il contrôle la cohérence sur quatre zones de dialogue avant de proposer un essai. Un montage différent, peu de voix ou des sous-titres forcés peuvent donner un résultat indéterminé. Un écart local qui varie fortement d’une zone à l’autre signale un autre montage possible. Les coupures ne sont pas corrigées par segments. L’analyse accepte les conteneurs vidéo classiques, dont Matroska, MP4, MPEG-TS et AVI. L’identification de la révision accepte jusqu’à 4 Mio de texte ou 64 Mio de sous-titres bitmap. Le son décodé, les dialogues et le masque vocal restent transitoires. La partition temporaire du conteneur API est limitée à 128 Mio.

## Stockage et API

Appliquer `corepack yarn db:deploy` avant de démarrer la nouvelle API, puis utiliser les images web et API de la même version. Le job Terraform de migration existant applique aussi cette migration. Les deux nouvelles tables sont additives. `SubtitleTiming` conserve la révision, l’ajustement manuel et l’alignement choisi. `SubtitleAnalysis` conserve la proposition, le propriétaire, la progression et la version du moteur. Le contexte combine l’instance, le média, la source et sa révision Jellyfin, le flux audio, la piste de sous-titres et une empreinte SHA-256 de son contenu. Les fichiers de la bibliothèque restent intacts.

Toutes les routes sont relatives à `/api/subtitle-sync/{item}/{source}/{audio}/{subtitle}` et nécessitent la session Jellyfin.

| Méthode             | Opération                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET                 | Capacités serveur, correction validée, révision et dernier job compatible.                                                                                                |
| PUT                 | Enregistrement avec empreinte et révision attendues. Une correction d’identité avec résidu nul réinitialise la préférence et avance la révision. Un conflit retourne 409. |
| POST `/jobs`        | Analyse de la source originale. Deux demandes identiques du même compte réutilisent le travail. L’aide permet de relancer une analyse complète.                           |
| GET `/jobs/{id}`    | Étape réelle, secondes audio traitées pendant la détection et transformation éventuelle.                                                                                  |
| DELETE `/jobs/{id}` | Annulation d’un calcul actif appartenant au compte.                                                                                                                       |

Fermer le panneau détache le lecteur du calcul. La proposition reste consultable à la prochaine ouverture. Une modification manuelle faite entre-temps invalide l’essai de la proposition dans ce brouillon. Un arrêt brutal de l’API rend l’ancien travail réessayable après expiration du délai maximal et d’une minute de marge. La limitation de concurrence utilise PostgreSQL, y compris avec plusieurs réplicas.

## Vérification

- `corepack yarn test:subtitle-sync` utilise Docker, un PostgreSQL isolé, l’interpréteur configuré ci-dessus et un FFmpeg incluant le filtre de synthèse vocale `flite`. Le test fabrique un fichier à deux flux audio, mesure un décalage connu, vérifie une dérive 25/24, une rupture de montage, le silence et la concurrence.
- `corepack yarn test:player` lance Jellyfin, PostgreSQL et Chrome avec des médias synthétiques. Le parcours vérifie le déplacement d’un vrai cue, le repérage, l’annulation et la restauration après rechargement.
- Pour un essai manuel, lancer un film avec deux langues. Retarder la première, rejouer le passage deux fois, valider et recharger. Ouvrir la seconde, choisir une réplique, écouter, marquer son début, puis annuler pour retrouver son réglage initial.

En cas d’échec, le lecteur affiche une cause et la référence de l’analyse. Rechercher cette référence dans le champ `jobId` des logs de l’API Fastify (message `Subtitle analysis failed`). L’événement indique l’étape, la durée audio déjà analysée et, selon le cas, le statut HTTP de Jellyfin ou le code de sortie de FFmpeg ou de ffsubsync. Le serveur conserve la cause pour la réouverture du panneau. Les diagnostics excluent le texte des sous-titres, les chemins de fichiers et les jetons.
