# A2 — Liquid-Glass Button (WebGL) + Player/Sidebar/Perf Fixes

Session 35 plan. Supersedes the rejected pure-CSS glass button (Approach 1). Authored by Opus
after re-reading: `docs/research/*` (the other-model research), `bugs from.md` (DeepSeek repo
audit), and the live code.

## Decisions (locked with user)

| Topic | Decision |
|-------|----------|
| Liquid-glass button | **WebGL true-refraction** (high effort, real Apple-glass look) |
| Browser target | Both/unsure → **cross-browser**, no Chromium-only tricks (no SVG-in-backdrop-filter) |
| Player bar | **Fix containment only** this session. Resizable-bar feature (#11) deferred. |
| Wave stutter | **Light targeted fixes** only. No OffscreenCanvas/worker rewrite. |

## Ownership split

- **Opus (this session):** WebGL glass button — shader + component + integration + fallback.
- **Sonnet (next session, after Opus done):** containment polish, sidebar hover, stutter fixes,
  DeepSeek dead-code cleanup. All specced below with file:line refs so Sonnet starts cold.

---

## Why pure CSS failed (root cause, so we don't repeat)

The aurora is a **full-screen WebGL canvas at `zIndex:0, pointer-events:none`, faded out near the
bottom** (`AuroraCanvas.tsx` FS: `alpha *= smoothstep(1.0, 0.75, uv.y)`). The player bar sits ON
TOP with its own `var(--aurora-surface-bar)` + `blur(12px)`. So **behind the play button there is
almost no aurora** — the colorful moving stuff there is the bleed glow + WaveformBar, both DOM/SVG.

Consequences:
1. CSS `backdrop-filter` can only blur/tint — it cannot bend the background (no lensing) → "painted
   on / missing" look. Confirmed by `prompt-apple-liquid-glass-response.md`.
2. Rendering the button *into* AuroraCanvas is impossible — it'd be occluded by the bar and have no
   color there.
3. CSS cannot sample arbitrary DOM (waveform/bleed) as a shader texture.

**Therefore:** the button gets its **own** WebGL surface that **generates its own flowing color
field** from the song colors (same `dominant_color`/`dominant_color_2` the aurora uses) and refracts
*that*. Result: a liquid-glass orb with the song's aurora flowing inside it, in harmony with the
background, vivid regardless of screen position.

---

## OPUS TASK — WebGL Liquid-Glass Button

### Files
- NEW `frontend/src/components/player/GlassButtonGL.tsx` — WebGL material canvas.
- EDIT `frontend/src/components/player/AuroraPlayButton.tsx` — primary variants render GL; row keeps
  CSS fallback.
- Reuse `@/hooks/useAuroraColor` (`oklchToLinearRgb`, `DEFAULT_COLOR`, `BRAND_TEAL_LINEAR`).

### GlassButtonGL component
- Renders `<canvas position:absolute inset-0 pointer-events-none>` filling the button box.
- Props: `size:number` (css px), `color1:[r,g,b]`, `color2:[r,g,b]` (linear), `playing:boolean`.
- WebGL1 only. `getContext('webgl', { alpha:true, premultipliedAlpha:false })`.
  Blend: `gl.blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA)`. Non-premultiplied rgb out, `alpha=inside`
  so the round orb shows over the dark bar with transparent corners.
- DPR capped 1.5. ResizeObserver to keep canvas pixel size = `size*dpr`.
- Own RAF loop. `prefers-reduced-motion` → render **one static frame**, no loop.
- Pointer: `pointermove` on the parent button writes `uPointer` (0..1) via ref;
  `pointerdown`/`pointerup` animate `uPress` 0→1→0. (Handlers live on the button in AuroraPlayButton,
  pass a ref-setter down, OR GlassButtonGL attaches listeners to `canvas.parentElement`.)
- Context-lost handler → set failed flag → AuroraPlayButton falls back to CSS.

### Fragment shader (button)
```
uv = gl_FragCoord.xy / uResolution        // 0..1
p  = (uv - 0.5) * 2.0                       // -1..1, center 0
d  = length(p)                              // 0 center .. 1 edge
R  = 0.92                                   // orb radius in p-space
inside = 1.0 - smoothstep(R-0.04, R, d)     // AA edge
if inside <= 0 -> alpha 0 (corners transparent)

// hemispherical lens height -> normal
z      = sqrt(max(0.0, 1.0 - (d/R)*(d/R)))
normal = normalize(vec3(p/R, z * (1.0 - 0.35*uPress)))   // press flattens

// self-generated flowing color field (reuse aurora fbm/curtain noise, button-local)
field(coord) = oklab/lin mix of uColor1,uColor2 driven by fbm(coord*scale + uTime*spd)
              boosted brightness so the glass is vivid

// refraction = sample field at displaced coords; chromatic split for R/G/B
lensPower = 0.18 + 0.10*uPress
uvR = uv + normal.xy * (lensPower * 1.04)
uvG = uv + normal.xy * (lensPower * 1.00)
uvB = uv + normal.xy * (lensPower * 0.96)
col = vec3(field(uvR).r, field(uvG).g, field(uvB).b)

// Fresnel rim (thin bright refractive edge)
fres = pow(1.0 - z, 3.0)
col += vec3(0.7,0.85,1.0) * fres * 0.6

// pointer specular (Blinn-Phong-ish)
spec = pow(max(dot(normal, normalize(vec3(uPointer-uv, 0.6))), 0.0), 40.0)
col += vec3(1.0) * spec * 0.9

// slight center dim for DOM-icon legibility on bright frames
col *= mix(0.82, 1.0, smoothstep(0.0, 0.6, d))

gl_FragColor = vec4(col, inside)
```
Tunable; verify live over the shader. Icon = DOM `<span>` on top (z above canvas) with
`drop-shadow` for legibility — NOT drawn in GL.

### AuroraPlayButton refactor
- `isPrimary = variant === 'player-desktop' || variant === 'player-mobile'`.
- Primary: render `<GlassButtonGL …/>` behind the icon span; pull colors from
  `usePlayerStore(s => s.currentSong)` → `oklchToLinearRgb`. If GL fails → CSS `glass-play-btn`
  fallback.
- Row: keep CSS `glass-play-btn` (Sonnet fixes its bugs). Pass `isPrimary` so the `:active` press
  rule only applies to primary (see Sonnet #1/#2).
- Containment (Opus owns primary): GL canvas is round + clipped to its own box → **no halo, no
  bleed above the bar**. Keep only a small tasteful contact shadow on the button (no 28px halo).
- Idle/disabled (no song): static neutral glass (use BRAND_TEAL_LINEAR for both colors).

### Acceptance (Opus)
- Primary button: colorful liquid-glass orb, colors flow + refract, pointer specular tracks, press
  squishes. No halo, sits fully inside the 80px bar. Cross-browser (Chrome+FF). Build passes types.
- Verify live over the aurora shader (Playwright screenshot + user eyeballs in real browser).

---

## SONNET TASKS — (do AFTER Opus button lands; tight specs below)

Commit each separately. `type(scope): description` only. Stage specific files. `npm run build`
after each. `verify` skill before claiming done.

### S1 — Row button bugs (DeepSeek #1, #2, #3, #6, #7)
- **#1/#2 CRITICAL:** `index.css:580` `.glass-play-btn:active:not(:disabled){transform:scale(.955)}`
  applies to ALL glass buttons. Row variant centers via Tailwind `-translate-x-1/2 -translate-y-1/2`;
  the `:active` transform wins (specificity 0,3,0 > 0,1,0) → **button teleports to top-left + shrinks
  on click**. Fix: scope the `:active` press rule to primary only (add `.glass-play-btn--primary`
  class from AuroraPlayButton; row gets `.glass-play-btn--row`). Row press = no glass deform.
- **#3:** specular coord mismatch — `::after inset:-35%` makes `--mx/--my` (button-rel %) wrong vs the
  170% pseudo-element. After Opus, primary no longer uses CSS specular; for the row fallback, drop
  `inset:-35%` → keep specular within the button box (`inset:0`, clip), or remove specular from row
  entirely (row is a small hover affordance).
- **#6:** `AppShell.tsx:65` root grid `overflow:hidden` clips bottom specular. Once row `::after` is
  contained (inset:0), this is moot — confirm no clip remains.
- **#7:** row button has no hover scale (old `.aurora-play-btn` had `hover:scale-105`). Add subtle
  `hover:scale-105` to row variant for responsiveness.

### S2 — Sidebar playlist hover flood (this-session complaint #1)
Root: `BorderGlow` `.edge-light::before` uses `inset 0 0 50px` glows (`index.css:1457-1464`) — larger
than ~40px nav tiles, so it **floods the whole tile** instead of edge-glowing. BorderGlow's
cursor-cone mesh is hero-card decoration mis-scaled to nav rows.
- Fix: **stop using BorderGlow on sidebar playlist tiles** (`Sidebar.tsx` ~144-155,
  `PlaylistItem.tsx` ~43-49). Replace with a purpose-built lightweight hover: at rest = no border;
  on hover = 1px colored inset ring (playlist color) + soft small outer glow, opacity fade-in
  ~180ms. New CSS class e.g. `.playlist-tile-glow`.
- Keep the `BorderGlow` component + its CSS for real cards later (do NOT delete).
- Acceptance: hover a playlist → thin colored edge glow lights up, NO full-tile fill. Rest = clean.

### S3 — Wave stutter, targeted (this-session complaint #4)
- **DeepSeek #8 (primary cause of "slower when playing"):** `PlayerBar.tsx:16` subscribes to `seek`;
  `useAudioPlayer.ts:92` fires `updateSeek` every 250ms → whole PlayerBar (AnimatePresence motion
  song-info, transport btns, WaveformBar, volume) re-renders 4×/sec, contending with the aurora RAF.
  Fix: isolate seek consumers. Extract the seek-time label + the `<input range>` value into a small
  child component that subscribes to `seek` alone; keep the rest of PlayerBar off the `seek`
  subscription. WaveformBar already reads seek via refs — pass seek through a ref/uncontrolled path
  so PlayerBar body doesn't re-render on ticks.
- **Typing jank:** search re-renders the whole `SongTable`. `React.memo` the row component + stable
  callbacks so typing doesn't re-render every row. (Inspect `SongTable.tsx`/`SongRow.tsx` first.)
- **Load:** defer heavy initial mount one frame if it measurably helps (optional).
- Acceptance: no perceptible wave hitch while typing or during playback; profile frame gaps if
  possible.

### S4 — Dead code cleanup (DeepSeek #4, #5)
- **#4:** `AuroraPlayButton.tsx` `buttonRef` is never attached → remove (or attach if handlers need
  it after Opus refactor).
- **#5:** `index.css:1060-1063` stale `.aurora-play-btn` in a transition-restore rule — remove ONLY
  the `.aurora-play-btn` selector; `mix-btn-search` + `aurora-btn-loud-primary` are still used.

---

## DeepSeek `bugs from.md` → task mapping
| # | Bug | Owner |
|---|-----|-------|
| 1 | Row `:active` transform wipes centering (teleport) | S1 |
| 2 | Row shouldn't get press animation | S1 |
| 3 | Specular coord mismatch (inset -35%) | Opus (primary) / S1 (row) |
| 4 | Unused `buttonRef` dead code | S4 |
| 5 | Stale `.aurora-play-btn` CSS | S4 |
| 6 | Grid `overflow:hidden` clips specular | S1 |
| 7 | No row hover scale | S1 |
| 8 | PlayerBar re-renders 4×/sec on seek | S3 |

## Out of scope (deferred)
Resizable player bar (#11), Queue page (#12), Aurora logo (#13), seek-bar shape change (#2 of new3),
FlowingMenu skip animation (#4 of new3), sort UI (#6 of new3).
