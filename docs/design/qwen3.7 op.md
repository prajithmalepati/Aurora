**ENGINEERING BRIEF: AURORA VISUAL OVERHAUL**
**TARGET AGENT:** Claude Code / Opus 4.x
**OBJECTIVE:** Pre-execution risk mitigation, architectural hardening, and UX optimization.

This document is explicitly formatted as a set of **strict constraints and directives** for the executing AI agent. It addresses known failure modes in React 19, WebGL lifecycles, Web Audio API quirks, and Python C-extension instability that frequently derail complex visual/audio application builds.

---

### 🚨 CRITICAL DIRECTIVE 1: React 19 & State Architecture
*The original plan references `useEffectEvent`. This is a fatal trap.*

**1.1 The `useEffectEvent` Deprecation Trap**
*   **Pitfall:** `useEffectEvent` was an experimental React 18 API that was **removed/abandoned** before the React 19 stable release. Importing it will cause an immediate build crash.
*   **Directive:** You MUST use the `useRef` + `useCallback` pattern (often called `useLatest`) to maintain stable references to functions inside a `requestAnimationFrame` (RAF) loop without triggering re-renders or requiring dependency arrays.
*   **Implementation:**
    ```typescript
    // CORRECT REACT 19 PATTERN
    const swapPeaksRef = useRef(onSwapPeaks);
    useEffect(() => { swapPeaksRef.current = onSwapPeaks; }, [onSwapPeaks]);

    useEffect(() => {
      // RAF loop can safely call swapPeaksRef.current() without it being a dependency
      const tick = () => { swapPeaksRef.current(); rafRef.current = requestAnimationFrame(tick); }
      // ...
    }, []); // Empty deps!
    ```

**1.2 The "Re-Render Thrash" Prohibition**
*   **Pitfall:** Calling `setState` 60 times a second inside an audio analyzer or RAF loop will lock the main thread and cause UI jank.
*   **Directive:** **NEVER** use `useState` for high-frequency data (Audio Amplitude, Mouse Idle Timer, WebGL Uniforms).
*   **Fix:** Use a Zustand store with a `transient` state, or pass `React.MutableRefObject<number>` directly into the WebGL draw loop. The WebGL canvas should read `amplitudeRef.current` directly on every frame.

---

### 🎨 CRITICAL DIRECTIVE 2: WebGL & GLSL Survival
*WebGL is unforgiving. Silent failures are the default.*

