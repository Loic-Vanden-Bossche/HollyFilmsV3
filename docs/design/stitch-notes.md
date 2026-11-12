# Stitch — generated design notes

These are the original generator notes, preserved for design review. They describe a visual proposal, **not verified product capabilities**. The implementation omits invented services, guarantees, technical formats, filters and server controls. See [README](README.md) for the actual scope.

Voici l'écran amiral **HollyFilms 3.0 — Accueil Cinéma & Catalogue** (Desktop 1440px), conçu sur mesure pour une expérience de streaming privé haut de gamme.

### Choix de design & Architecture visuelle :

1. **Identité de marque & Ambiance Cinéma** :
   - Fond d'un bleu nuit minuit profond (`#080f1b`) enrichi d'aurores lumineuses subtiles aux teintes vert émeraude (`#4ade80`), cyan électrique et bleu roi (`#3b82f6`).
   - Logotype personnalisé avec l'icône triangulaire biseautée caractéristique de HollyFilms et badge de version « 3.0 ».
   - Typographie **DM Sans** contemporaine, avec titrages percutants et espacement serré (_tightly tracked_), sans aucune italique, accompagnés d'overlines sobres en majuscules espacées.

2. **Navigation de tête feutrée** :
   - Liens de navigation épurés (_Accueil_, _Films_, _Séries_, _Nouveautés_).
   - Barre de recherche omni-chercheur (_⌘K_) avec retour de statut du serveur privé en direct (_« Serveur Privé • En ligne »_).
   - Menu profil administrateur cinématographique.

3. **Hero Spotlight Cinématographique** :
   - Mise en avant de _Dune : Deuxième Partie_ avec synopsis concis, métadonnées complètes (critiques TMDB 8.6, Rotten Tomatoes 94%, 4K UHD, HDR10+, Dolby Atmos, IMAX Enhanced).
   - Boutons d'action : bouton principal lumineux _« Lire le film »_, bouton secondaire en verre dépoli _« Voir la fiche »_, et raccourci liste.
   - Sélecteur minimaliste des temps forts au bas du Hero (_Dune 2_, _Oppenheimer_, _Blade Runner 2049_, _Interstellar_).

4. **Rail de reprise (« Reprendre la lecture »)** :
   - Cartes vidéo panoramiques au format 16:9 avec barres de progression temporelle, temps restant précis et badges techniques (TrueHD Atmos, 4K Dolby Vision, IMAX).

5. **Grille Catalogue (Affiches 2:3)** :
   - Filtres thématiques par genre et menu déroulant de tri (_Mieux notés IMDb 8+_).
   - Affiches avec badges qualitatifs (4K Remux, HDR10+, Palme d'Or), indicateurs audio multilingues (_FR / VO Atmos_), statut vu et mention spéciale _« Version Longue »_.
   - Survol préparé avec commandes d'actions rapides (favoris, marquage comme vu).

6. **Pied de page & moteur HollyCore™** :
   - Bannière technique discrète résumant la prise en charge du transcodage matériel direct (HEVC Main10, AV1, Dolby Vision, DTS:X, 10 Gbps symétrique).

Le Design System associé est prêt pour décliner les écrans de détail de film, de lecteur vidéo haute fidélité et d'administration serveur.

## Suggested follow-up screens

- Générer la vue modale / fiche détaillée d'un film (Dune 2) avec casting et flux audio/vidéo
- Concevoir l'interface du lecteur vidéo plein écran immersif HollyFilms Player
- Créer la vue d'administration et de gestion des bibliothèques & transcodage
