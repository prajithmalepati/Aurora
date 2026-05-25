# Aurora Visual Overhaul — Design Spec

**Date**: 2026-05-25  
**Status**: Approved for implementation  
**Spec owner**: Session 25 brainstorm

---

## Vision

Aurora OS — not a music player you use, but an environment you inhabit. Open the app and watch genuine northern lights respond to your music in real time. The UI chrome is minimal and dark; the atmosphere IS the interface. Album art colors shift the aurora's hue. The progress bar is a live waveform that wavers to the music.

---

## Aurora Calm Regions Contract

The aurora is a backdrop, not the main event. It must not compete with the UI.

| View | Aurora intensity | Why |
|---|---|---|
| Library / Song list | 20% | Dense text; aurora is wallpaper |
| Filter / Query bar active | 15% | User is in work mode |
| Playlist detail | 25% | Moderate density |
| Now-playing (expanded PlayerBar) | 80% | This is the moment |
| Idle (no song, no interaction 30s) | 40% | Ambient screensaver feel |

Intensity = `uIntensity` uniform (0–1), CSS transition 600ms ease-out between states.

**Text region luminance cap:** Aurora max luminance in any region where UI text sits = 0.08 (8% white). Enforced by keeping shader colors OKLCH lightness ≤ 0.25 and alpha ≤ 0.6. All text contrast tested against this worst-case luminance floor, not against black.

**Amplitude sensitivity:** Curtains pulse only on transients (sudden amplitude spikes ≥ 0.3 above rolling average), not on continuous loudness. Prevents "Winamp visualizer" feel during sustained loud passages.

---

## Core Visual Direction

### 1. Background: Genuine Aurora GLSL Shader

Custom GLSL fragment shader mounted on a fullscreen `<canvas>`. NOT @paper-design/shaders-react — that library's effects (MeshGradient, Warp, Waves, NeuroNoise) don't produce aurora borealis. We need layered sinusoidal curtains.

**Shader behavior:**
- Layered sinusoidal light curtains moving vertically, multiple bands
- `uColor1` = fixed brand teal (`oklch(0.72 0.18 185)`) — identity constant, never overridden
- `uColor2` = album dominant color fringe — changes per song (see color pipeline)
- White-hot core: derived from `uColor1` at high lightness, always fixed
- Perlin noise variation in curtain shape (prevents mechanical repetition)
- `uAmplitude` uniform: transient-sensitive (spikes ≥ 0.3 above rolling average), not continuous loudness
- `uIntensity` uniform: view-driven (see Calm Regions Contract above)
- 300ms lerp on `uColor2`, 600ms on `uIntensity`, snap on `uAmplitude`
- `prefers-reduced-motion`: `uIntensity` = 0, static gradient via CSS fallback

**React implementation:**
- Single `<canvas>` in AppShell, `position: fixed`, `z-index: 0`, `pointer-events: none`
- `useEffect` initializes WebGL context, compiles shader, stores uniform locations
- `requestAnimationFrame` loop: tick `uTime`, push `uAmplitude`, draw
- `useAudioAnalyser` hook: `AnalyserNode` → `getByteFrequencyData` → normalize low-mid range → uniform
- Bundle cost: 0 extra KB (WebGL is browser-native)

### 2. Progress Bar: Pre-Computed Waveform SVG

Replace the flat progress `<input type="range">` visual with a wavy SVG waveform. The actual `<input>` stays hidden for accessibility (seek still works via keyboard/drag).

**On song load:**
1. `fetch(songUrl)` → `arrayBuffer` → `AudioContext.decodeAudioData`
2. Sample amplitude peaks across N bins (bin count = container width in px)
3. Normalize to `[0, 1]`, store as `Float32Array` on song object
4. Fallback: flat line array if decode fails

**Render:**
- SVG `<path>` spanning full bar width, wavy shape from peak data
- Left of playhead: filled + glowing in `--song-color` (album dominant color)
- Right of playhead: dim outline `rgba(255,255,255,0.15)`
- Playhead: 1px vertical line in `--aurora-accent`
- `requestAnimationFrame` updates split point while playing
- Paused: wave shape frozen, no animation

