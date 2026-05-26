I'll do deep research on each area and then deliver a comprehensive technical audit with concrete upgrades.
I spent time researching current best practices across React 19 concurrency, WebGL context lifecycle, GLSL volumetric rendering, and SVG performance characteristics. Here's the extensive audit.

---

# Technical Audit: Aurora Visual Overhaul

## 1. React Architecture — Critical Bugs & Patterns

### 1.1 Stale Closures in `useSongTransition` (Severity: High)

The plan's `useSongTransition` hook accepts `onSwapPeaks` as a prop and puts it in a `useEffect` dependency array:

```ts
useEffect(() => {
  // ...
  onSwapPeaks()
}, [currentSongId, onSwapPeaks])
```

**Problem:** If the parent creates `onSwapPeaks` inline (e.g., `() => setPeaks(song.peaks)`), this effect re-runs on **every render**, not just song changes. The 400ms choreography becomes a stuttering mess because `startRef` resets constantly. This is the classic stale closure trap that `useCallback` was designed to solve, but the plan doesn't memoize the callback at the call site. 

**Fix:** Use React 19's `useEffectEvent` (stable in 19.2+) to separate the reactive dependency (`currentSongId`) from the non-reactive callback logic:

```ts
import { useEffect, useEffectEvent } from 'react'

export function useSongTransition(onSwapPeaks: () => void) {
  const currentSongId = usePlayerStore(s => s.currentSong?.id)
  const prevIdRef = useRef<number | undefined>(undefined)
  const rafRef = useRef<number | null>(null)

  // EffectEvent: always calls the latest onSwapPeaks without triggering re-runs
  const swapEvent = useEffectEvent(onSwapPeaks)

  useEffect(() => {
    if (currentSongId === prevIdRef.current) return
    prevIdRef.current = currentSongId

    const start = performance.now()
    let swapped = false

    const tick = (now: number) => {
      const elapsed = now - start
      if (!swapped && elapsed >= 200) {
        swapped = true
        swapEvent() // Always fresh, no stale closure
      }
      if (elapsed < 400) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [currentSongId]) // ✅ Only depends on song ID
}
```

This eliminates the need for the parent to wrap `onSwapPeaks` in `useCallback` entirely. 

### 1.2 WebGL Context Leak in `AuroraCanvas` (Severity: High)

The plan's `AuroraCanvas` initializes WebGL in a `useEffect` but **never handles context loss**. In a music app where users switch tabs, minimize the window, or where the OS reclaims GPU memory, the canvas will go black and never recover. The Khronos WebGL wiki explicitly states you must call `event.preventDefault()` on `webglcontextlost` and re-initialize all resources on `webglcontextrestored`. 

Additionally, the plan doesn't eagerly delete shaders/programs on unmount. MDN best practices recommend deleting objects eagerly rather than waiting for GC. 

**Fix:** Add a context lifecycle manager:

```ts
function useWebGLCanvas(canvasRef: RefObject<<HTMLCanvasElement | null>) {
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const rafRef = useRef<number | null>(null)

  const init = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false })
    if (!gl) return null

    // ... compile shaders, create program ...
    glRef.current = gl
    programRef.current = program
    return gl
  }, [canvasRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleLost = (e: Event) => {
      e.preventDefault()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }

    const handleRestored = () => {
      init() // Recompile everything from scratch
      // Restart draw loop via parent callback
    }

    canvas.addEventListener('webglcontextlost', handleLost)
    canvas.addEventListener('webglcontextrestored', handleRestored)

    const gl = init()
    if (!gl) {
      // Fallback handled by parent
      return
    }

    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost)
      canvas.removeEventListener('webglcontextrestored', handleRestored)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (glRef.current && programRef.current) {
        glRef.current.deleteProgram(programRef.current)
        // Delete shaders, buffers here too
      }
    }
  }, [canvasRef, init])

  return { glRef, rafRef }
}
```

### 1.3 Unnecessary Re-renders from `useAuroraColor`

The plan's `useAuroraColor` reads `currentSong` from Zustand and mutates `document.documentElement.style` inside `useEffect`:

```ts
useEffect(() => {
  document.documentElement.style.setProperty('--song-color', color)
}, [currentSong?.id])
```

