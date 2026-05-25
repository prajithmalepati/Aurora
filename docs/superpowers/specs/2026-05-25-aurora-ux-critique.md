# Aurora Visual Overhaul — UX Critique

**Date**: 2026-05-25
**Reviewer**: Senior product designer / UX critic
**Spec under review**: `2026-05-25-aurora-visual-overhaul-design.md`

---

### Overall Rating: 6.5/10

A spec with one genuinely strong central idea (a per-song color pipeline driving a shader, the waveform, and album art halo as a unified system) wrapped in a pile of unexamined assumptions. The kill list is sharp and correct — it identifies real design sins and replaces them with conventional, correct solutions. But the ambitious parts (GLSL aurora, audio-reactive shader, pre-computed waveform) are described at the level of "we will write a shader" without acknowledging the actual design problems that emerge once a shader is moving behind dense UI. The spec confuses *technical implementation* with *design decisions*. It tells you which uniforms to push but not what the aurora should feel like when you're trying to read a track list at 2am. The result, if shipped as written, will look impressive in a screenshot and be exhausting after fifteen minutes of real use.

---

### What's Strong

- **Per-song color as a single source of truth.** `--song-color` driving shader uniforms, waveform fill, album halo, and PlayerBar tint is the right architectural decision. This is the one idea in the spec that genuinely earns the "Aurora OS" framing — the room responds to the record. Few apps do this coherently (Apple Music's now-playing screen, Plex's older now-playing modal). Doing it well is a real differentiator.
- **OKLCH color manipulation with chroma boost + lightness clamp.** Most album-art-color implementations look muddy because they take the raw dominant color. Forcing chroma ≥ 0.15 and clamping L to 0.4–0.7 is the correct fix and shows the author has actually shipped this before, or at least read someone who has.
- **Kill list is honest and surgical.** Every entry identifies a real anti-pattern (gradient text on the wordmark, side-stripe nav, animating `height`, inline JS hover handlers) and replaces it with the conventional correct solution. This section alone justifies half the spec.
- **`grid-template-rows: 0fr → 1fr` for height expansion.** Correct technique. Avoids the layout-thrash trap of animating `height`. Most teams ship the wrong version of this.
- **Pre-computed waveform peaks over real-time FFT.** Right call. Real-time FFT on the progress bar would jitter and look cheap. Pre-computed peaks read as a deliberate signature of the file.
- **Reduced-motion path is named explicitly per layer.** Many specs hand-wave a11y; this one names the behavior for shader, waveform, and color lerp individually.
- **Single-canvas, `pointer-events: none`, `z-index: 0`.** The layering is correct and won't fight the React tree.
- **Typography role triad (Fraunces / Geist / JetBrains Mono).** Defensible, free, variable-font, no glamour fonts trying to do everyone's job. The mono accent for tags/timestamps/format badges is a real design hook — it'll make the app feel engineered.

---

### Contradictions & Conflicts

- **"Aurora shader + waveform … Emil rules don't apply."** This is the spec letting itself off the hook. You cannot exempt the largest visual element on screen from the motion rules that govern everything else and then expect the result to feel calm. Either the aurora obeys a global "low energy" budget or it is the loudest thing in the room. The spec needs to say which.
- **Album-art-driven color vs. "teal / violet / pink / white-hot core" shader palette.** Section 1 hard-codes an aurora palette. Section 3 says `uColor1` and `uColor2` come from album art. Which wins? If album art overrides, the "northern lights" identity dissolves on a red album cover. If the palette overrides, the per-song pipeline is decorative theater. The spec needs a blend rule: e.g., album color tints the curtain *fringe* while the teal base stays fixed.
- **PlayerBar background tint at 5% alpha of `--song-color` on top of the aurora canvas.** Two color systems stacking on the same surface. On a saturated album (deep red), aurora teal underneath, plus 5% red tint on the bar — that's a muddy purple-brown. No rule for how these compose.
- **Waveform fill in `--song-color` on a canvas already washed in `--song-color` aurora.** Same color, foreground on background, contrast collapses on exactly the songs where the per-song color is most visible. No rule for separating foreground from background.
- **"WCAG AA, ≥ 4.5:1 on all text"** vs. an animated shader behind text. Contrast ratio is meaningless against a moving target. The spec needs a contrast *floor* enforced on the shader (max luminance cap on the regions where text sits), not a single static measurement.
- **300ms color lerp** vs. **"Exits: 200ms, Enters: 300ms max."** A 300ms color crossfade between songs is fine in isolation, but the spec doesn't say whether the aurora's amplitude response also crosses fades, or snaps. If amplitude snaps and color lerps, the transition feels broken.
- **`--song-color` as one variable, but the pipeline produces two clusters.** Step 4 takes top 2 clusters; step 6 sets one CSS variable. What happens to cluster 2? Is it `--song-color-2`? The shader takes `uColor1` and `uColor2` — those come from where?