**Interaction:**
- Click maps x% → seek time (same as current range behavior)
- Hidden `<input type="range">` overlaid for keyboard + screen reader

### 3. Per-Song Color Pipeline

**Computed at scan time, not at playback time.** Backend scanner (already runs mutagen) gains two new columns:
- `waveform_peaks` on `songs`: JSON array of 1000 normalized floats [0–1]
- `dominant_color` / `dominant_color_2`: OKLCH strings of top 2 album art clusters

**Scanner additions (`backend/app/services/file_scanner.py`):**
1. After mutagen metadata: decode audio peaks via `audioop`/`miniaudio` → 1000-bin normalize
2. Draw album art to 64×64 PIL Image → K-means (scikit-learn or pure Python)
3. Filter near-grays (chroma < 0.05) + near-white/black (L < 0.15 or L > 0.85)
4. Top 2 clusters → OKLCH adjust (chroma ≥ 0.15, L clamped 0.4–0.7) → store as strings

**Frontend (song load = zero computation, reads from API):**
1. `song.dominant_color` → CSS `--song-color` on `:root`
2. `song.dominant_color_2` → CSS `--song-color-2` on `:root`
3. `--song-color-2` → shader `uColor2` uniform (300ms lerp)
4. `song.waveform_peaks` → `Float32Array` fed to `<WaveformBar>`

**Consumers:**
- Shader `uColor2` ← `--song-color-2` (per-song fringe)
- Shader `uColor1` ← fixed brand teal — never overridden by album art
- Waveform fill ← `--song-color`
- Album art halo ← `--song-color` at 30% alpha
- PlayerBar tint ← `--song-color` at 5% alpha

**Empty/no-song state:** `--song-color` defaults to `oklch(0.55 0.15 185)` (aurora teal); shader runs brand palette only.

### 4. Play Button — Liquid Glass with Aurora Star

Not frosted glass. Liquid glass: fluid, refractive, alive.

**Visual layers (bottom → top):**
- Base: `backdrop-filter: blur(12px) saturate(1.4)` — pulls the aurora behind it
- Refraction tint: `background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)` — slightly brighter at center
- Border: `border: 1px solid rgba(255,255,255,0.18)` with subtle inner highlight at top edge
- Star: absolute center element — sharp radial point light, `oklch(0.97 0.02 185)` (near-white with aurora tint). Tiny bright core (4px), wide soft bloom (radial-gradient 40px). Sits behind play icon, visible through glass.
- Play icon: SVG, `color: rgba(255,255,255,0.92)`, centered

**Interaction — playback state (not pointer theatrics):**
- **Play:** star bloom expands from 6px core → 24px, opacity 0.5 → 1.0, 300ms ease-out. Button ring brightens.
- **Pause:** star contracts back to 6px, 200ms ease-out. Ring dims.
- **Buffering / AnalyserNode loading:** star pulses at 1.5s cycle, 30% → 80% opacity — the only continuous animation on this element.
- **Press feedback:** `scale(0.94)` on `pointerdown`, 80ms ease-out. Releases on `pointerup`.
- **Disabled / no song:** star at 15% opacity, button at 40% opacity. No hover response.

**Why not mouse waver or hold glow:** hover rotation on a control used hundreds of times/day reads as "demo," not premium software. Hold glow adds mystery with no utility — users don't hold play to learn song length. State-driven behavior is always more earned than pointer theatrics.

**Specular edges (make it glass, not just blur):**
- Top edge: `box-shadow: inset 0 1px 0 rgba(255,255,255,0.22)` — catches light from above
- Bottom edge: `box-shadow: inset 0 -1px 0 rgba(0,0,0,0.3)`
- Both combined with `backdrop-filter: blur(12px) saturate(1.4)`
- Pressed: specular reverses — top dims, bottom brightens (`inset 0 1px 0 rgba(0,0,0,0.2)`)

