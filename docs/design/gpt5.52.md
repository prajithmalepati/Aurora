## Session 27 UI audit — actionable findings

Scope: `WaveformBar.tsx`, `WaveformBarSkeleton.tsx`, `PlayerBar.tsx`, `Sidebar.tsx`, `AppShell.tsx`, `index.css`, `tokens.css`, `package.json`. JOURNAL has only **Phase 1 PASS** (servers + DB schema); that cannot be confirmed from static code review.

---

### MAJOR

**1. WaveformBar RAF loop ignores `prefers-reduced-motion`**
- **File:** `frontend/src/components/player/WaveformBar.tsx:52–68`
- **What's wrong:** Decorative playhead animation runs via `requestAnimationFrame` unconditionally.
- **Evidence:** Design spec requires “kill shader animation, **freeze waveform**” under reduced motion (`docs/superpowers/specs/2026-05-25-aurora-visual-overhaul-design.md:201`). CSS reduced-motion block in `index.css:1209–1228` only targets CSS animations; it does not stop this JS loop.
- **Fix:** Gate the RAF loop on `matchMedia('(prefers-reduced-motion: reduce)')` (or a shared hook); when true, set playhead once from store seek and do not re-schedule RAF.

**2. AppShell mounts animated WebGL canvas with no reduced-motion JS guard**
- **File:** `frontend/src/components/layout/AppShell.tsx:24`
- **What's wrong:** `AuroraCanvas` is always mounted; CSS hides the canvas under reduced motion (`index.css:1248–1251`) but the WebGL RAF loop in `AuroraCanvas.tsx:237–250` still runs (GPU/CPU work continues; spec wants `uIntensity = 0` + static fallback).
- **Evidence:** Spec `2026-05-25-aurora-visual-overhaul-design.md:50`; plan Task 4.6 only added CSS fallback, not JS teardown.
- **Fix:** In `AuroraCanvas`, detect reduced motion and skip RAF / set intensity to 0; or conditionally render static `.aurora-fallback` from `AppShell`.

**3. WaveformBar reads Howler via global hack instead of player state**
- **File:** `frontend/src/components/player/WaveformBar.tsx:53`
- **What's wrong:** `(window as any).Howler?._howls?.[0]` is a private Howler API; plan expected store-driven seek (`docs/superpowers/plans/2026-05-25-aurora-visual-overhaul.md:2417–2428`).
- **Evidence:** Overlay seek uses `playerStore.seek` (`PlayerBar.tsx:121–122`, `350–351`); visual playhead uses a different source. During crossfade, multiple Howls exist; `_howls[0]` may not match `howlRef.current` in `useAudioPlayer.ts:162`.
- **Fix:** Drive playhead from `usePlayerStore(s => s.seek)` (subscribe in RAF or pass `seek` as prop), same as the overlay range.

**4. Seek range `max` fallback can allow invalid seeks**
- **File:** `frontend/src/components/layout/PlayerBar.tsx:119`, `348`
- **What's wrong:** `max={duration || 100}` when `duration` is `0` (missing DB duration before Howl `onload`) exposes a 0–100s range for a longer track.
- **Evidence:** `playSong` sets `duration: song.duration ?? 0` (`playerStore.ts:75`); `setDuration` only runs on Howl `onload` (`useAudioPlayer.ts:145–147`).
- **Fix:** Use `max={Math.max(duration, currentSong?.duration ?? 0) || undefined}` and `disabled={!hasSong || duration <= 0}`, or keep disabled until duration is known.

---

### MINOR

**5. CLAUDE.md inline-style rule violated across Session 27 layout/player files**
- **Files:** `PlayerBar.tsx:48–52,77–79,108,173–177,232–234,302–306,337,389`; `Sidebar.tsx:66–69,229,238,286,291–293`; `AppShell.tsx:33–37`; `WaveformBar.tsx:76,101`; `WaveformBarSkeleton.tsx:5–10`
- **What's wrong:** Multiple `style={{...}}` objects where project rule says Tailwind-only, no inline style objects.
- **Fix:** Move to utility classes / CSS vars (e.g. `--aurora-range-pct` pattern already used for volume at `PlayerBar.tsx:389`).

**6. PlayerBar Lucide icons still use `strokeWidth={2}` (anti-slop audit incomplete)**
- **File:** `frontend/src/components/layout/PlayerBar.tsx:139,200,268,329,376,378`
- **What's wrong:** Shuffle, Repeat, Volume icons use `strokeWidth={2}`; plan/HANDOFF target 1.25–1.5.
- **Evidence:** Sidebar/AppShell icons correctly use `1.5`; PlayerBar transport/volume do not.
- **Fix:** Set `strokeWidth={1.5}` (or `1.25`) on those icons.

