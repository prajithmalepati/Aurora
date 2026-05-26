Same voice. Concrete and prioritized — fold these into the spec or argue back.

## Decisions to lock before Phase 2 (these block implementation)

1. **Pick ONE aurora-as-identity move and put it in the spec.** Default if you can't decide: filter query drives aurora intensity (not album color). Album color stays in the fringe; the filter drives the *curtain density and rhythm*. Rationale: it ties the lights to the differentiating feature (boolean filter), not the passive feature (album metadata). One paragraph in the spec, not a phase. ~3 lines of GLSL change (curtain count + speed bound to a `uFilterDensity` uniform fed by `filterStore.results.length` normalized log scale).

2. **Resolve the hue conflict.** Filter chrome `oklch(0.06 0.005 240 / 0.95)` → change to `oklch(0.06 0.004 195 / 0.95)`. Cool but in the same family as the aurora teal. Same fix on all dark surfaces in the spec.

3. **Kill the star from the play button. Keep specular + bloom.** One sentence in the spec: "No interior star. The aurora behind the button, viewed through glass, IS the star." This removes one decorative atom from the highest-pressed surface and stops duplicating the wordmark device.

4. **Lock variable-font axis values.** Don't ship "Fraunces variable, italic axis" — ship numbers:
   - Wordmark: Fraunces, `wght 400`, `opsz 144`, `SOFT 50`, `ital 1`
   - Section heads: Fraunces, `wght 500`, `opsz 48`, `ital 0`
   - Body: Geist, `wght 400`, `opsz auto`
   - Body emphasis: Geist, `wght 600`
   - Mono: JetBrains Mono, `wght 400`, no italic
   Pick once. Engineering will not pick well.

5. **Decide the per-song color crossfade contract.** All five consumers (`uColor2`, `--song-color`, waveform fill, halo, bleed) tween from a *single* driver — a 300ms `requestAnimationFrame` interpolation running on song change that writes the intermediate OKLCH value to the CSS variable. The shader reads from that. Removes the "color smear" frame I flagged. Add this paragraph to §3.

## Spec sections you don't have and need

### Track Transition Choreography (add as new section)

```
Song change is the most cinematic moment in the app. Choreograph it.

t=0ms:      old song ends OR user selects new song
t=0–200ms:  outgoing waveform peaks fade to 40% opacity (current --song-color)
t=100ms:    --song-color begins 300ms OKLCH lerp to new color
t=100ms:    uColor2 begins 300ms shader lerp (same easing as --song-color)
t=200ms:    waveform peaks swap to new Float32Array, fade back to 100%
t=300ms:    bleed/halo pseudo-elements at full new color
t=400ms:    transition complete

Easing: cubic-bezier(0.16, 1, 0.3, 1) on all five tracks.
Driver: useSongTransition() hook; emits normalized [0..1] each frame; consumers read.
```

### State Matrix (add as new section — this is the missing spine)

A table covering every primary surface × every state. One row per surface, one column per state. Surfaces: PlayButton, NavItem, SongRow, FilterInput, TagChip, Wordmark, AlbumArt. States: rest, hover, active, focus, pressed, selected, playing, loading, disabled, error. Fill the cells with token references, not values. ~30 minutes of work; saves a week of inconsistency.

### Empty / Loading / Error States (add as new section)

| State | What user sees |
|---|---|
| Empty library, never scanned | Aurora at 40% (idle), wordmark prominent, primary CTA "Scan music folder" |
| Scanning in progress | Aurora at 30%, top progress bar (1px, `--song-color` default teal), inline "Scanned X of Y" in JetBrains Mono |
| Scan failed | Aurora at 20%, inline error chip near scanner CTA, JetBrains Mono error code |
| No song playing | Aurora at 40% (idle pulse), PlayerBar collapsed, play button at disabled treatment (40% opacity) |
| Buffering | Star pulse 1.5s cycle (already speced); waveform shows skeleton if peaks not yet loaded |
| Missing album art | `--song-color` defaults to brand teal (already speced); halo + bleed render at 40% opacity instead of suppressing (so the user reads "art missing" not "system off") |
| Filter returns 0 results | Aurora intensity drops to 10%; chrome darkens slightly; result region shows JetBrains Mono "0 matches" + clear-filter affordance |
| API offline | Aurora freezes (no shader updates); a thin amber line at top of viewport; toast |

### Focus Model (add as new section)

- Focus ring color: `color-mix(in oklch, var(--song-color) 60%, white 20%)` — picks up the song's accent, stays high-contrast
- Focus ring shape: `box-shadow: 0 0 0 2px <color>, 0 0 0 4px oklch(0 0 0 / 0.6)` — double ring, outer dark halo ensures contrast against the aurora
- Tab order: sidebar nav → filter input → song list (arrow keys within) → PlayerBar controls
- Visible-only-on-keyboard: `:focus-visible`, never `:focus`

### Performance Budget (extend §Performance Budget)