**Implementation:** Pure CSS + playback state from `playerStore.isPlaying` + `playerStore.isBuffering`. No canvas. ~70 lines.

### 5. Color Bleed — Ambient Wash

Not a subtle halo behind the art. A big, distant light source that floods the entire player region.

**PlayerBar bleed:**
- Light source: `position: absolute` pseudo-element, `width: 400px, height: 400px`, center-left of bar
- `background: radial-gradient(circle, color-mix(in oklch, var(--song-color) 35%, transparent) 0%, transparent 70%)`
- `filter: blur(60px)` — soft, large, far-away feel
- Sits behind all PlayerBar chrome, `z-index: -1`
- Effect: entire left half of player bar is faintly washed in album color, not just behind the art

**Library view — current playing song bleed:**
- Playing song row gets a `::before` pseudo — same radial-gradient wash but narrower, behind the row
- `background: radial-gradient(...) 20%, transparent 80%)` at `opacity: 0.6`
- Transitions in over 400ms ease-out when song changes

**Art halo (keep, adjust):**
- `box-shadow: 0 0 60px 12px color-mix(in oklch, var(--song-color) 40%, transparent)` — larger than before
- 2px apparent lift via `box-shadow` layering (no `transform: translateZ`)

### 6. Album Art

- Halo: see Color Bleed section above
- Border-radius: keep current value

---

## Kill List

| Current (broken) | Fix |
|---|---|
| `aurora-gradient-text` class on wordmark (`background-clip: text` + gradient) | SVG wordmark, plain fill |
| `w-[3px]` left-bar active indicator span | `bg-white/[0.05]` full-width background tint |
| `transition: height 300ms` on PlayerBar | `grid-template-rows: 0fr → 1fr` |
| Equalizer + "Playing" label simultaneously | Equalizer icon only |
| Static PNG background at opacity | GLSL aurora canvas |
| Inline `onMouseEnter/Leave` on FooterAction | `group-hover:` Tailwind |
| `ui-monospace` system font for mono | JetBrains Mono via `@fontsource-variable/jetbrains-mono` |

---

## Typography

| Role | Font | Usage |
|---|---|---|
| Display | Fraunces (variable, italic axis) | App name (wordmark), section hero heads — max 2–3 instances per view |
| Body | Geist (variable) | Everything else — nav items, song titles, labels, descriptions, UI text |
| Accent / mono | JetBrains Mono (variable) | Timestamps, file format badge, query syntax, tag chips, duration |

All three via `@fontsource-variable`. No purchases. No self-hosting.

**Fraunces constraint:** if it appears more than 3 times in any single view, it's being misused. It's a display accent, not a body substitute. Three typefaces in a dense product UI risk costume design — Fraunces earns its place by being rare.

---

## Motion Rules

- All UI transitions: `< 300ms`, `ease-out` (cubic-bezier(0.16, 1, 0.3, 1))
- Exits: 200ms. Enters: 300ms max
- Animate ONLY `transform` + `opacity` for UI state changes
- **Acknowledged exceptions:** `grid-template-rows: 0fr → 1fr` for PlayerBar height (layout-safe alternative to `height`), SVG waveform fill split (geometry update, not a CSS layout property)
- Playback controls: sub-100ms (keyboard-triggered → never animate)
- List stagger: 20–30ms per item
- Aurora shader + waveform: `requestAnimationFrame` loops — decorative ambient layer, not UI animation
- Per-song color crossfade: 300ms lerp on shader uniforms + CSS transition on `--song-color`
- `prefers-reduced-motion`: kill shader animation, freeze waveform, disable color lerp, set Lenis (if added later) to `lerp: 1`

---

## Component Changes

### AppShell

Layering (bottom → top):
1. GLSL aurora canvas — `position: fixed`, full viewport, `z-index: 0`, `pointer-events: none`
2. Grain texture overlay — keep existing SVG noise, tune opacity to 5%
3. UI chrome — sidebar, content, player bar

