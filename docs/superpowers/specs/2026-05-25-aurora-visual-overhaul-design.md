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

### 4. Album Art

- `box-shadow: 0 0 40px 8px color-mix(in oklch, var(--song-color) 30%, transparent)` — soft radial halo
- 2px apparent lift via `box-shadow` layering (no `transform: translateZ`)
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
| Display | Fraunces (variable, italic axis) | App name, section headers, hero moments |
| Body | Geist (variable) | All UI text, labels, descriptions |
| Accent / mono | JetBrains Mono (variable) | Timestamps, file format badge, query syntax, tag labels |

All three via `@fontsource-variable`. No purchases. No self-hosting.

---

## Motion Rules

- All UI transitions: `< 300ms`, `ease-out` (cubic-bezier(0.16, 1, 0.3, 1))
- Exits: 200ms. Enters: 300ms max
- Animate ONLY `transform` + `opacity`. Never `width`/`height`/`margin`/`padding`
- Playback controls: sub-100ms (keyboard-triggered → never animate)
- List stagger: 20–30ms per item
- Aurora shader + waveform: `requestAnimationFrame` loops (decorative — not UI animation, Emil rules don't apply)
- Per-song color crossfade: 300ms lerp on shader uniforms + CSS transition on `--song-color`
- `prefers-reduced-motion`: kill shader animation, freeze waveform, disable color lerp

---

## Component Changes

### AppShell

Layering (bottom → top):
1. GLSL aurora canvas — `position: fixed`, full viewport, `z-index: 0`, `pointer-events: none`
2. Grain texture overlay — keep existing SVG noise, tune opacity to 5%
3. UI chrome — sidebar, content, player bar

### Sidebar

- Wordmark: `<svg>` element with Fraunces italic letterforms, plain fill `#e8e6e3`, no gradient
- Active nav: `bg-white/[0.05]` full-width tint, zero left-stripe
- Nav hover: `group-hover:bg-white/[0.03]` transition 200ms ease-out
- Footer actions: `group-hover:` Tailwind, remove inline `onMouseEnter/Leave`

### PlayerBar

- Height expand: `grid-template-rows` transition (was `height`)
- Progress bar: `<WaveformBar>` SVG component
- Playing indicator: equalizer icon only (remove "Playing" text label)
- Background: `background: color-mix(in oklch, var(--song-color) 5%, transparent)` tint

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
