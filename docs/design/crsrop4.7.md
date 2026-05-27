Audit complete. Below are concrete findings against the Session 27 changes (commits `895fa24`, `8150ea7`, `5f7f561`, `d545582`, `b37b314`, `3855a99`, `4f7a11f`, `ae7ce0e`, `302de3c`).

---

## Findings

### HIGH

**1. WaveformBar bypasses store — reads Howler private API for seek position**
- File: `frontend/src/components/player/WaveformBar.tsx:53`
- What's wrong: `const howl = (window as any).Howler?._howls?.[0]` reads private internals; `_howls[0]` is whichever Howl was created last and during crossfade points at the outgoing Howl, so playhead can race the audible song.
- Evidence: Journal already classifies this as B2 follow-up (lines 74-75 of JOURNAL). Plan called for `playerStore.seek` prop; implementation never wired it.
- Suggested fix: accept `seek: number` prop from `usePlayerStore`, drive `clipRect.width` and `playlineRef` from it via a `useEffect([seek])` (or a small RAF that reads the store snapshot through `getState()` so React renders aren't required). Drop the `(window as any).Howler` access.

---

### MEDIUM

**2. WaveformBar shows zero progress under reduced-motion**
- File: `frontend/src/components/player/WaveformBar.tsx:65-69`
- What's wrong: the RAF is the only thing that mutates `clipRect.width` / `playlineRef`. Under reduced-motion the early return on line 66 skips RAF entirely, so the played-region path stays clipped to `width=0` for the whole song — the user sees only the dim outline and no playhead, despite the time read-out and seek slider working. This contradicts the spirit of WCAG reduced-motion (suppress animation, not feedback).
- Evidence: Journal Section 3.8 records `clipRect width: ["0","0","0","0","0"]` and treats it as PASS — the absence of motion is correct, the absence of any progress representation is not.
- Suggested fix: drive `clipRect`/`playline` from `seek` prop synchronously (one render per store update) instead of via RAF, then the RAF early return only disables smooth interpolation — not the rendering of the current position. Pairs naturally with finding (1).

**3. Reduced-motion guard not re-evaluated if user toggles preference mid-session**
- Files: `frontend/src/components/player/WaveformBar.tsx:66`, `frontend/src/components/aurora/AuroraCanvas.tsx:243`
- What's wrong: `window.matchMedia('(prefers-reduced-motion: reduce)').matches` is read once at mount. Toggling OS-level reduced-motion off does not start the WebGL shader or the waveform RAF until full reload. Toggling on while playing does not stop them.
- Evidence: no `addEventListener('change', …)` on the MQL anywhere.
- Suggested fix: attach an MQL change listener that starts/cancels RAF (and re-/uninits WebGL) accordingly; or accept this as a documented limitation. Needs investigation re: which side is preferred.

**4. Inline `style` objects on new Session 27 surfaces (CLAUDE.md violation)**
- Files / lines:
  - `frontend/src/components/player/WaveformBar.tsx:77` — `style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}` (trivially Tailwind: `block overflow-visible pointer-events-none`)
  - `frontend/src/components/player/WaveformBar.tsx:102` — `style={{ filter: 'drop-shadow(0 0 4px color-mix(in oklch, var(--song-color) 80%, transparent))' }}`
  - `frontend/src/components/player/WaveformBarSkeleton.tsx:5-10` — entire visual is an inline gradient+animation block; an unused keyframe `waveform-shimmer` already exists in `index.css:1270-1273` that this file does not consume
  - `frontend/src/components/layout/PlayerBar.tsx:108` and `:337` — `style={{ height: '32px' }}` (Tailwind `h-8`)
  - `frontend/src/components/layout/PlayerBar.tsx:173-177` and `:302-306` — dynamic radial-gradient background for play-button star bloom
- What's wrong: CLAUDE.md states "Tailwind classes only. No CSS modules, styled-components, or inline style objects." Session 27 introduces several new inline blocks (WaveformBar, WaveformBarSkeleton are entirely new). The dynamic radial gradient on the play button could be expressed as a CSS class toggled by `data-playing` / `data-buffering` attributes; the rest are static.
- Suggested fix: move `WaveformBarSkeleton`'s style to a `.waveform-skeleton` class that consumes the existing `waveform-shimmer` keyframe; replace static inline blocks with Tailwind utilities; promote the play-button bloom to a CSS class driven by `data-state` attributes. Halo and CSS-var assignments (`--aurora-range-pct`, `var(--halo-art)`) are unavoidable inline patterns — leave those.

---

### LOW

**5. Playhead line hardcodes a global teal instead of per-song color**
- File: `frontend/src/components/player/WaveformBar.tsx:109` — `stroke="oklch(0.78 0.18 195)"`
- What's wrong: PRODUCT.md Design Principle 3 says "Per-song atmosphere, not global palette." The played-region fill correctly uses `var(--song-color)`; the playhead does not, breaking color continuity at the seam.
- Suggested fix: `stroke="color-mix(in oklch, var(--song-color) 80%, white 20%)"` (or pure `var(--song-color)`).

**6. JOURNAL Section 3.6 cites focus-ring CSS that does not exist**
- File: `docs/qa/session27/JOURNAL.md:104`
- What's wrong: claims `:focus-visible { box-shadow: 0 0 0 2px var(--focus-ring-outer, oklch(0.15 0.02 210)), 0 0 0 4px var(--focus-ring-inner, oklch(0.8 0.15 185)); }`. Those variables (`--focus-ring-outer`, `--focus-ring-inner`) appear nowhere in the codebase (grep confirms zero hits). The actual rule at `frontend/src/index.css:326-329` is `box-shadow: var(--focus-ring)`, and `--focus-ring` is defined in `frontend/src/styles/tokens.css:48-49` as a per-song color-mix inner ring + `oklch(0 0 0 / 0.6)` outer halo.
- Evidence: tokens.css:48 shows actual definition; grep for `focus-ring-outer|focus-ring-inner` returns no matches.
- Note: the functional PASS (double ring visible, hasRing:true on 12 tabbed elements) is still valid; the journal's description of the values is wrong. The real implementation is actually richer than what the journal describes (per-song color), so this is documentation drift, not a regression.
- Suggested fix: update JOURNAL 3.6 to reference `--focus-ring` from `tokens.css` and remove the invented `--focus-ring-outer`/`--focus-ring-inner` names.

**7. `lucide-react: ^1.7.0` in dependencies — unusual version**
- File: `frontend/package.json:22`
- What's wrong: lucide-react's well-known release line is `0.x` (still at `~0.470` mid-2025). A `^1.7.0` constraint in 2026 either reflects a new 1.x line, a typo, or a third-party package squat.
- Evidence: cannot verify in a read-only audit; needs npm registry lookup.
- Suggested action: **needs investigation** — `npm view lucide-react versions` to confirm v1.x is the legitimate upstream line; if not, lock back to the canonical 0.x line.

**8. Unused dependency: `motion@^12.38.0`**
- File: `frontend/package.json:23`
- What's wrong: zero imports of `motion` anywhere under `frontend/src/` (verified by grep).
- Evidence: `Grep "from ['\"]motion"` returned no files.
- Suggested fix: remove if not planned, otherwise leave a tracking note. Low priority.

---

## NO FINDING (checked, clean)

- **Native range overlay bound value & keyboard seeking**: `PlayerBar.tsx:114-124` and `:343-353` — `value={Math.round(seek)}` bound to `playerStore.seek`, `onChange` calls `useAudioPlayer.seekTo` (confirmed at `useAudioPlayer.ts:208-219`). `step={1}` gives ±1s arrow-key granularity. Overlay sits on top of `aria-hidden` SVG with `pointer-events-none`, so the range receives all keyboard + pointer events.
- **Focus-ring pulse + reduced-motion**: no focus pulse animation exists. Focus ring is a static `box-shadow: var(--focus-ring)`. Reduced-motion suppression N/A. (User query anticipated a pulse — there isn't one.)
- **Reduced-motion suppresses decorative animations / JS loops**: `index.css:1209-1228` zeros out animation/transition durations globally plus explicit `animation: none !important` on `.aurora-pulse`, `.aurora-idle-shimmer`, `.aurora-eq > span`, `.mix-jam-primary`, `.mix-btn-jam`, `.mix-float-jam`. `index.css:1248-1264` hides the canvas + draws a static gradient via `body::before`. WaveformBar (line 66) and AuroraCanvas (line 243) RAF loops both early-return. Comprehensive. Visual-feedback caveat captured in finding (2).
- **Anti-slop**: aurora gradient is teal→mint→violet (not the banned purple→pink). Body uses `Geist Variable`, display uses `Fraunces`, mono uses `JetBrains Mono Variable` — none of Inter/Roboto/Space Grotesk are referenced. `--ease-spring: cubic-bezier(0.16, 1, 0.30, 1)` is monotonic (no overshoot — not a Material spring). Liquid-glass play button has the required specular (`inset 0 1px 0 rgba(255,255,255,0.22)`) and is not a flat translucent panel.
- **Import drift**: zero relative imports in `frontend/src/components/player/**` or `frontend/src/components/layout/**` (grep confirms). All Session 27 files use `@/` aliases.
- **Raw `fetch()` in components**: none in audited files. The two hits in `playlists/CreatePlaylistDialog.tsx:59` and `playlists/PlaylistDetail.tsx:133` are `fetch(dataURL).then(r => r.blob())` data-URL conversions, not HTTP — and they pre-date Session 27.
- **React Context**: none in audited files. All state via Zustand.
- **Non-shadcn component libraries**: only `lucide-react` icons (allowed) and `@base-ui/react` consumed *inside* `components/ui/*.tsx` (shadcn's headless layer). No new UI libraries pulled into Session 27 surfaces.
- **Toast imports**: none of the audited files import `sonner` (the `@/lib/toast` rule applies only where toasts are used).
- **PASS claim 3.1 (Aurora shader)**: structural items (canvas fixed, z-0, DPR ≤1.5, RAF, amplitude wiring) verifiable in source.
- **PASS claim 3.2 (color bleed)**: per-song CSS vars + `--halo-art` wiring confirmed in code.
- **PASS claim 3.3 (WaveformBar)**: viewBox `0 0 600 32` ✓; resampled to `BAR_COUNT=200` ✓; ClipPath playhead split via `clipRect.width` ✓; range overlay `aria-label="Seek"` opacity-0 ✓. Howler hack already noted (finding 1).
- **PASS claim 3.4 (liquid glass play)**: `backdrop-blur-md`, radial bg, `[contain:paint]`, inset specular shadow, `active:scale-[0.94]` all present at PlayerBar `:155-164` and `:283-293`.
- **PASS claim 3.5 (wordmark + typography)**: all Lucide strokes are `1.5` in the audited files (Sidebar `:76, 82, 175, 180, 185, 190`; AppShell `:40, 63`; PlayerBar `:139, 200, 268, 309, 311, 329, 376, 378`). Fraunces gated to `.font-display` / `.font-display-italic` only.
- **PASS claim 3.7 (empty/buffering/backend-down)**: `star-buffering` class wired via `isBuffering` in PlayerBar `:171, 300`; structurally correct.

[Session 27 visual overhaul audit](b6c3d3a6-f7c4-4b4b-9d8d-aurora-session27-audit-stub) — placeholder; this run produced no committed transcript yet.