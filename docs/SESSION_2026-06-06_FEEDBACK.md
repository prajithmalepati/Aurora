# Aurora — Session Feedback (2026-06-06)

## User Testing Feedback

After executing 30+ fixes from the audit files (FIX_PLAN_V2, DEEP_AUDIT, DEEP_AUDIT_BACKEND, VISUAL_AUDIT), the user tested on localhost:5173 and reported:

### ✅ What Works
1. **Rapid Next clicks** — Audio leak fixed. staleHowlsRef pattern working.

### ❌ What's Still Wrong

#### 1. Search Focus Ring — WRONG FIX
- **What was done:** Changed `--focus-ring` from `--song-color` to `--aurora-teal` (still a `box-shadow` rectangle)
- **What was asked for:** A subtle **glow/bleed on the edge** of the curved search bar, using the **song color** (not fixed teal)
- **Root problem:** The search bar is a rounded element (`rounded-full` or similar). A `box-shadow` with `0 0 0 Npx` creates a hard rectangle outline that doesn't follow the curve. Need a `0 0 Npx Mpx` spread glow that bleeds outward from the curved edges.
- **What to do:** Replace the rectangular outline focus ring with a soft outer glow:
  ```css
  /* Instead of: */
  box-shadow: 0 0 0 2px var(--aurora-teal), 0 0 0 4px oklch(0 0 0 / 0.6);
  /* Use a soft glow that follows the curve: */
  box-shadow: 0 0 8px 2px color-mix(in oklch, var(--song-color) 50%, transparent),
              0 0 0 1px color-mix(in oklch, var(--song-color) 30%, transparent);
  ```
  The blur radius (8px) makes the glow follow the element's border-radius naturally. The color should be `--song-color` (per-song adaptive), not fixed teal.

#### 2. Queue Panel — Broken Positioning
- **What's visible:** Panel is "barely visible and halfway in the ground"
- **Likely cause:** The QueuePanel exit animation fix removed `if (!open) return null` early return. This means AnimatePresence is always in the DOM. But the panel positioning may rely on the early return to avoid rendering at incorrect coordinates when closed.
- **What to check:**
  - The panel's `bottom`/`top`/`right` positioning CSS
  - Whether AnimatePresence children have correct initial/exit positions
  - Whether the panel renders at `bottom: 0` of the viewport vs `bottom: 0` of the player bar
  - The z-index — may be behind the player bar

#### 3. Sluggishness — No Snappiness
- **Symptom:** Site feels sluggish, not responsive to interactions
- **Likely causes:**
  - Too many Zustand re-renders (store subscriptions causing cascading updates)
  - The seek interval still firing too frequently (250ms = 4 updates/sec, even with the delta guard)
  - Song table rendering 500 rows without virtualization
  - Multiple useEffect chains triggering each other
  - AuroraCanvas RAF loop consuming CPU even when not visible
- **What to do:** Profile with React DevTools Profiler and Chrome Performance tab. Identify the top re-render offenders. Common fixes:
  - Use `useShallow` for Zustand selectors that return objects
  - Memoize expensive components with `React.memo`
  - Virtual scroll for song list (react-window or @tanstack/virtual)
  - Batch Zustand updates in transitions

#### 4. Waveform Lagging After a While
- **Symptom:** The waveform visualization in the player bar starts lagging/falling behind after extended use
- **Likely causes:**
  - RAF loop accumulating drift (no delta-time compensation)
  - Memory leak — Howl instances not being fully cleaned up, accumulating
  - The seek position updates from `setInterval`/`setTimeout` drifting vs actual audio position
  - GC pressure from creating/destroying Howl objects on every song change
- **What to do:**
  - Use `howl.seek()` directly in the RAF loop instead of relying on store updates
  - Add delta-time compensation to the waveform animation
  - Check for Howl instance leaks (Chrome Memory tab after 50+ song changes)
  - Consider using `requestAnimationFrame` with `performance.now()` for consistent timing

## Audit Files Status

| File | Issues | Status |
|------|--------|--------|
| FIX_PLAN_V2.md | 9 issues | 8/9 fixed (P2-UX-3 waveform height skipped) |
| DEEP_AUDIT.md | 13 frontend | 10/13 fixed (#4 multi-select, #10 export slash, waveform deferred) |
| DEEP_AUDIT_BACKEND.md | 24 backend | 12/24 fixed (12 low-severity deferred) |
| VISUAL_AUDIT.md | 17+ visual | 5/5 high fixed, 0/5 medium, 0/4 low |

## Total: ~40 issues identified, ~30 fixed, ~10 deferred + 4 new issues from testing

## New Issues From Testing (Not in Audit Files)
1. Focus ring is rectangular on curved elements (wrong approach entirely)
2. Queue panel positioning broken after animation fix
3. General sluggishness across the app
4. Waveform drift/lag after extended playback
