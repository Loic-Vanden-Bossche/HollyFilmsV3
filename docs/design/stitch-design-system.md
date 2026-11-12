---
name: HollyFilms Aurora Cinema
colors:
  surface: '#0c1320'
  surface-dim: '#0c1320'
  surface-bright: '#323947'
  surface-container-lowest: '#070e1a'
  surface-container-low: '#151c28'
  surface-container: '#19202c'
  surface-container-high: '#232a37'
  surface-container-highest: '#2e3542'
  on-surface: '#dce2f4'
  on-surface-variant: '#bccabb'
  inverse-surface: '#dce2f4'
  inverse-on-surface: '#2a313e'
  outline: '#869486'
  outline-variant: '#3d4a3e'
  surface-tint: '#4de082'
  primary: '#6bfb9a'
  on-primary: '#003919'
  primary-container: '#4ade80'
  on-primary-container: '#005e2d'
  inverse-primary: '#006d36'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#a9ede1'
  on-tertiary: '#003731'
  tertiary-container: '#8dd1c5'
  on-tertiary-container: '#0c5b52'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6dfe9c'
  primary-fixed-dim: '#4de082'
  on-primary-fixed: '#00210c'
  on-primary-fixed-variant: '#005227'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#abf0e3'
  tertiary-fixed-dim: '#8fd3c7'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005047'
  background: '#0c1320'
  on-background: '#dce2f4'
  surface-variant: '#2e3542'
typography:
  display-hero:
    fontFamily: DM Sans
    fontSize: 56px
    fontWeight: '800'
    lineHeight: 60px
    letterSpacing: -0.03em
  headline-xl:
    fontFamily: DM Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: DM Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: DM Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  overline-tracked:
    fontFamily: DM Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.15em
  badge-tech:
    fontFamily: DM Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.08em
  label-btn:
    fontFamily: DM Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system defines an immersive, cinematic private streaming platform tailored for discerning cinephiles. It deliberately departs from generic administrative dashboards and flat SaaS interfaces in favor of a theater-like atmosphere dominated by deep midnight shades and soft, luminous aurora lighting.

### Personality & Tone

- **Prestigious & Exclusive:** Uncompromising fidelity, meticulous editorial curation, and a sense of private collection ownership.
- **Cinematic & Moody:** Deep, rich black-blues that yield absolute visual primacy to cover art, key stills, and high-definition dynamic range.
- **Precision Engineered:** Ultra-crisp data badges, sharp typographic scale, and disciplined metadata presentation (audio stream specs, technical formats, critic ratings).

### Design Movement

- **Atmospheric Glassmorphism & Aurora Luminescence:** Translucent frosted panes (`backdrop-blur-md bg-white/[0.04] border border-white/[0.08]`) accented by diffused directional glows shifting smoothly between emerald, electric teal, and deep cinema blue.

## Colors

The palette is built upon a nocturnal continuum ranging from void-like navy to elevated crystalline surfaces, accented by an energetic cinematic spectrum running from emerald green through electric teal into radiant cobalt blue.

### Foundation Tones

- **Canvas Base (`#080f1b`):** The foundational viewport ground, soaking in backdrop light without true-black harshness.
- **Surface Container (`#0d1726`):** The contextual plane for rails, navigation bars, and grouped content zones.
- **Card Elevated / Border Active (`#132238`):** Raised interactive containers, modal backdrops, and card envelopes.

### Aurora Spectrum

- **Primary Aurora (`#4ade80`):** Emerald accent representing live activity, playback progress, positive matches, and primary CTA accents.
- **Secondary Aurora (`#3b82f6`):** Electric blue for subtle lighting backdrops, secondary navigation focal points, and focus states.
- **Highlight Mint (`#b0f5e8`):** Ultra-bright pale mint reserved strictly for typographic pips, pristine ratings, and high-priority badge highlights.

### Functional States

- **Text Primary:** `#f8fafc` (Slate 50) for unmatched contrast against midnight grounds.
- **Text Muted / Metadata:** `#94a3b8` (Slate 400) for disciplined data density.
- **Glass Shimmer:** `rgba(255, 255, 255, 0.04)` fill with an outer rim stroke of `rgba(255, 255, 255, 0.08)`.

## Typography

Typographic rhythm relies on `DM Sans` throughout the entire interface to maintain high-precision modernity without shifting font personalities across contexts.

### Typographic Rules

- **No Italics:** Italics compromise the architectural geometry of modern cinematic UI; emphasis is created via weight and tracking instead.
- **Title Tracking:** Headlines and displays utilize tight negative tracking (`-0.02em` to `-0.03em`) to mimic contemporary high-budget film posters.
- **Overline Badges & Categories:** Category labels, franchise headers, and metadata badges are rendered in uppercase using `overline-tracked` with generous tracking (`0.15em`) in Slate 400.