---

### Weak Spots

- **The aurora will fight the UI for attention every second the app is open.** Northern lights are mesmerizing precisely because they're slow, sparse, and most of the sky is black. A fullscreen shader at any meaningful opacity behind a dense library view (rows of song titles, tags, durations) becomes visual noise. The spec has no opacity ramp, no "calm regions," no idea of where the lights should and shouldn't appear. This is the single biggest risk in the whole document.
- **Amplitude-driven shader speed sounds great and will feel cheap.** Real-time audio reactivity on background visuals has been done to death by Winamp visualizers, YouTube music channels, and every meditation app. Without a *concept* — what is the aurora doing during a quiet piano intro vs. a drum hit? — the result is "stuff wiggles when the music gets loud." A premium app needs a more specific behavior: e.g., curtains pulse only on transients, not on continuous loudness.
- **Pre-computing waveform on song load = blocking decode of every track the user touches.** A 40MB FLAC takes meaningful CPU to `decodeAudioData`. On a 10,000-song library, hovering through results means decoding constantly. The spec has no cache, no web worker, no progressive enhancement. The "fallback: flat line array" is mentioned for decode failure but not for "still computing."
- **Album-art color extraction on the main thread.** K-means on a 64×64 image is fast but not free. Combined with decode and shader setup on song change, you have a noticeable hitch at the worst possible moment — the first frame of a new song. Should be a worker.
- **Equalizer icon "only" removes the "Playing" text but doesn't say what state communicates "paused but ready" vs. "no song loaded" vs. "buffering."** The label was redundant, agreed — but the icon now carries more semantic weight and the spec doesn't define its states.
- **`bg-white/[0.05]` full-width tint for active nav.** Correct removal of the side-stripe sin, but `0.05` on top of an animated shader is going to be invisible on bright shader frames and obvious on dark ones. Active state will flicker in perceived intensity. Needs a more robust treatment (border, inset glow, or a static backdrop-filter under the nav column).
- **SVG wordmark with "Fraunces italic letterforms, plain fill."** Going from gradient text to a static SVG wordmark is correct, but a flat italic wordmark in `#e8e6e3` on a moving aurora reads as a watermark, not a brand. The spec needs to decide if the wordmark gets any treatment (subtle backdrop, fixed dark panel behind the sidebar) or accept that it'll disappear on bright frames.
- **Album art halo via `box-shadow` color-mixed with `--song-color`.** On albums with art that already has a colored border (most modern releases do), the halo will look like a print-bleed error. Needs a rule for when the halo applies (probably only when album art has high edge contrast).
- **No spec for empty states.** What does the aurora do with no song loaded? With the queue empty? Defaulting to "teal base" is fine but the spec doesn't say it.
- **No spec for the search/filter input chrome against the shader.** The boolean filter input is the user's primary workspace. It needs a stable, opaque backdrop. Not mentioned.
- **Implementation order puts the shader (item 4, 2 hrs) before the color pipeline (item 6, 1 hr).** You'll build the shader, then realize you don't have colors to drive it, then rebuild it. Order is wrong.

---

### What's Missing