**Problem:** This hook returns an object `{ color2LinearRgb, color1LinearRgb }` where `color2LinearRgb` is a ref (`.current`), not state. But the hook itself re-runs when `currentSong` changes, causing `App.tsx` to re-render. If `App.tsx` is high in the tree, this cascades.

**Fix:** Split concerns. CSS variables are side effects — they don't need to trigger React renders. Use a dedicated store subscriber that runs *outside* React's render cycle:

```ts
// In playerStore.ts or a separate auroraStore.ts
subscribeWithSelector((state) => state.currentSong?.dominant_color, (color) => {
  document.documentElement.style.setProperty('--song-color', color ?? DEFAULT_COLOR)
})
```

Or if staying in React, make `useAuroraColor` return nothing and wrap it in a component that doesn't render children:

```tsx
function AuroraColorBridge() {
  useAuroraColor() // Side effects only
  return null
}
```

Then `<AuroraColorBridge />` in App.tsx. It re-renders itself but doesn't cascade.

### 1.4 `useAudioAnalyser` — Howler Integration Fragility

The plan reaches into `(window as any).Howler` to tap `masterGain`. This breaks if:
- Howler is loaded asynchronously
- The build system tree-shakes Howler differently
- `Howler.ctx` is undefined until first user gesture (browser autoplay policy)

**Fix:** Use a ref-based subscription pattern that waits for Howler to exist:

```ts
const howlerRef = useRef<any>(null)

useEffect(() => {
  // Poll for Howler availability (it attaches to window on load)
  const check = () => {
    const H = (window as any).Howler
    if (H?.ctx) {
      howlerRef.current = H
      setupAnalyser(H)
    } else {
      setTimeout(check, 100)
    }
  }
  check()
}, [])
```

Better yet, expose the AudioContext from your player store instead of relying on global window pollution.

---

## 2. GLSL Shader — From Screensaver to Sky

### 2.1 Why the Current Shader Will Look Generic

The plan's fragment shader uses 5 layered `sin()` waves with hash noise:

```glsl
float curtain(...) {
  float wave = sin(x * freq + t * speed + phase) * 0.12;
  wave += sin(x * freq * 1.73 + ...) * 0.06;
  wave += noise(...) * 0.08;
  // smoothstep for core + glow
}
```

This produces **2D sinusoidal ribbons** that scroll horizontally. Real aurora borealis has these characteristics that the plan completely misses:

| Real Aurora Property | Plan's Shader | Missing |
|---|---|---|
| **Vertical curtain structure** | Horizontal sine waves | No vertical ionization bands |
| **Volumetric depth** | 2D screen-space | No ray marching, no depth |
| **Atmospheric perspective** | Flat alpha blend | No altitude-based color shift |
| **Solar wind turbulence** | Simple hash noise | No fBm (fractal Brownian motion) |
| **Color separation by altitude** | Single color mix | No green lower / red upper curtains |
| **Star field occlusion** | Fixed z-index 0 | Aurora should dim stars behind it |

Research on realistic aurora rendering shows the state-of-the-art approach is **volumetric ray marching** through an ionization density field, using Beer's Law for light absorption and Henyey-Greenstein phase functions for anisotropic scattering of charged particles. 

### 2.2 Upgraded Shader Architecture

You don't need full physically-based rendering, but you need **3D-positioned curtains** with vertical structure. Here's the upgrade:

**Vertex Shader:** Pass world-space ray direction and origin (fullscreen quad trick).

**Fragment Shader — Key Improvements:**

1. **fBm noise instead of single hash:** 4 octaves of Perlin/simplex noise with lacunarity 2.0 and persistence 0.5. This creates the "folded fabric" look of real curtains.

2. **Vertical curtain function:** The density field should be a function of `(x, y, z)` where `y` is altitude:
   ```glsl
   float auroraDensity(vec3 p) {
     // Base curtain shape: vertical sheets with horizontal drift
     float curtain = sin(p.x * 0.5 + fbm(p * 0.3 + vec3(0, time * 0.1, 0))) * 0.5 + 0.5;
     // Altitude falloff: aurora happens at 100-300km, fade at edges
     float altitudeMask = smoothstep(0.2, 0.5, p.y) * smoothstep(0.9, 0.6, p.y);
     return curtain * altitudeMask * noise(p * 2.0);
   }
   ```

3. **Ray marching (lightweight):** 16-24 steps is enough for a background effect. Accumulate density with Beer-Lambert law:
   ```glsl
   float transmittance = exp(-density * stepSize * absorption);
   lightAccum += transmittance * density * stepSize;
   ```

