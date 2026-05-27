# Product

## Register

product

## Users

Music curators who own their library (rips, downloads, Bandcamp, demos, DJ sets) and refuse to hand it to a streaming platform. They have a tagging mental model that no existing app supports and want a query language powerful enough to use it. They care deeply about the feel of opening an app — not just whether it works. May invite friends to a shared instance or run a tiny self-hosted deployment.

Context: desktop-first (dark room, high-quality speakers or headphones, focused listening session). Also mobile for casual browse.

## Product Purpose

Personal music library with custom tagging and boolean filtering (AND/OR/NOT with parentheses). Power-user features (trim times, per-playlist crossfade, Jam/Shuffle-Jam) stay one motion away — visible to the curious, invisible to the casual. The primary job: find the right song for the moment, then get out of the way. Opening Aurora should feel like picking up a record, not launching a productivity app.

## Brand Personality

Tactile. Atmospheric. Curatorial. The design language is "Northern Lights over OLED" — pure black, per-song dominant-color bleed, specular liquid-glass surfaces, editorial italics, mono in the functional cluster.

Not: minimalist utility (Foobar), streaming clone (Spotify), server-pair utility (Feishin), or AI-default glassmorphism (purple-pink-Inter-everywhere).

## Anti-references

- Spotify/Apple Music/YouTube Music — cloud, algorithmic, owns your taste
- Foobar2000/Tauon — tracker grid, function-first, ugly-on-purpose
- Feishin/Nora — server-pair UIs, utility-grade aesthetics
- Any purple → pink linear gradient UI
- Soft-corner translucent panels with no specular highlight
- Inter/Roboto/Space Grotesk body text
- Material-style spring bounces (overshoot + settle)
- Gradient text on a gradient background
- Centered hero with three feature cards below

## Design Principles

1. **Opening it should feel like something.** The surface is the front door, not the feature list.
2. **Power without ceremony.** Complex features (boolean queries, trim times, crossfade) live one motion away — never buried, never forced.
3. **Per-song atmosphere, not global palette.** Color bleed from album art is the living signal; neutral surfaces let it breathe.
4. **Earn every visual decision.** Every pixel must justify itself against "Northern Lights over OLED." If it doesn't earn the aesthetic, cut it.
5. **Density where needed, air where earned.** Song/tag tables can be dense. Player chrome gets generous whitespace.

## Accessibility & Inclusion

WCAG AA minimum. Keyboard navigation required for all player controls and navigation. Reduced-motion media query must suppress all decorative animations. Color contrast for text on dark surfaces must be verified — the per-song bleed must not compromise readability.