Add concrete numbers, not "target 60fps":
- Aurora shader: ≤ 3ms/frame at 1440p. Auto-downshift to half-resolution if median frame time exceeds 4ms over 60 frames.
- Color bleed gradient: render once on song change to an offscreen canvas, composite as image. Don't repaint the 60px blur per frame.
- Waveform repaint: only on time-update events (`requestAnimationFrame` at ≤ 30fps is enough — the playhead doesn't need 60fps).
- Memory: WebGL context retained for app lifetime, never destroyed. `analyser.disconnect()` on song unmount, `analyser.connect()` on new song. Verified leak-free with 100 song changes.
- Bundle: <50KB additional gzipped post-overhaul (fonts subset + culori tree-shaken).

## Token system (define before Phase 2 — currently the biggest gap)

Drop this into `frontend/src/styles/tokens.css` or equivalent. Everything in the spec then references tokens, not raw values.

```
:root {
  /* Surfaces — all in aurora hue family (195), not 240 */
  --surface-0: oklch(0.04 0.003 195);            /* app bg behind shader */
  --surface-1: oklch(0.06 0.004 195 / 0.95);     /* filter chrome */
  --surface-2: oklch(0.08 0.006 195 / 0.92);     /* card / row hover */
  --surface-raised: oklch(0.10 0.008 195 / 0.90);

  /* Borders — neutral white at low alpha */
  --border-faint: rgb(255 255 255 / 0.06);
  --border-quiet: rgb(255 255 255 / 0.10);
  --border-strong: rgb(255 255 255 / 0.18);

  /* Text — luminance assumes 0.08 max behind */
  --text-primary:   rgb(255 255 255 / 0.92);
  --text-secondary: rgb(255 255 255 / 0.68);
  --text-tertiary:  rgb(255 255 255 / 0.42);
  --text-disabled:  rgb(255 255 255 / 0.28);

  /* Brand + dynamic */
  --aurora-teal: oklch(0.72 0.18 195);
  --song-color: var(--aurora-teal);              /* lerps per song */
  --song-color-2: var(--aurora-teal);

  /* Motion */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 120ms;
  --dur-base: 200ms;
  --dur-slow: 300ms;
  --dur-transition: 400ms;     /* song change choreography */

  /* Space (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Radius */
  --radius-sm: 2px;       /* tag chips */
  --radius-md: 6px;       /* inputs, rows */
  --radius-lg: 12px;      /* cards */
  --radius-pill: 999px;   /* play button */

  /* Elevation (z + glow) */
  --halo-art: 0 0 60px 12px color-mix(in oklch, var(--song-color) 40%, transparent);
  --focus-ring: 0 0 0 2px color-mix(in oklch, var(--song-color) 60%, white 20%), 0 0 0 4px oklch(0 0 0 / 0.6);
}
```

The spec's current `oklch(0.06 0.005 240 / 0.95)`, `rgba(255,255,255,0.18)`, etc. all become token references. First time you want to tune density or contrast, it's one file.

## Anti-slop checks (your stated concern)

These prevent the "AI-default music app" outcome:

1. **Reject any treatment that could appear in a 2024 Spotify clone.** The frosted-glass-over-aurora play button on its own *is* the 2024 Apple Music clone. The element that breaks it out: the **playback-state bloom**. Hold that as the differentiator and remove anything that competes (the interior star).

2. **Use Fraunces *less* than the spec implies.** Wordmark only, plus one section title per view. If a designer hands you a Figma where Fraunces appears 5 times, reject it.

3. **No emoji icons. No Lucide-default icon style at default weight.** If you're using Lucide, set `stroke-width: 1.25` globally — the default 2 is the AI tell. Or commit to Phosphor `<duotone>` at fixed weight.

4. **Never `border-radius: 8px` on everything.** The spec needs at least 3 radii in active use. Tag chip ≠ card ≠ album art ≠ play button. Default 8px on everything is the slop signature.

5. **The grain overlay opacity is doing real work.** Spec says 5%. Test at 3, 5, 7 on actual hardware. 5% sounds right but on OLED with WCG it may need 3%. Don't trust the value, verify it.

6. **The shader needs intentional asymmetry.** If the aurora curtains are evenly spaced, it reads as procedural. Stagger their phases with prime-number offsets (3.7s, 5.1s, 7.3s curtain periods) so they never realign on screen. This is the difference between "shader" and "northern lights."

## Two things to actually test

7. **Playwright for visual regression on the calm regions contract.** Real test: screenshot the library view, dominant color sampled in the text region must have luminance < 0.08. Fail the build if not. The contract is only real if it's enforced.

8. **Build a 10-second "song change reel" demo page** before Phase 4 ships. Cycle through 8 songs with wildly different art (Joy Division, Bandcamp neon, ECM monochrome, anime OST, classical, drone metal, jazz, pop). Watch the transition. If any one looks broken or jarring, the spec is wrong. This is cheaper than discovering it during Phase 6.

## One thing to drop from your worry list

You're spending energy on "is this premium?" Stop. The thing that will make Aurora feel premium isn't another effect — it's **restraint**. Cut the interior star. Cut any treatment you can't defend in one sentence. The current spec is already too dense with ideas; the next move is subtraction, not addition. Premium music apps (Bandcamp Pro, ECM's website, Endel) feel premium because they refuse to decorate. Hold to that.