4. **Color by altitude:** Real aurora is green (oxygen at ~100-150km) and red (oxygen at ~200km+). Map `y` to hue:
   ```glsl
   vec3 auroraColor = mix(vec3(0.0, 0.8, 0.3), vec3(0.9, 0.2, 0.3), smoothstep(0.5, 0.8, p.y));
   ```

5. **Moon/star bloom occlusion:** The aurora should be additive (`gl.blendFunc(gl.SRC_ALPHA, gl.ONE)`) so it blooms over a dark star field, not alpha-blended like a PNG.

**Performance budget:** 16 steps × 5 octaves of noise = 80 noise calls per pixel. At 1080p that's ~166k noise calls per frame. A simplex noise function is ~10 GPU ops, so ~1.6M ops — trivial for modern GPUs. If targeting mobile, drop to 12 steps and 3 octaves.

### 2.3 Shader Uniforms — Color Interpolation in Linear RGB

The plan passes OKLCH colors converted to linear RGB via `culori`. This is correct for physically-based blending. However, the plan's lerp in the shader:

```glsl
vec3 color = mix(uColor1, uColor2, clamp(colorT, 0.0, 1.0));
```

Interpolates in linear RGB space. This is fine for light emission (additive), but if the colors have very different hues, the midpoint can go muddy gray. For more vibrant transitions, interpolate in OKLab space in the shader:

```glsl
// OKLab mixing in GLSL (simplified)
vec3 linearToOklab(vec3 c) { /* ... */ }
vec3 oklabToLinear(vec3 c) { /* ... */ }

vec3 c1 = linearToOklab(uColor1);
vec3 c2 = linearToOklab(uColor2);
vec3 mixed = oklabToLinear(mix(c1, c2, colorT));
```

This preserves perceptual hue during transitions and avoids the "dead zone" gray that RGB mixing creates between complementary colors. 

---

## 3. WaveformBar SVG — The RAF + clip-path Problem

### 3.1 Why clip-path + RAF Will Flicker

The plan's `WaveformBar` uses this pattern:

```tsx
// Inside RAF loop:
const clipEl = document.getElementById(clipPathId.current + '-rect')
if (clipEl) clipEl.setAttribute('width', String(progressRef.current * svgW))
```

**Three problems:**

1. **DOM query every frame:** `document.getElementById` inside RAF is O(DOM size) every 16ms. On a heavy page, this causes frame drops.
2. **Layout thrashing:** `setAttribute('width', ...)` on an SVG rect inside a `<clipPath>` forces the browser to recalculate the clip path geometry, then repaint the entire clipped region. This is not GPU-accelerated in most browsers. 
3. **Hydration mismatch:** `clipPathId.current = `waveform-clip-${Math.random()...}` runs during render. In SSR/React 19 streaming, this ID won't match between server and client, causing a hydration error.

### 3.2 The Correct SVG Approach: `stroke-dasharray`

For a playhead-revealed waveform, the professional approach is **stroke-dasharray manipulation**, which is pure SVG geometry and GPU-composited:

```tsx
export function WaveformBar({ peaks, duration, onSeek }: WaveformBarProps) {
  const pathRef = useRef<<SVGPathElement>(null)
  const [pathLength, setPathLength] = useState(0)

  // Measure path once
  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength())
  }, [peaks])

  const progress = usePlayerStore(s => s.progress) // 0-1 normalized

  return (
    <svg onClick={handleSeek} className="w-full h-8 cursor-pointer">
      <path
        ref={pathRef}
        d={buildPath(peaks)}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <path
        d={buildPath(peaks)}
        fill="none"
        stroke="var(--song-color)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={`${progress * pathLength} ${pathLength}`}
        strokeDashoffset={0}
        style={{
          filter: 'drop-shadow(0 0 4px var(--song-color))',
          transition: 'stroke-dasharray 100ms linear' // Smooths micro-stutters
        }}
      />
    </svg>
  )
}
```

**Why this is better:**
- **Zero RAF needed.** The progress comes from your existing player store (which already has a RAF loop for the time display). No duplicate animation loops.
- **No DOM queries.** `stroke-dasharray` is an SVG presentation attribute, updated via React props. The browser composites it on the GPU.
- **No clip-path recalculation.** The browser treats this as a simple path mask.
- **SSR-safe.** No random IDs, no `document.getElementById`.

### 3.3 Resampling During Render is a Side Effect

The plan reads `svgRef.current?.clientWidth` during render to compute the path:

```ts
const svgW = svgRef.current?.clientWidth ?? 600
const path = buildPath(resampled, svgW, svgH)
```

**This is a React anti-pattern.** Reading refs during render is a side effect. In React 19 concurrent rendering, the ref may not be populated yet, or the width may be stale from a previous render. 

**Fix:** Use a `ResizeObserver` to drive path regeneration, or use SVG `viewBox` so the path is resolution-independent:

```tsx
<<svg viewBox={`0 0 ${BAR_COUNT} 32`} preserveAspectRatio="none">
  {/* path uses BAR_COUNT as width units, not pixels */}