**7. Sidebar footer/tag buttons lack `aurora-focus`**
- **File:** `frontend/src/components/layout/Sidebar.tsx:57–60` (wordmark), `258–268` (`FooterAction`), `280–282` (`TagSidebarItem`)
- **What's wrong:** Focus model applies `.aurora-focus` to primary nav (`Sidebar.tsx:219`) but not footer, tags, or brand home button. Global `:focus-visible` still applies (`index.css:326–328`), but keyboard affordance is inconsistent with HANDOFF focus-model claim.
- **Fix:** Add `aurora-focus` to those buttons.

**8. Seek overlay missing `aurora-focus` (volume has it)**
- **File:** `frontend/src/components/layout/PlayerBar.tsx:114–124`, `343–353`
- **What's wrong:** Seek `<input type="range">` has no `aurora-focus`; volume input does (`388`).
- **Evidence:** Global focus ring still works; inconsistency only.
- **Fix:** Add `aurora-focus` to both seek inputs.

**9. Sidebar panel matches “flat translucent without specular” anti-reference**
- **File:** `frontend/src/components/layout/Sidebar.tsx:54`
- **What's wrong:** `bg-[var(--aurora-obsidian)]/60 backdrop-blur-xl` with no inset rim/specular (PlayerBar has `aurora-keyline-top` specular line).
- **Evidence:** `PRODUCT.md:29`
- **Fix:** Add rim/specular treatment consistent with PlayerBar glass language, or use opaque `--aurora-surface-*` tokens.

**10. `--ease-spring` overshoot curve on toast transitions**
- **File:** `frontend/src/index.css:82`, `1192`
- **What's wrong:** `cubic-bezier(0.16, 1.00, 0.30, 1.00)` can overshoot; PRODUCT bans Material-style spring bounces.
- **Fix:** Replace with non-overshooting `--ease-ui` for Sonner slide transitions.

**11. Unused `motion` dependency**
- **File:** `frontend/package.json:23`
- **What's wrong:** `"motion": "^12.38.0"` is listed but no import in `frontend/src`.
- **Fix:** Remove if unused, or wire it if planned.

**12. Violet terminus in teal→green→violet gradients (brand boundary)**
- **File:** `frontend/src/index.css:103`, `643`; volume/seek styling in scoped PlayerBar CSS classes
- **What's wrong:** Gradients end at `#a78bfa` (violet). Not literal purple→pink, but close to AI-slop gradient territory.
- **Fix:** Needs design confirmation — keep if intentional “aurora identity,” or shorten gradient to teal→mint only on functional controls.

---

### NIT

**13. Seek range uses `step={1}` + `Math.round(seek)`**
- **File:** `frontend/src/components/layout/PlayerBar.tsx:120–121`, `349–350`
- **What's wrong:** 1-second quantization; SR users may hear coarse announcements during playback.
- **Fix:** Optional `step="any"` with unrounded value during drag only.

**14. `WaveformBarSkeleton` uses inline keyframe name**
- **File:** `frontend/src/components/player/WaveformBarSkeleton.tsx:9`
- **What's wrong:** Animation defined inline instead of a CSS class (maintainability).
- **Fix:** Use a `.waveform-bar-skeleton` class in `index.css` (keyframes already at `index.css:1270–1273`).

---

### No finding (checked areas)

| Area | Result |
|------|--------|
| Relative imports in scoped TSX | All use `@/` alias |
| Raw `fetch()` in scoped components | None |
| React Context in scoped components | None |
| Light mode code paths | None in scoped files |
| Toast via `@/lib/toast` in scoped files | N/A (no toasts here) |
| Body font anti-slop (Inter/Roboto/Space Grotesk) | Geist body + Fraunces display (`index.css:12–14,219`) |
| Literal purple→pink gradient | Not present; gradient is teal→mint→violet |
| Focus-ring **pulse** + reduced-motion | No pulse animation on focus ring; static `box-shadow` via `--focus-ring` (`tokens.css:48–49`) |
| Seek overlay bound value | Wired: `value={Math.round(seek)}` + `onChange → seekTo()` |
| Keyboard seeking on native range | Native arrow/home/end behavior present; no custom handler blocking it |
| CSS decorative animations under reduced-motion | Global `*` collapse at `index.css:1221–1228` covers `.star-buffering`, `.aurora-idle-shimmer`, `.aurora-eq`, shimmer, etc. |
| Tailwind config | None (Tailwind 4 `@theme` in `index.css`) — expected |
| Non-shadcn component libraries in scoped TSX | None |
| JOURNAL Phase 1 PASS | Code aligns (waveform columns, components wired); runtime server/DB claims not verifiable statically |

---

### JOURNAL PASS verification

- **Phase 1 PASS** (servers up, DB columns `waveform_peaks`, `dominant_color`, `dominant_color_2`): **Not verifiable** from code-only audit. Frontend wiring for `waveform_peaks` exists (`PlayerBar.tsx:109–110`, `338–339`). No other PASS claims in `docs/qa/session27/JOURNAL.md` to verify.