**2.1 SVG `clipPath` ID Collisions**
*   **Pitfall:** In `WaveformBar.tsx`, the plan uses a randomized string for the `clipPath` ID (`wf-${Math.random()}`). If React re-renders, the ID changes, but the DOM attribute `clip-path="url(#...)"` might not update synchronously, causing the waveform to vanish.
*   **Directive:** You MUST use React 19's `useId()` hook to generate deterministic, SSR-safe, collision-proof IDs for SVG `<clipPath>` elements.
    ```typescript
    const clipId = useId();
    // <clipPath id={clipId}> ... <path clipPath={`url(#${clipId})`} />
    ```

**2.2 Mobile GPU Thermal Throttling & DPI**
*   **Pitfall:** Setting `canvas.width = offsetWidth * devicePixelRatio` on a 3x Retina iPad results in a render target of ~9 Megapixels. Running 4 fBm noise curtains at 60fps on this resolution will thermally throttle the device within 3 minutes, dropping frames to 15fps and killing the battery.
*   **Directive:** Hard-cap the canvas DPI multiplier at `1.5`.
    ```typescript
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ```

**2.3 WebGL Context Loss is Inevitable**
*   **Pitfall:** iOS Safari will aggressively kill WebGL contexts when the user scrolls, switches tabs, or if memory pressure is high. If you do not call `e.preventDefault()` on the `webglcontextlost` event, the browser will *never* fire the `webglcontextrestored` event.
*   **Directive:** The `preventDefault()` call is non-negotiable.

**2.4 Culori Out-of-Gamut Clamping**
*   **Pitfall:** OKLCH allows for highly saturated colors that do not exist in standard sRGB/Linear RGB displays. Culori's `toLrgb` will return values like `-0.12` or `1.45`. WebGL shaders will clamp these unpredictably, causing neon color-shifting.
*   **Directive:** You must manually clamp the RGB tuple to `0.0 - 1.0` *before* passing it to `gl.uniform3fv`.
    ```typescript
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const safeRgb: [number, number, number] = [clamp(lrgb.r), clamp(lrgb.g), clamp(lrgb.b)];
    ```

---

### 🎵 CRITICAL DIRECTIVE 3: Web Audio & Howler.js Routing
*Audio APIs are governed by strict browser security policies.*

**3.1 The Autoplay Suspension Trap**
*   **Pitfall:** Browsers suspend the `AudioContext` until the first user interaction. If `useAudioAnalyser` mounts and attempts to tap into `Howler.masterGain` while the context is `suspended`, the `AnalyserNode` will receive zero data forever.
*   **Directive:** You must listen for Howler's `play` event OR check `Howler.ctx.state`.
    ```typescript
    if (Howler.ctx.state === 'suspended') {
      await Howler.ctx.resume();
    }
    Howler.masterGain.connect(analyser);
    ```

**3.2 The "Double Tab-Stop" Accessibility Violation**
*   **Pitfall:** The plan specifies an `<svg role="slider" tabIndex={0}>` AND a hidden `<input type="range">`. Screen readers will announce the slider twice, and keyboard users will have to press `Tab` twice to get past the seek bar. Furthermore, manual JS click-to-seek logic fails on touch-drag events.
*   **Directive:** Use the **Invisible Native Overlay Pattern**. The SVG is purely visual (`pointer-events-none`, `aria-hidden`). The native `<input type="range">` sits absolutely positioned on top, spanning 100% width/height, with `opacity-0`. It handles ALL clicks, drags, touch events, and screen readers natively.

---

### 🐍 CRITICAL DIRECTIVE 4: Backend Scanner & C-Extensions
*Python audio/image processing is a minefield of segfaults.*

**4.1 `miniaudio` Segfault Risk**
*   **Pitfall:** `miniaudio` is a C-extension. If it encounters a malformed MP3/WAV header, it will not throw a Python Exception; it will **segfault and instantly kill the entire FastAPI server process**.
*   **Directive:** Peak extraction MUST be isolated. Either use `multiprocessing` to run the extraction in a child process (so a segfault only kills the child), OR validate the file headers using pure Python (`mutagen`) before passing the file path to `miniaudio`.

**4.2 `sklearn.cluster.KMeans` CPU Bottleneck**
*   **Pitfall:** Running KMeans on 4,096 pixels for 10,000 songs will cause the scanner to take hours and spike CPU to 100%.
*   **Directive:** Do NOT use `scikit-learn` for 2-color extraction. Use Pillow's native, highly-optimized C-based `quantize` method. It is 100x faster and mathematically sufficient for dominant color extraction.
    ```python
    # CORRECT FAST IMPLEMENTATION
    img = Image.open(BytesIO(art_data)).convert("RGB").resize((64, 64), Image.LANCZOS)
    quantized = img.quantize(colors=2, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette()
    # Extract first two RGB triplets from palette
    ```

**4.3 SQLite WAL & FastAPI Concurrency**
*   **Pitfall:** FastAPI is asynchronous. If multiple requests hit the SQLite database simultaneously, you will get `sqlite3.OperationalError: database is locked`.
*   **Directive:** Ensure `init_db` explicitly executes `PRAGMA journal_mode=WAL;` and `PRAGMA busy_timeout=5000;` on every connection.

---

### 💡 UX & INTUITION ENHANCEMENTS (Make it Better)

**1. The "Ghost Waveform" (Intuitive Pre-loading)**
*   **Current Plan:** Shows a shimmer skeleton while peaks are null.
*   **Improvement:** If the user has played the song before, but peaks haven't loaded yet, show a generic "flat" waveform that pulses to the beat using the real-time `AnalyserNode` until the pre-computed peaks arrive. This makes the UI feel instantly responsive.

**2. Aurora Shader Asymmetry (Organic Feel)**
*   **Current Plan:** Uses `sin(uv.x * freq + t * speed)`.
*   **Improvement:** Perfect sine waves look like a screensaver, not nature. In the GLSL `curtain` function, distort the UV coordinates with fBm noise *before* calculating the sine wave. This creates the "torn, wind-blown" look of real auroras.
    ```glsl
    // Add this before the sine calculation in curtain():
    uv.x += fbm(vec2(uv.x * 1.5, t * 0.1)) * 0.15;
    ```

**3. Tailwind v4 `@theme` Integration**
*   **Context:** Tailwind v4 moved away from `tailwind.config.js` to CSS-native configuration.
*   **Directive:** When creating `tokens.css`, wrap your custom variables in the `@theme` directive so Tailwind v4 automatically generates utility classes for them (e.g., `bg-surface-1`, `text-primary`).
    ```css
    @import 'tailwindcss';
    @theme {
      --color-surface-1: oklch(0.06 0.004 195 / 0.95);
      --color-aurora-teal: oklch(0.72 0.18 195);
      /* ... */
    }
    ```

**4. Liquid Glass "Refraction" Illusion**
*   **Current Plan:** Uses `backdrop-filter: blur(10px)`.
*   **Improvement:** True glass doesn't just blur; it refracts. Add a subtle `drop-shadow` that mimics the caustic light edge of glass, and use `mix-blend-mode: overlay` on a pseudo-element to give the play button a "wet" specular highlight.

---

### 📋 FINAL CHECKLIST FOR OPUS 4.7

Before writing the final code, Opus must verify:
1.  [ ] No `useState` inside `requestAnimationFrame` callbacks.
2.  [ ] No `import { useEffectEvent }` (Use `useRef` for stable callbacks).
3.  [ ] `useId()` is used for SVG `<clipPath>` IDs.
4.  [ ] Canvas DPI is capped at `1.5`.
5.  [ ] `e.preventDefault()` is called on `webglcontextlost`.
6.  [ ] RGB values passed to WebGL uniforms are clamped `[0, 1]`.
7.  [ ] `Howler.ctx.resume()` is called before connecting the Analyser.
8.  [ ] Native `<input type="range">` overlays the SVG for seek a11y.
9.  [ ] `sklearn` is replaced by `Pillow.quantize` for color extraction.
10. [ ] SQLite `PRAGMA journal_mode=WAL` is set on connection.

**Instruction to User:** Copy and paste this entire document into your system prompt or context window alongside the original implementation plan. Tell the agent: *"Review the 'Engineering Brief' document first. It contains critical overrides and corrections to the original plan. Execute the plan using the constraints defined in the Brief."*