</svg>
```

With `viewBox`, the path is defined in abstract units (0-200 width, 0-32 height) and scales automatically. No width-dependent path rebuilding needed.

### 3.4 Click-to-Seek Precision

The plan's `handleClick` uses `e.clientX - rect.left`. This doesn't account for the SVG's `viewBox` scaling. If the SVG is responsive and wider than its pixel width, the seek will be wrong.

**Fix:** Use `getBoundingClientRect` + `viewBox` ratio:

```ts
const handleClick = (e: React.MouseEvent<<SVGSVGElement>) => {
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  onSeek(ratio * duration)
}
```

---

## 4. Phase Ordering — Execution Pain Points

### 4.1 Missed Parallelization

The plan sequences:
- Phase 0: Tokens (30 min)
- Phase 1: Backend contract (blocks 3-5)
- Phase 2: Kill list + fonts (no backend dependency)
- Phase 3: Color pipeline
- Phase 4: GLSL shader
- Phase 5: Waveform bar
- Phase 6: Polish

**Problem:** Phase 2 explicitly has "no backend dependency" but is sequenced after Phase 1. In a real implementation, Phase 0 and Phase 2 can run **in parallel** with Phase 1. The backend team works on DB migrations/scanner while the frontend team handles kill list cleanup, font installation, and token application. This saves hours.

**Revised order:**
```
Phase 0 (Tokens) ──┐
Phase 1 (Backend) ─┼──► Phase 3 (Color) ─► Phase 4 (GLSL) ─► Phase 5 (Waveform)
Phase 2 (Kill) ────┘
```

### 4.2 Commit Granularity is Too Fine

The plan commits after **every single task** (30+ commits for a visual overhaul). This creates:
- Noise in `git log`
- Slower CI if commits trigger builds
- Harder rollback (have to bisect through 30 commits to find a bug)

**Fix:** Batch commits by phase or logical unit:
- Commit 1: `feat(db): add visual pipeline columns + model updates`
- Commit 2: `feat(scanner): wire peak extraction + color extraction + tests`
- Commit 3: `feat(api): expose visual fields across all routers`
- Commit 4: `feat(frontend): design tokens + kill list cleanup + typography`
- Commit 5: `feat(frontend): aurora shader + color pipeline + audio reactivity`
- Commit 6: `feat(frontend): waveform visualization + player integration`

### 4.3 Migration Safety

The plan's DB migration uses `try/except` with `pass` for each ALTER TABLE. This is correct for SQLite, but the plan doesn't specify **when** migrations run. If the backend deploys before the frontend, the API returns `null` for new fields — fine. But if the frontend deploys first with the new TypeScript interfaces, it will send `undefined` for `waveform_peaks` which the Pydantic model rejects if typed as `Optional[list[float]]` but the frontend sends the key with `undefined` value.

**Fix:** Ensure the migration runs at application startup *before* any request handling, and make the Pydantic model accept missing keys (which `Optional` does, but verify FastAPI's `exclude_unset` behavior on PATCH endpoints).

---

## 5. Comprehensive Upgrades (Anti-Slop)

### 5.1 Backend: Python Color Science

The plan implements manual sRGB→OKLCH conversion in `color_utils.py`. This is ~80 lines of matrix math that could drift from the frontend's `culori` implementation.

**Upgrade:** Use the `colour-science` Python package (or `skimage.color` which you already have via scikit-learn dependency):

```python
from skimage.color import rgb2lab, lab2lch
import numpy as np