## Layout & Spacing

The layout is optimized for high-end wide displays (primary target: 1440px viewport) utilizing an asymmetric edge-to-edge content stage with fixed left navigation dock and fluid rail structures.

### Grid & Composition

- **Main Canvas:** 1440px nominal canvas with 48px outer stage margins (`margin: 3rem`) ensuring media posters have breathing room from screen boundaries.
- **Catalog Rails:** Horizontal scrolling carousels with uniform 24px column gaps (`gutter: 1.5rem`).
- **Aspect Ratios:**
  - **Resume / In-Progress:** Strict 16:9 ratio with bottom-anchored scrub progress indicators.
  - **Catalog Posters:** Strict 2:3 vertical film poster ratio.
  - **Hero Feature Showcase:** Dynamic 21:9 panoramic billboard container with left-aligned editorial content and gradient right-fade.

## Elevation & Depth

Depth is created through ambient luminous backsplashes and layered frosted panes rather than traditional drop shadows.

### Atmospheric Planes

- **Tier 0 (Base Canvas):** Flat `#080f1b` with subtle static noise and soft radial ambient blurs (`radial-gradient(circle at 15% 10%, rgba(74, 222, 128, 0.08) 0%, transparent 40%)`).
- **Tier 1 (Surface Containers):** Solid `#0d1726` with 1px border `rgba(255, 255, 255, 0.05)`.
- **Tier 2 (Glass Floating Shells):** `backdrop-blur-md bg-white/[0.04]` bordered by `rgba(255, 255, 255, 0.08)`. Applied to header bars, quick action menus, and hovering media detail cards.
- **Tier 3 (Active Focus / Hover Elevation):** Transform scale `1.03` accompanied by a localized cyan-emerald aurora aura: `box-shadow: 0 16px 36px -10px rgba(59, 130, 246, 0.25), 0 0 24px 2px rgba(74, 222, 128, 0.18)`.

## Shapes

A balanced curvature framework (`roundedness: 2`) maintains sleek architectural discipline without feeling cartoonish or aggressive.

### Shape Hierarchy

- **Base Components & Input Elements:** 8px border radius (`rounded-md`).
- **Poster Cards & Section Containers:** 16px border radius (`rounded-lg`).
- **Pill Badges & Media Action Buttons:** Full pill geometry (`rounded-full`) to clearly demarcate clickable commands from content containers.

## Components

### Action Buttons

- **Bouton de lecture principal ("Lire"):**
  - High-impact CTA filled either with pure crisp white (`#ffffff` text `#080f1b`) or a linear aurora gradient (`linear-gradient(135deg, #4ade80, #38bdf8, #3b82f6)` with dark slate text).
  - Shape: `rounded-full`, height 44px, padding 0 24px, icon leading gap 8px.
- **Bouton secondaire ("Voir la fiche"):**
  - Frosted surface: `backdrop-blur-md bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.12]`.
  - Shape: `rounded-full`, height 44px, padding 0 20px.

### Badges & Metadata Chips

- **Format Technique (4K HDR, Dolby Atmos):**
  - Ultra-compact pill badges with dark slate-900 glass fill, border in `rgba(255, 255, 255, 0.15)`, text `badge-tech` in `#f8fafc`.
- **Scores Critiques (RT 94%, TMDB 8.6):**
  - High-fidelity inline pill with custom accent glow: TMDB uses vibrant electric blue pip; RT uses emerald `#4ade80` accent text.
- **Audio & Sous-titres (FR / VOSTFR):**
  - Uppercase tracked tag with micro icon indicating multi-audio availability.

### Media Cards

- **Reprendre (16:9 Ratio):**
  - Integrated persistent progress bar along bottom card edge: track background `rgba(255, 255, 255, 0.2)`, filled with gradient from `#4ade80` to `#38bdf8`.
  - Hover state reveals quick action overlay with frosted floating play button in center.
- **Affiche Catalogue (2:3 Ratio):**
  - Rich corner-anchored tech badges (4K, Atmos) positioned top-right with `top: 10px; right: 10px`.
  - Title and year hover reveal sliding up from bottom with subtle gradient mask `rgba(8, 15, 27, 0.95)`.

### Form Controls & Search Field

- **Barre de Recherche:**
  - Full pill frosted container with subtle inner glow, leading magnifier icon in `#94a3b8`, placeholder text "Rechercher un film, réalisateur, saga..." in `#64748b`.