### Sidebar

**Wordmark — "Aurora":**
User dislikes current rendering (gradient text on Fraunces italic). Problem is presence, not just the gradient.

Treatment: SVG wordmark, letterforms traced to paths (not a live font render).
- Letters: filled `oklch(0.92 0.01 185)` — near-white, slightly cool
- Star at apex of "A": tiny radial glow point — `oklch(0.78 0.18 185)` teal, 6px hard core, 20px soft bloom via SVG `<radialGradient>`. Same visual language as the play button star, miniaturized.
- No gradient on the letterforms (banned). The light comes FROM the star, not painted on the letters.
- The star is the one deliberate decision that makes this wordmark cost something to design.

- Active nav: `bg-white/[0.05]` full-width tint, zero left-stripe
- Nav hover: `group-hover:bg-white/[0.03]` transition 200ms ease-out
- Footer actions: `group-hover:` Tailwind, remove inline `onMouseEnter/Leave`

### PlayerBar

- Height expand: `grid-template-rows` transition (was `height`) — **add `align-items: start` to grid container** (Gemini gotcha: without it, `0fr → 1fr` jumps)
- Progress bar: `<WaveformBar>` SVG component
- Playing indicator: equalizer icon only (remove "Playing" text label)
- Background: large ambient bleed pseudo-element (see Color Bleed section), not just a 5% tint

---

## Accessibility

- WCAG AA minimum: all text on dark surfaces ≥ 4.5:1
- Per-song color adjusted via OKLCH to stay within contrast-safe lightness range
- `prefers-reduced-motion`: full query respected — static aurora, frozen waveform
- All player controls: keyboard-navigable
- Waveform SVG: hidden `<input type="range">` overlaid, `aria-label="Seek"`, `aria-valuetext` with current time

---

## Implementation Order

**Phase 1 — Backend (prerequisite)**
1. Scanner: `waveform_peaks` + `dominant_color` + `dominant_color_2` columns (~1.5 hrs)
2. API: expose new fields on song response (~20 min)

**Phase 2 — Kill list + fonts (no dependencies)**
3. Kill list fixes — gradient text, side-stripe, height transition, redundant label, FooterAction hover (~45 min)
4. JetBrains Mono + mono accent role across app (~20 min)
5. SVG wordmark (~30 min)

**Phase 3 — Color pipeline (shader depends on this)**
6. `--song-color` / `--song-color-2` wiring from API response; `useAuroraColor` hook (~30 min)

**Phase 4 — Shader (now has colors)**
7. GLSL aurora canvas — WebGL init, time loop, `uColor1` (fixed teal), `uColor2` (album), `uAmplitude`, `uIntensity` (~2.5 hrs)
8. Audio analyser hook — transient-sensitive amplitude → `uAmplitude` (~30 min)
9. View-change intensity — `uIntensity` driven by `songStore.view` (~30 min)

**Phase 5 — Waveform**
10. `<WaveformBar>` SVG — path from `waveform_peaks`, playhead, fill split, seek interaction (~1.5 hrs)
11. Wire into PlayerBar, hide range visual, keep for a11y (~30 min)

**Phase 6 — Polish**
12. Reduced-motion handling, loading skeletons, error fallbacks (~45 min)
13. Contrast / a11y pass (~30 min)

**Total estimate: ~2.5 sessions (~12 hrs)**

---

## Performance Budget

- **Shader:** target 60fps. Frame budget: ≤ 4ms per draw call. If `performance.now()` shows consistent overrun → reduce Perlin octaves. WebGL compile failure → CSS static gradient fallback, no crash.
- **Memory:** cancel `requestAnimationFrame` loop on component unmount. Null WebGL context on song change, don't accumulate. Test with 10,000 song library.
- **Low-power mode:** expose `prefersReducedMotion` + add `reducedShaderQuality` flag (halve shader resolution via canvas `width/height` scaling) for battery-constrained devices.
- **Waveform peaks:** backend-computed eliminates frontend decode. Skeleton shown while API response pending. No decode freeze risk.