def rgb_to_oklch(r: int, g: int, b: int) -> tuple[float, float, float]:
    # skimage uses CIELAB; for OKLab use colour-science package
    # But skimage has rgb2lab which is close enough for dominant colors
    lab = rgb2lab(np.array([[r, g, b]]).reshape(1, 1, 3) / 255.0)
    L, a, b_val = lab[0, 0]
    C = np.sqrt(a**2 + b_val**2)
    H = np.degrees(np.arctan2(b_val, a)) % 360
    return float(L / 100), float(C / 150), float(H)  # Normalize to OKLCH-ish ranges
```

Better yet, pin `oklab-py` or `colour` and use actual OKLab math. Consistency between frontend `culori` and backend Python is more important than zero dependencies.

### 5.2 Backend: Peak Extraction Memory

The plan's `extract_peaks` decodes the entire file to a Python `array.array` of 16-bit integers:

```python
decoded = miniaudio.decode_file(file_path, ...)
samples = decoded.samples  # Entire file in memory
```

For a 10-minute 48kHz FLAC, this is ~57MB of raw PCM. Acceptable for a scanner, but if scanning a 10,000-song library, peak memory usage matters.

**Upgrade:** Stream-decode in chunks. `miniaudio` supports streaming:

```python
def extract_peaks(file_path: str, num_bins: int = 1000) -> list[float] | None:
    try:
        stream = miniaudio.stream_file(file_path, output_format=..., nchannels=1, sample_rate=22050)
        total_samples = 0
        # First pass: count samples (or use miniaudio metadata if available)
        # Second pass: accumulate peaks per bin
        # ...or use a two-pass approach with memory-mapped chunking
    except Exception:
        return None
```

For the first implementation, the all-in-memory approach is fine. But document the memory bound.

### 5.3 Frontend: `AuroraWordmark` Font Metrics

The plan positions a star glow at `(11, 2)` based on a guess about the Fraunces "A" apex. If the font loads late (network delay) or the user's system substitutes a different font, the star floats in the wrong place.

**Upgrade:** Use an SVG `<path>` for the wordmark instead of `<text>`. Convert "Aurora" to a path (using Figma or Inkscape) so the star position is baked into the geometry. This eliminates the font-loading race condition and the `letterSpacing` guesswork.

If you must keep `<text>`, use `getBoundingClientRect` in a `useLayoutEffect` to position the star dynamically after font load:

```tsx
useLayoutEffect(() => {
  const textEl = textRef.current
  if (!textEl) return
  const bbox = textEl.getBBox()
  // Find the "A" character position via getCharNumAtPosition or substring metrics
  // Position star at computed apex
}, [])
```

### 5.4 Frontend: Focus Ring on `position: fixed` AuroraCanvas

The plan puts `AuroraCanvas` at `z-index: 0` with `pointer-events: none`. This is correct, but if any parent has `transform`, `filter`, or `will-change`, it creates a new stacking context and the canvas may render above interactive elements despite `z-index: 0`.

**Upgrade:** Add `isolation: isolate` to the root layout container to prevent unintended stacking context escapes:

```css
#root {
  isolation: isolate;
  position: relative;
  z-index: 1;
}
```

### 5.5 Frontend: `useAuroraIntensity` Idle Timer

The plan's idle timer resets on `pointermove` and `keydown`. This fires **every mouse pixel movement**, causing React state updates (`setIsIdle(false)`) on every mouse move. If the user is actively using the app, this is hundreds of state updates per minute.

**Upgrade:** Throttle the reset. Use a ref for the idle state, not React state, since the intensity change only needs to trigger a shader uniform update (which can happen via ref):

```ts
const isIdleRef = useRef(false)
const idleTimerRef = useRef<<ReturnType<<typeof setTimeout>>()

const resetIdle = useCallback(() => {
  if (isIdleRef.current) {
    isIdleRef.current = false
    // Trigger intensity update via ref, not setState
    intensityRef.current = computeIntensity()
  }
  clearTimeout(idleTimerRef.current)
  idleTimerRef.current = setTimeout(() => {
    isIdleRef.current = true
    intensityRef.current = IDLE_INTENSITY
  }, IDLE_TIMEOUT_MS)
}, [])