- **A "calm mode" / opacity contract for the aurora.** Maximum brightness in the regions where text sits. Falloff toward the screen edges or away from UI clusters. Without this, everything else collapses.
- **Decode + extraction caching strategy.** IndexedDB? In-memory LRU? Per-song JSON sidecar on disk via the backend? Pick one. The backend already scans files — waveform peaks and dominant colors should be cached server-side and served as part of the song payload. This is a backend-touching decision the spec defers.
- **What `uColor2` is.** Cluster 2? A derived complement? Fixed teal? Critical and unspecified.
- **Aurora behavior in different app views.** Library, filter, playlist detail, song detail — does the aurora change? Same intensity everywhere? Quieter in dense list views?
- **Waveform interaction states.** Hover preview (show timestamp tooltip)? Scrubbing (does it ghost-update)? Buffered region (does the SVG show a third color)? Live "now-playing" pulse on the playhead? All deferred.
- **Loading states.** Aurora before first song loads. Waveform before decode completes. Album art before extraction completes. Three pipelines, three loading states, none specified.
- **Error states.** Decode failure path is mentioned for waveform. What about color extraction failure (corrupt art, no art)? Shader compilation failure on weak GPU? The spec has no fallback hierarchy.
- **Tag chip and query syntax typography.** Mono accent is named as the role but no actual spec for the tag chip (background, border, padding, hover, active states against the shader).
- **Mobile / responsive behavior.** Spec waves at this: "responsive layout only, same visual system." A fullscreen GLSL shader behind a 4-column flex on a 6.1" phone screen is a different design problem. Either declare desktop-only explicitly or do the work.
- **What happens when the app is backgrounded.** Aurora should pause. Audio analyser should pause. Not mentioned.
- **Performance budget.** No FPS target. No "shader must stay under N ms per frame." No mention of GPU profiling. For a "premium feel" app, this is the rope you hang yourself with.
- **Album art halo size scaling with art size.** `box-shadow: 0 0 40px 8px` is fixed; if album art appears at multiple sizes (queue thumbnail, now-playing large), the halo is wrong at one of them.
- **Drag-and-drop, context menus, modals — do they sit above the aurora unmodified, or do they bring their own opaque scrim?** Not mentioned.

---

### Competitive Positioning

Honest answer: executed *as written*, this gets you to "nice indie music app with a shader background." It will look impressive in launch screenshots and on Twitter. After two weeks of daily use, the per-song color pipeline is the only thing your power users will still notice; the aurora will fade into the wallpaper category in their attention.

What this spec is missing to genuinely differentiate from Spotify / Tidal / Bandcamp:

- Spotify's now-playing is generic and corporate; Aurora has room to be *intimate*. The spec doesn't capitalize on this. A shader is a decoration, not an identity.
- Tidal's differentiator is audio quality + curated editorial. Aurora's differentiator is the **boolean tag filter and the curator mental model** — neither word appears in this visual spec. The filter input is the most distinctive thing in this app and the spec ignores it.
- Bandcamp's signature feeling is "this is the artist's own page." Aurora's potential signature is "this is your own library, animated by your own taste." The per-song color pipeline gestures at this but the spec stops short of designing for the *library view* — the place where the user actually lives.

The truly differentiating spec would treat the filter/query bar and the song-list-with-tags as the primary canvas, and treat the aurora as a *backdrop that gets out of the way* during work and *blooms* during listening. As written, the spec inverts that priority.

---

### Recommendations

**1. Define the aurora's contract before writing the shader.** Add a section: "Aurora calm regions." Specify max luminance in the column where text lives, falloff curves, and a global intensity multiplier that drops to ~30% in filter/library views and rises to 100% in now-playing / idle. Without this, every other decision in the spec is unstable. This is the single highest-leverage change.

**2. Move waveform peaks and dominant colors to the backend, computed at scan time, cached as columns on `songs`.** The backend already runs mutagen on every file. Add peak extraction (ffmpeg or aubio) and dominant color extraction (Pillow + sklearn) to the scanner. Serve as part of the song payload. This kills three problems: main-thread decode hitch, K-means on song change, and the "still computing" loading state. Frontend just reads two arrays from the API. Two-line change in the spec, half a day of backend work, and the entire "Per-Song Color Pipeline" section gets simpler and faster.

**3. Specify `uColor1` and `uColor2` explicitly, and define the album-color-vs-aurora-palette blend rule.** Proposal: aurora *base curtain* stays in a fixed teal/violet identity palette (the brand); the *fringe highlights* take `--song-color`. This preserves "northern lights" as an identity while letting the per-song pipeline have a real visible role. Without this rule, the spec contradicts itself the first time a red album loads.

Secondary, do in this order: cache decode results in IndexedDB (or kill the feature and use server-computed peaks per recommendation 2); reorder implementation so color pipeline lands before the shader; design the filter/query bar as a deliberate opaque island floating on the aurora rather than as transparent chrome.