## Database Migration

New columns on `songs` table — required before Phase 1 frontend work:
```sql
ALTER TABLE songs ADD COLUMN waveform_peaks TEXT;        -- JSON array, 1000 floats
ALTER TABLE songs ADD COLUMN dominant_color TEXT;        -- OKLCH string e.g. "oklch(0.55 0.18 185)"
ALTER TABLE songs ADD COLUMN dominant_color_2 TEXT;      -- second cluster
```
All nullable. Existing songs get NULL until re-scanned. Frontend handles NULL gracefully:
- `waveform_peaks = null` → `<WaveformBarSkeleton>` until available
- `dominant_color = null` → default `oklch(0.55 0.15 185)` (brand teal)

**Backfill:** scanner re-scan triggers on next library refresh. No forced migration — organic fill as user plays or manually rescans.

## Howler.js → AnalyserNode

**This is non-trivial with the existing audio hook.** Howler.js abstracts the Web Audio API. Accessing the raw `AnalyserNode` requires:
```js
// After Howl is created and playing:
const ctx = Howler.ctx;                          // shared AudioContext
const analyser = ctx.createAnalyser();
Howler.masterGain.connect(analyser);             // tap off the master gain
analyser.fftSize = 256;
```
This must be initialized in the song-change effect in `useAudioPlayer.ts`, AFTER the Howl is created. Connecting to `masterGain` means the analyser sees the mixed output (correct for amplitude). Must disconnect on unmount to avoid graph leaks.

**Risk:** `Howler.ctx` may be undefined until first user interaction (browser autoplay policy). Handle with a lazy-init check.

## Implementation Gotchas (Gemini research)

1. **`grid-template-rows: 0fr → 1fr` needs `align-items: start`** on the grid container. Default `align-items: none` causes jumpy transitions because fr units can't size children. Already noted in PlayerBar section — do not skip this.

2. **`decodeAudioData` is blocking with no progress callback and no cancel.** Large FLACs (40MB+) will silently consume CPU. Always show a waveform loading skeleton (`<WaveformBarSkeleton>` — animated flat line) while decode runs. Backend-computed peaks (Phase 1) eliminates this entirely; skeleton is still needed while backend processes newly-scanned files.

3. **Lenis + GSAP lag** (N/A for now — we're not using either). Noted for future reference: if GSAP ScrollTrigger is ever added, must pass `autoRaf: false` to Lenis and bind `.raf()` to `gsap.ticker`.

---

## Filter / Query Bar Chrome

The boolean filter input is Aurora's primary differentiator. It needs a stable, opaque backdrop — not transparent chrome over a moving shader.

- Wrapping container: `background: oklch(0.06 0.005 240 / 0.95)` + `backdrop-filter: blur(8px)` — opaque dark island
- Border: `border: 1px solid rgba(255,255,255,0.08)`
- JetBrains Mono for query text (this IS technical syntax)
- Active/focused: border brightens to `rgba(255,255,255,0.15)`, subtle `box-shadow: 0 0 0 2px color-mix(in oklch, var(--song-color) 25%, transparent)`
- Tag chips: JetBrains Mono, `bg-white/[0.06]`, `border border-white/[0.08]`, `px-2 py-0.5 rounded-sm`
- This component must NEVER be transparent against the aurora

---

## Packages Required

Frontend:
```
npm install @fontsource-variable/fraunces @fontsource-variable/geist @fontsource-variable/jetbrains-mono culori
```

Backend (scanner additions):
```
pip install scikit-learn pillow miniaudio
```
(miniaudio for peak decode; Pillow already likely installed; scikit-learn for K-means)

(color-thief-browser for initial extraction, culori for OKLCH manipulation)

---

## Out of Scope

- Audio-reactive waveform (real-time FFT on progress bar) — pre-computed chosen for perf
- Three.js / R3F — overkill, not needed
- Light mode — dark only per spec
- Mobile-specific animations — responsive layout only, same visual system