useEffect(() => {
  window.addEventListener('pointermove', resetIdle)
  return () => window.removeEventListener('pointermove', resetIdle)
}, [resetIdle])
```

This uses `useCallback` with empty deps (stable reference) and refs for mutable state, eliminating the render cascade. 

### 5.6 Frontend: Reduced Motion Respect

The plan adds `@media (prefers-reduced-motion: reduce)` to hide the canvas. This is good, but it should also disable the `useSongTransition` RAF loop and the `WaveformBarSkeleton` shimmer.

**Upgrade:** Create a global `useReducedMotion()` hook:

```ts
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mql.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return reduced
}
```

Use it in `AuroraCanvas` (static gradient fallback), `WaveformBarSkeleton` (no shimmer, solid color), and `useSongTransition` (instant swap, no 400ms choreography).

### 5.7 Frontend: Type Safety on `howlRef`

The plan types `howlRef` as `any` in multiple places. Your player store should export a typed interface:

```ts
interface HowlInstance {
  seek: (seconds?: number) => number
  playing: () => boolean
  // ... other methods you use
}
```

Then `usePlayerStore(s => s.howlRef as React.MutableRefObject<<HowlInstance | null>)`.

### 5.8 SVG Waveform: Accessibility

The plan hides the waveform with `aria-hidden` and keeps a hidden range input for screen readers. This is backwards. Screen reader users don't need a hidden range — they need the **seek control** to be the primary accessible element.

**Upgrade:** Make the SVG itself accessible:

```tsx
<<svg
  role="slider"
  aria-label="Seek"
  aria-valuemin={0}
  aria-valuemax={duration}
  aria-valuenow={progress * duration}
  tabIndex={0}
  onKeyDown={handleKeyDown} // Arrow keys for precision
  onClick={handleSeek}
>
```

Then the hidden `<input type="range">` can be removed entirely. The SVG is the visual *and* the control.

### 5.9 GLSL: Mobile Precision

The plan uses `precision mediump float`. On mobile GPUs, `mediump` has only ~10-11 bits of precision. The aurora shader's `uTime` accumulates indefinitely, and after ~10 minutes, `sin(uTime * 0.31)` will lose precision and the animation will stutter.

**Upgrade:** Use `highp float` for time and position calculations. Or better, pass `uTime` as a `mediump` value but wrap it modulo a large period in JavaScript before passing:

```ts
gl.uniform1f(uniforms.uTime, (now - startRef.current) / 1000 % 1000.0)
```

Also declare:
```glsl
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
```

### 5.10 The "Liquid Glass" Play Button

The plan notes this as missing (Task 2.11) but doesn't schedule it. The spec describes a radial-gradient background with backdrop blur. **Warning:** `backdrop-filter: blur()` on a `position: fixed` element (the PlayerBar) can force the browser to composite the entire page every frame, destroying performance.

**Upgrade:** Instead of true backdrop blur, use a **pre-blurred noise texture** or a CSS `box-shadow` with heavy spread to simulate the glass edge. If you must use `backdrop-filter`, apply it only to the play button's local stacking context and set `contain: paint` on the PlayerBar to limit the compositing region.

```css
.play-button-glass {
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), rgba(255,255,255,0.02));
  border: 1px solid rgba(255,255,255,0.2);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 24px rgba(0,0,0,0.4);
  contain: paint; /* Critical for performance */
}
```

---

## Summary: Priority Matrix

| Issue | Severity | Effort | Impact |
|---|---|---|---|
| `useSongTransition` stale closure | High | 30 min | Fixes broken transitions |
| WebGL context loss handling | High | 1 hr | Prevents black screen on tab switch |
| Shader: 2D→volumetric curtains | High | 4 hrs | Transforms screensaver into sky |
| Waveform: clip-path→dasharray | Medium | 1 hr | Eliminates frame drops |
| Waveform: random ID hydration | Medium | 15 min | Fixes SSR mismatch |
| `useAuroraIntensity` throttle | Medium | 30 min | Stops mousemove render flood |
| Backend: streaming peak decode | Low | 2 hrs | Scales to large libraries |
| Shader: OKLab mix in GLSL | Low | 1 hr | Vibrant color transitions |
| Phase parallelization | Low | 15 min | Faster team execution |

The plan is solid in structure but contains several "AI slop" patterns: naive RAF loops, DOM queries in animation frames, ignoring WebGL context lifecycle, and a shader that prioritizes code brevity over atmospheric realism. The upgrades above turn it from a "functional demo" into a production-grade atmospheric OS.