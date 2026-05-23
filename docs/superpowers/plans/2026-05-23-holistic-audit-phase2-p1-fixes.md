# Holistic Audit Phase 2 — P1 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 2 open P1 issues from the Session 17 holistic audit: glow invisible on dark album art, and a hardcoded color on every primary button.

**Architecture:** Two independent single-file fixes. G-2 adds a lightness floor to the procedural glow color in `albumGradient.ts` so dark-hue songs always produce a perceptible glow on OLED black. I-01 replaces a hardcoded `#050608` hex literal on the primary Button variant with the `--aurora-slate` CSS token already defined in the design system.

**Tech Stack:** TypeScript, React, Tailwind 4, custom CSS token system (`--aurora-*` in `index.css`). No test framework — verification is TypeScript build (`npm run build`) + visual check in running dev server.

---

## File Map

| File | Action | Change |
|------|--------|--------|
| `frontend/src/lib/albumGradient.ts` | **Modify** line 60 | Add lightness floor of 60 to glow output |
| `frontend/src/components/ui/button.tsx` | **Modify** line 21 | Replace `text-[#050608]` with `text-[var(--aurora-slate)]` |

---

## Task 1: G-2 — Glow Lightness Floor

**Problem:** `albumGradient()` picks two aurora hues from an 8-entry table. Hues with `l: 45` (indigo h:230, forest mint h:135) produce `hsla(..., 45%, 0.32)` as the glow color. On a `#06080b` OLED background this is sub-visible. Songs that hash to these buckets appear to have no glow at all.

**Fix:** Clamp the glow-only lightness to a minimum of 60%. The background gradient keeps the original dark `a.l` so the placeholder tile stays muted — only the emitted glow gets the floor.

**Files:**
- Modify: `frontend/src/lib/albumGradient.ts:60`

---

