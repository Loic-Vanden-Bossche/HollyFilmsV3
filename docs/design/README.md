# HollyFilms — Aurora Cinema

Redesign created with the Stitch MCP on 12 November 2026 and adapted to the existing React application.

- Stitch project: `15034118483886808457` — HollyFilms 3.0, Complete cinematic redesign.
- Generated design system: `assets/ed7b2536014b427dbd60982ad4e10d02`.
- Catalogue reference screen: `04e69734c6504ad6932451482fb37b3e`.
- [Generated design system](stitch-design-system.md), [HTML visual reference](stitch-home.html), [original generator notes and suggestions](stitch-notes.md).

The HTML is a design reference only. It is not loaded by Vite, imported into React or used as a second application. Its sample imagery, fictional technical claims and speculative controls are not production requirements.

Stitch generated the design system and catalogue screen successfully. A second request for the remaining screens timed out after 300 seconds; bounded polling did not reveal additional screens. Those views were adapted directly in React from the shared design direction rather than presented as additional Stitch-generated mockups.

## Implemented direction

The existing HollyFilms logo and custom font remain the brand identity. DM Sans, navy surfaces, green-to-blue actions, soft glass and larger typography form the shared visual language. Tailwind tokens live in `apps/web/tailwind.config.js`; the responsive stage spacing is exposed to CSS through `theme('spacing.stage')`.

| Screen             | Implementation                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public landing     | Framed, full-viewport composition with the animated catalogue, feature reel and projector background. No page scroll; catalogue remains noninteractive.                              |
| Authentication     | Responsive split composition, animated graphic, pill mode switch and actions, clear labels and approval message. Compact form on narrow screens, scrollable dialog on short screens. |
| Home and catalogue | Separate navigation, inset cinematic hero, pill controls, clearer section hierarchy, framed poster and resume cards with dedicated metadata panels.                                  |
| Film details       | Larger high-resolution artwork, spacious typography, ratings, watched status, quality, languages and edition when those fields exist.                                                |
| Player             | Consistent glass dock, rounded controls, larger title, matching menus and spacing. Existing playback engine and controls preserved.                                                  |
| Administration     | Request counts, status filters, responsive request rows, decision history, error/retry actions and animated filtering. Counts derive from actual requests.                           |

## Behavioral constraints

- Existing approval gate, per-tab sessions, Google flow and backend authorization are preserved.
- Existing Motion animations, React Bits card tilt/spotlight, keyboard and touch behavior remain active. Reduced motion disables physical movement.
- Shared artwork transitions run only between media artwork and the player, never between catalogue cards and details.
- No new external runtime dependency, placeholder catalogue, fake format guarantee or server-management capability is introduced.

## Review and verification

Run `corepack yarn dev` and `corepack yarn storybook`. Main stories are under HollyFilms/Vitrine, HollyFilms/Accueil, HollyFilms/Connexion, HollyFilms/Administration, UI/Fiche média and UI/Lecteur.

Validation covers desktop and mobile layouts, a 320×568 portrait viewport, an 844×390 landscape viewport, reduced motion, authentication mode changes and dismissal, approval filtering, card keyboard/actions, details playback, timeline previews and artwork/player transitions. The isolated player test exercises Jellyfin 12.4 with synthetic media. Real Google authorization was not repeated because its implementation did not change.

Required repository checks: `corepack yarn lint`, `corepack yarn format:check`, `corepack yarn build`, `corepack yarn build-storybook`, `corepack yarn test`, `corepack yarn test:player`.

All six commands passed on 12 November 2026, together with 33 Storybook interaction stories. Additional mobile/reduced-motion checks passed for card keyboard controls, timeline previews and backdrop dismissal. WebStorm reported no errors in the changed authentication, administration and film-details components. Production and Storybook builds still report large-chunk warnings for existing runtime bundles.