- [ ] **Step 1: Read the current state of albumGradient.ts**

  Current content of `frontend/src/lib/albumGradient.ts` (lines 50–63):

  ```ts
  // Pull toward black — these are dim glow placeholders, not saturated posters.
  const dimA = `hsla(${a.h}, ${a.s}%, ${a.l}%, 0.32)`
  const dimB = `hsla(${b.h}, ${b.s}%, ${b.l}%, 0.22)`

  const background = `
    radial-gradient(ellipse at 30% 20%, ${dimA} 0%, transparent 55%),
    radial-gradient(ellipse at 80% 90%, ${dimB} 0%, transparent 60%),
    linear-gradient(${angle}deg, #0a0c11 0%, #06080b 100%)
  `.trim()

  const glow = `hsla(${a.h}, ${a.s}%, ${a.l}%, 0.32)`

  return { background, glow }
  ```

- [ ] **Step 2: Apply the lightness floor**

  Replace lines 60–62 in `frontend/src/lib/albumGradient.ts`:

  ```ts
  // Pull toward black — these are dim glow placeholders, not saturated posters.
  const dimA = `hsla(${a.h}, ${a.s}%, ${a.l}%, 0.32)`
  const dimB = `hsla(${b.h}, ${b.s}%, ${b.l}%, 0.22)`

  const background = `
    radial-gradient(ellipse at 30% 20%, ${dimA} 0%, transparent 55%),
    radial-gradient(ellipse at 80% 90%, ${dimB} 0%, transparent 60%),
    linear-gradient(${angle}deg, #0a0c11 0%, #06080b 100%)
  `.trim()

  // Floor at l=60 so glow is always perceptible on OLED black (#06080b).
  // background gradient keeps the original a.l (dark) — only emitted glow gets the floor.
  const glowL = Math.max(a.l, 60)
  const glow = `hsla(${a.h}, ${a.s}%, ${glowL}%, 0.32)`

  return { background, glow }
  ```

  The full file after the edit (`frontend/src/lib/albumGradient.ts`):

  ```ts
  /**
   * Procedural album art — generates a deterministic abstract gradient
   * from a song id or title. Subtle, dark, cool-toned. The aurora family.
   *
   * Used as a placeholder when no album art is available.
   */

  // Curated hue anchors from the aurora palette — cold cyans, mints, violets, deep indigos.
  // Each gradient picks two of these, offset so neighbors always feel like the same family.
  const HUES = [
    { h: 168, s: 72, l: 52 }, // teal
    { h: 150, s: 65, l: 55 }, // mint
    { h: 195, s: 70, l: 50 }, // cyan
    { h: 210, s: 60, l: 48 }, // ice blue
    { h: 255, s: 55, l: 55 }, // violet
    { h: 275, s: 50, l: 50 }, // purple
    { h: 230, s: 55, l: 45 }, // indigo
    { h: 135, s: 55, l: 45 }, // forest mint
  ]

  function hashString(input: string): number {
    let hash = 2166136261
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    return Math.abs(hash)
  }

  export interface AlbumGradient {
    background: string
    glow: string
  }

  /**
   * Deterministic dark gradient based on a song's identity.
   * Muted toward black — these are backgrounds for 48–80px tiles, not hero images.
   */
  export function albumGradient(seed: string | number): AlbumGradient {
    const key = String(seed ?? "void")
    const hash = hashString(key)

    const i1 = hash % HUES.length
    const i2 = (i1 + 3 + ((hash >> 8) % 3)) % HUES.length
    const a = HUES[i1]
    const b = HUES[i2]

    const angle = (hash >> 4) % 360

    // Pull toward black — these are dim glow placeholders, not saturated posters.
    const dimA = `hsla(${a.h}, ${a.s}%, ${a.l}%, 0.32)`
    const dimB = `hsla(${b.h}, ${b.s}%, ${b.l}%, 0.22)`

    const background = `
      radial-gradient(ellipse at 30% 20%, ${dimA} 0%, transparent 55%),
      radial-gradient(ellipse at 80% 90%, ${dimB} 0%, transparent 60%),
      linear-gradient(${angle}deg, #0a0c11 0%, #06080b 100%)
    `.trim()

    // Floor at l=60 so glow is always perceptible on OLED black (#06080b).
    // background gradient keeps the original a.l (dark) — only emitted glow gets the floor.
    const glowL = Math.max(a.l, 60)
    const glow = `hsla(${a.h}, ${a.s}%, ${glowL}%, 0.32)`

    return { background, glow }
  }
  ```

- [ ] **Step 3: TypeScript build check**

  ```bash
  cd frontend && npm run build
  ```

  Expected: Build completes. Only the pre-existing `baseUrl` deprecation warning is acceptable. Any new error = stop and fix before proceeding.

- [ ] **Step 4: Visual verification**

  Start the dev server if not running:
  ```bash
  cd frontend && npm run dev
  ```
  Open http://localhost:5173. Navigate to a playlist containing songs with dark album art (e.g. Bad Omens — near-black red covers).

  Play a Bad Omens song. Check the PlayerBar bottom bar:
  - The album art thumbnail should now have a **visible colored glow** (subtle halo) on the black background.
  - Compare to a vivid-art song (e.g. Akaza/AC-DC) — both should now show glow, with only natural variation in color/intensity.
  - The album art placeholder gradient (dark tile when no real art is loaded) should look **unchanged** — the fix only affects the emitted box-shadow, not the tile background.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/lib/albumGradient.ts
  git commit -m "fix(glow): add lightness floor to albumGradient — dark art glow OLED-visible"
  ```

  Then update `docs/HEALTH.md` — change G-2 status from `open` to `fixed`:
  ```
  | G-2 | P1 | fixed | ...
  ```

  ```bash
  git add docs/HEALTH.md
  git commit -m "docs(health): mark G-2 fixed"
  ```

---

## Task 2: I-01 — Primary Button Token Fix

**Problem:** `button.tsx` line 21 has `text-[#050608]` hardcoded on the `primary` variant. This raw hex value propagates to every `variant="primary"` button in the app (play, jam, scan, add, save, etc.). The `--aurora-slate` token is already defined in `index.css` and used correctly on the `destructive` variant in the same file (`text-[var(--aurora-slate)]` — visible on line 29).

**Files:**
- Modify: `frontend/src/components/ui/button.tsx:21`

---

- [ ] **Step 1: Verify --aurora-slate is defined**

  ```bash
  grep -n "aurora-slate" frontend/src/index.css
  ```

  Expected output contains a line like:
  ```
  --aurora-slate: #0a0c11;
  ```
  (or similar dark near-black value — it's the "icon on bright button face" color)

  If the grep returns nothing: open `frontend/src/index.css`, find the `:root` block, add `--aurora-slate: #0a0c11;` next to other surface tokens. If it IS found: proceed.

- [ ] **Step 2: Apply the fix**

  In `frontend/src/components/ui/button.tsx`, line 21, change:

  ```ts
  primary:
    "aurora-btn-loud-primary text-[#050608]",
  ```

  to:

  ```ts
  primary:
    "aurora-btn-loud-primary text-[var(--aurora-slate)]",
  ```

  Full variants object after change:

  ```ts
  const variants = {
    default:
      "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] bg-white/[0.02] hover:bg-white/[0.04] shadow-[inset_0_0_0_1px_var(--aurora-rim)] hover:shadow-[inset_0_0_0_1px_var(--aurora-rim-bright)]",
    primary:
      "aurora-btn-loud-primary text-[var(--aurora-slate)]",
    secondary:
      "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] bg-white/[0.02] hover:bg-white/[0.04] shadow-[inset_0_0_0_1px_var(--aurora-rim)]",
    ghost:
      "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.03]",
    outline:
      "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] shadow-[inset_0_0_0_1px_var(--aurora-rim)] hover:shadow-[inset_0_0_0_1px_var(--aurora-rim-bright)]",
    destructive:
      "bg-[var(--aurora-danger)] text-[var(--aurora-slate)] shadow-[0_0_22px_-6px_rgba(248,113,113,0.45)] hover:bg-[var(--aurora-danger)]/90 hover:shadow-[0_0_28px_-4px_rgba(248,113,113,0.6)]",
  }
  ```

- [ ] **Step 3: TypeScript build check**

  ```bash
  cd frontend && npm run build
  ```

  Expected: Clean build. If Tailwind reports an unknown variable (unlikely — Tailwind 4 resolves CSS vars at runtime), check that `--aurora-slate` exists in `index.css` per Step 1.

- [ ] **Step 4: Visual verification**

  Open http://localhost:5173 (dev server should still be running from Task 1).

  Find any primary button: Play button in PlayerBar, Jam button in Mix, Scan button, any dialog Save/Confirm button.

  Verify:
  - Button text is **dark** (near-black) on the bright teal/gradient background — same appearance as before.
  - No regressions on hover state, disabled state, or size variants.
  - Open the browser devtools, inspect a primary button element. The computed `color` should resolve to the `--aurora-slate` value, not a literal `#050608`.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/components/ui/button.tsx
  git commit -m "fix(tokens): replace #050608 literal with --aurora-slate on primary Button"
  ```

  Update `docs/HEALTH.md` — mark I-01 `fixed`:
  ```
  | I-01 | P1 | fixed | ...
  ```

  I-02, I-03, I-04 remain `open` — they are P2 and out of scope for this plan.

  ```bash
  git add docs/HEALTH.md
  git commit -m "docs(health): mark I-01 fixed"
  ```
