# Aurora Button System — Build Spec (Loud-First, Path B)

> Build spec · 2026-04-29 · Prescriptive · Read-only doc
>
> **Status:** Buildable. A future Sonnet session executes this commit
> by commit. No decisions are open in the body of the spec; everything
> the executor needs is here.
>
> **Authority:** [`docs/design-system.md`](../design-system.md) v2 is
> law. [`docs/design/button-system.md`](./button-system.md) is the
> exploration that produced the locked direction. This spec
> *operationalises* that exploration under the user's locked decisions.
> Where this spec contradicts the exploration, **this spec wins**, and
> §11 (Inferred vs. Explicit) records the divergence.
>
> **Locked direction:** **C — Frosted Lens** (`::before` backlight +
> outer `box-shadow` diffusion).
>
> **Locked AlbumArt path:** **B — leave AlbumArt alone.** No backend
> extraction, no `dominant_color` column, no `glowColor` prop, no
> `--aurora-album-bleed-*` tokens. The album cover's perceptual warm
> leakage through the existing `boxShadow` blur stays as emergent
> ambient. No code in this session touches it.
>
> **Locked colour strategy:** uniform aurora light, with `--aurora-danger`
> as the only exception (per §4.1 of the exploration).
>
> **Locked intensity behaviour:** tiered — Loud / Quiet / Warning (per
> §4.2 of the exploration).
>
> **Locked rollout scope (this session):** loud-first only. Play button,
> primary `Button` variant, Mix Search, Mix Jam (inline) and Mix Jam
> (float). Chrome migration (sidebar nav, IconBtn dedup, dialog ghost,
> Edit-query pill, playlist chips, FooterAction JS-hover migration) is
> deferred to a follow-up session.

---

## 1. Pre-flight summary (this spec session)

| Check | Status |
|---|---|
| `docs/design/button-system.md` readable | ✓ Yes |
| §8.3 token list present | ✓ Yes |
| §7.6 composition token list present | ✓ Yes |
| `docs/design-system.md` v2 readable, v2 token tables present | ✓ Yes |
| `graphify-out/graph.json` non-empty and recent (2026-04-28) | ✓ Yes — 460 nodes, 43 communities |
| `graphify-out/GRAPH_REPORT.md` reviewed | ✓ Yes — graph is backend-heavy; frontend visual layer is thinly extracted, so direct reads were used for visual files |
| `frontend/src/components/ui/button.tsx` located and read | ✓ Yes |
| Both `IconBtn` definitions located and read | ✓ Yes ([SongRow.tsx:311-326](../../frontend/src/components/songs/SongRow.tsx#L311-L326), [PlaylistDetail.tsx:690-706](../../frontend/src/components/playlists/PlaylistDetail.tsx#L690-L706)) |
| ui-ux-pro-max skill | Available; not queried — Direction C technique is already specified in the exploration; a style-card lookup adds no signal here. |
| caveman skill | Active (full). Spec body is full prose. |

No stop conditions tripped during spec authoring.

---

## 2. Locked decisions, restated as pre-conditions

These are the user's calls. They are not revised in this spec; they are
the foundation it sits on.

1. **Direction C — Frosted Lens.** Backlight `::before` + outer
   `box-shadow` diffusion. Surface is uniform (no internal gradient).
2. **AlbumArt Path B.** AlbumArt is not modified. The album cover's
   warm leakage through its existing `boxShadow` blur is preserved as
   emergent ambient atmosphere. No backend column, no new prop, no
   `--aurora-album-bleed-*` tokens.
3. **Colour strategy: uniform aurora + `destructive` exception.**
   Identity-bearing buttons read `--aurora-accent-interactive` family
   colours; the only non-aurora exception is destructive (uses
   `--aurora-danger`).
4. **Intensity behaviour: tiered.** Loud (always-on at low ambience,
   brightens on hover), Quiet (off at rest, lights up on hover),
   Warning (off at rest, danger glow on hover).
5. **Loud-first rollout.** This session migrates only the Loud tier:
   play button, primary `Button` variant, Mix Search, Mix Jam
   (inline `.mix-jam-primary`), Mix Jam (float `.mix-float-jam`).
   Sidebar nav, IconBtn pair, FooterAction, Edit-query pill, playlist
   chips, dialog ghost, TagEditor buttons — all deferred.

---

## 3. §7.3 PlayerBar-scope override under Path B — re-justification

The exploration's §7.3 introduced an override on `.aurora-keyline-top`
(the PlayerBar root) that dims the Loud-tier outer halo so it would
not "fight AlbumArt's deliberate album-tinted bleed." Path B retires
the deliberate album-tinted bleed (no extraction, no `dominant_color`).
The override therefore needs a fresh justification, or it must drop.

**Decision: keep the override. New justification:** the user has
explicitly chosen Path B *because they value the existing emergent
warm leakage* through AlbumArt's `boxShadow` blur. That leakage is the
PlayerBar's atmospheric character today, and the user has decided not
to engineer it explicitly precisely because they want it left alone.
A full-strength Loud-tier outer halo on the play button (28 px
rest / 36 px hover at the default `:root` values) would wash a teal
diffusion across the centre of the bar that competes with — and visually
overpowers — the AlbumArt-driven leakage on the bar's left. Dimming
the play button's outer halo (to ~14 px / 18 px) lets the existing
AlbumArt atmosphere read as the bar's primary mood while the play
button's identity is carried by its `::before` backlight (which the
override leaves untouched).

In short: the override is no longer about respecting a *deliberate*
album-tinted source; it is about preserving the *emergent* atmospheric
character of the existing AlbumArt boxShadow that the user has
decided to keep. Same mechanism, reframed motivation. **The override
stays.**

This is the only re-justification §7.3 needs. The override's scope
(only the outer halo, not the backlight) and its target (`.aurora-keyline-top`)
both remain correct.

---

## 4. Naming decisions

The exploration's §8.3 surfaced one explicit ambiguity ("button size
`xs-icon` (or rename `icon-sm`)"). The codebase resolves it.

### 4.1 Button size for h-7 w-7

**Decision: `icon-sm` (no rename, no new size).**

[`button.tsx:30-36`](../../frontend/src/components/ui/button.tsx#L30-L36)
already declares `"icon-sm": "h-7 w-7"`. Both local `IconBtn`
definitions
([SongRow.tsx:317](../../frontend/src/components/songs/SongRow.tsx#L317),
[PlaylistDetail.tsx:697](../../frontend/src/components/playlists/PlaylistDetail.tsx#L697))
use exactly `h-7 w-7 rounded-md`. The dialog close button already
consumes `<Button variant="ghost" size="icon-sm" />`
([dialog.tsx:70-85](../../frontend/src/components/ui/dialog.tsx#L70-L85)).
The exploration's "or rename `icon-sm`" parenthetical was written
before this code path was checked. There is nothing to add and nothing
to rename. **`icon-sm` is the locked size name.**

### 4.2 Variant for filled destructive (AlertDialogAction)

**Decision: `destructive`.**

Existing variants are `default | primary | secondary | ghost | outline`
([button.tsx:8](../../frontend/src/components/ui/button.tsx#L8)).
shadcn's own scaffolding uses `destructive` as the canonical name for
the warn/delete fill, and the design-system bridge already maps
`--destructive` → `--aurora-danger`
([design-system.md "Shadcn ↔ Aurora token bridge"](../design-system.md)).
The name fits both the existing variant set's diction and the bridge.

### 4.3 Token names for outer-halo length scalars

**Decision: keep `--aurora-button-glow-rest` and
`--aurora-button-glow-hover` as named in §7.6.** They follow the
established `--aurora-{family}-{state}` pattern (cf.
`--aurora-accent-interactive-glow`, `--aurora-secondary-glow`). No
rename earned its keep.

The optional spread scalars from §7.6
(`--aurora-button-glow-spread`, `--aurora-button-glow-spread-hover`)
**ship as tokens, not inlined.** Inlining them inside the recipe and
overriding them via the PlayerBar-scope override produces awkward
`calc(-1 * ...)` duplication. Tokenising them keeps the override
symmetric with the blur-length tokens.

### 4.4 Token names for backlight scalars

**Decision: keep `--aurora-backlight-rest`, `--aurora-backlight-hover`,
and a single `--aurora-backlight-blur` (12 px).**

The exploration's §8.3 listed `--aurora-backlight-blur-rest` and
`--aurora-backlight-blur-hover` as separate scalars. Direction C's
state table (§5) only uses one Loud blur value (12 px) at both rest
and hover; only opacity changes between rest and hover. A second
`*-hover` blur scalar would never be consumed under Direction C.
Collapsing to a single `--aurora-backlight-blur` token reduces the
new-token count by one. The Quiet tier's 10 px blur — which only
becomes relevant once chrome migration runs — can be inlined in the
Quiet recipe at that time (or surfaced as `--aurora-backlight-blur-quiet`
in the chrome session).

### 4.5 Recipe class name

**Decision: do not introduce `.btn-loud` in this session.**

The exploration's sketches use `.btn-loud` as a placeholder. In the
actual codebase, the Loud-tier recipe is grafted onto each existing
target (`.aurora-play-btn`, `.mix-btn-search`, `.mix-jam-primary`,
`.mix-float-jam`, base `Button` `primary`-variant classes) rather
than introduced as a new shared class. Reasons:

- A shared `.btn-loud` class would need to be applied to the base
  Button `primary` variant via JSX, which means the variant's full
  className string changes — a larger blast radius than just touching
  CSS rules that already exist.
- Each existing target already has its own class with bespoke sizing
  (50 px Jam, 48 px float-Jam, 32 px Search pill, 40-44 px play
  button); a single shared class can't carry all these sizes.
- A shared class becomes worth it once the Quiet-tier recipe lands
  too (the chrome session may genuinely need it). Defer the
  abstraction until then, per CLAUDE.md "Don't add features beyond
  what the task requires."

**The recipe is delivered as edits to existing per-target classes
in commit 3.**

### 4.6 Locked names in one place

| Concern | Locked name |
|---|---|
| Button size for h-7 w-7 | `icon-sm` (already exists) |
| Filled destructive variant | `destructive` |
| Loud backlight opacity at rest | `--aurora-backlight-rest` |
| Loud backlight opacity at hover | `--aurora-backlight-hover` |
| Loud backlight blur radius | `--aurora-backlight-blur` |
| Loud outer-halo blur length at rest | `--aurora-button-glow-rest` |
| Loud outer-halo blur length at hover | `--aurora-button-glow-hover` |
| Loud outer-halo negative spread at rest | `--aurora-button-glow-spread` |
| Loud outer-halo negative spread at hover | `--aurora-button-glow-spread-hover` |
| Recipe shared class | (none — recipe lives in existing per-target classes this session) |

---

## 5. Final token list (Path-B-filtered)

This is §8.3 plus §7.6 with Path-B drops applied, then deduplicated.

### 5.1 New CSS custom properties (declared at `:root`)

| Token | Default value | Type | Justification |
|---|---|---|---|
| `--aurora-backlight-rest` | `0.65` | unitless opacity | Loud-tier `::before` backlight opacity at rest. Per Direction C state table. |
| `--aurora-backlight-hover` | `0.9` | unitless opacity | Loud-tier `::before` backlight opacity on hover. Per Direction C state table. |
| `--aurora-backlight-blur` | `12px` | length | Loud-tier `::before` blur radius. Per Direction C state table; single value covers rest + hover for Loud. |
| `--aurora-button-glow-rest` | `28px` | length | Loud-tier outer-halo `box-shadow` blur length at rest. Per §7.3 sketch. |
| `--aurora-button-glow-hover` | `36px` | length | Loud-tier outer-halo `box-shadow` blur length on hover. |
| `--aurora-button-glow-spread` | `10px` | length (positive) | Negative-spread length at rest; consumed as `calc(-1 * var(...))`. |
| `--aurora-button-glow-spread-hover` | `6px` | length (positive) | Negative-spread length on hover. |

All seven tokens are pure scalars. None of them name a colour. None of
them references AlbumArt. They are tunable in one place.

### 5.2 Scope override (PlayerBar-only)

Under `.aurora-keyline-top` (the PlayerBar root scope, defined at
[`PlayerBar.tsx:154-168`](../../frontend/src/components/layout/PlayerBar.tsx#L154-L168)
and styled at [`index.css:357-394`](../../frontend/src/index.css#L357-L394)):

| Token | Override value | Rationale |
|---|---|---|
| `--aurora-button-glow-rest` | `14px` | Roughly half the default. Lets the emergent AlbumArt atmosphere read as the bar's primary mood (§3 above). |
| `--aurora-button-glow-hover` | `18px` | Roughly half the default. |

The backlight scalars (`--aurora-backlight-*`) are **not overridden**
in PlayerBar scope. The play button's identity is carried by its
backlight; only the outer halo is dimmed.

### 5.3 New `Button` variant

| Variant | Recipe |
|---|---|
| `destructive` | Filled. Background `var(--aurora-danger)`. Text `var(--aurora-slate)` (dark on light, matches `primary` text rule). `box-shadow: 0 0 22px -6px rgba(248,113,113,0.45)`; on hover, `0 0 28px -4px rgba(248,113,113,0.6)`. Inherits all base styles. |

The `destructive` variant **does not** apply the Direction C `::before`
backlight in this session; it ships as a flat filled treatment with a
warning halo. Under the Loud-tier recipe it will pick up backlight in
a later session if/when the recipe is parameterised by colour family.
For now: it retires the AlertDialogAction `className` override
(§3.21 of the exploration) and that is its full scope.

### 5.4 Items dropped under Path B (from §7.6)

These are explicitly **not added** in this session:

| Dropped | Reason |
|---|---|
| `--aurora-album-bleed-color` | AlbumArt unmodified. |
| `--aurora-album-bleed-radius` | AlbumArt unmodified. |
| `--aurora-album-bleed-opacity` | AlbumArt unmodified. |
| `AlbumArt` prop `glowColor?: string` | AlbumArt unmodified. |
| `Song` field `dominant_color?: string \| null` (frontend type + backend column) | No extraction, no schema change. |
| `@property --aurora-album-bleed-color` registration | No animated bleed-colour transitions because there is no bleed-colour token. |

### 5.5 Items dropped or already-resolved (from §8.3)

| Item | Disposition |
|---|---|
| `Button` size `xs-icon` (or rename `icon-sm`) | **Already resolved** — `icon-sm` exists at h-7 w-7. No work in this session. |
| Move `IconBtn` into the base `Button` component | **Deferred** to chrome session. Loud-first scope does not include any IconBtn. |
| Migrate JS hover handlers in `FooterAction`, Edit-query pill, playlist chips to CSS | **Deferred** to chrome session. None of these are Loud-tier; the Loud-tier targets all already use CSS-only hover. |

---

## 6. Commit sequence

The user's working hypothesis was 5 commits. **This spec proposes 3
commits.** Two of the user's hypothesised commits are entirely chrome-
session work (JS-hover migration; IconBtn dedup) and have no consumer
in the Loud-tier rollout — including them in this session would
expand scope without enabling the Loud rollout. The 3-commit sequence
below is the minimum viable Loud-first.

Each commit is independently shippable. Each leaves the app in a
visually-equivalent-or-better state.

### Commit 1 — `feat(tokens): add Loud-tier scalars + PlayerBar-scope override`

**Files touched**
- `frontend/src/index.css`

**What it does**
- Adds the seven `:root` tokens listed in §5.1 with the default values
  shown.
- Adds the `.aurora-keyline-top` scope override block listed in §5.2.
- No consumer is added in this commit. The tokens exist; nothing reads
  them yet.

**Rationale for ordering**
- Tokens are pure-additive declarations. They cannot regress any
  visual state because nothing references them. Landing them first
  means commits 2 and 3 land *consumers only* with no token-and-
  consumer race.
- Splitting tokens out from consumers also makes the diff small and
  easy to revert if a default value needs tuning later.

**Acceptance criteria (Sonnet must verify before staging)**
- `npm run build` (frontend) produces no new errors or warnings.
- `npm run dev` boots; opening any view produces no visual change
  versus pre-commit (verify by eye on Mix page, song list, PlayerBar).
- `index.css` diff contains only token additions and the override
  block. No existing rules are modified.
- Token naming exactly matches §4.6.

**Stop condition**
- If a token name in §5.1 collides with an existing `--aurora-*`
  declaration in `index.css`, **halt and surface to user.** Do not
  silently rename.

---

### Commit 2 — `feat(button): add destructive variant; retire AlertDialogAction overrides`

**Files touched**
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/songs/SongRow.tsx` (one className override)
- `frontend/src/components/playlists/PlaylistDetail.tsx` (one className override)

**What it does**
- Adds `destructive` to the `variant` union in `ButtonProps`.
- Adds the `destructive` recipe to the `variants` object per §5.3.
- Replaces the inline `className="bg-[var(--aurora-danger)] text-black hover:bg-[var(--aurora-danger)]/90"`
  on `<AlertDialogAction>` in
  [`SongRow.tsx:277-282`](../../frontend/src/components/songs/SongRow.tsx#L277-L282)
  with `<AlertDialogAction asChild><Button variant="destructive">Delete</Button></AlertDialogAction>`,
  or the equivalent supported by the existing `AlertDialogAction`
  primitive (Sonnet inspects
  [`alert-dialog.tsx`](../../frontend/src/components/ui/alert-dialog.tsx)
  to confirm the exact pattern).
- Same replacement in
  [`PlaylistDetail.tsx:505-510`](../../frontend/src/components/playlists/PlaylistDetail.tsx#L505-L510).

**Rationale for ordering**
- Independent of Commit 1's tokens (the destructive recipe doesn't
  consume any of them).
- Independent of Commit 3 (destructive does not get the Frosted Lens
  treatment in this session — see §5.3).
- Lands before Commit 3 so that Commit 3's diff is purely about
  Loud-tier identity buttons, not destructive bookkeeping.

**Acceptance criteria**
- `npm run build` clean.
- `<Button variant="destructive">Delete</Button>` renders as a
  `--aurora-danger` filled button with dark text and a soft red halo.
- The two AlertDialog confirm buttons (delete song, delete playlist)
  open and dismiss correctly. Click handlers still fire.
- No `className="bg-[var(--aurora-danger)]..."` strings remain in
  `SongRow.tsx` or `PlaylistDetail.tsx` after the change. Verify with
  `grep -n "var(--aurora-danger)" frontend/src/components/songs/SongRow.tsx frontend/src/components/playlists/PlaylistDetail.tsx`.
- Existing `Button` variants (`default | primary | secondary | ghost | outline`)
  are unchanged.

**Stop condition**
- If `<AlertDialogAction>`'s `asChild` API or equivalent does not
  accept a `<Button>` child cleanly (i.e., styling regresses or click
  semantics break), **halt and surface to user.** Do not invent a
  workaround that re-introduces the className override.

---

### Commit 3 — `feat(buttons): apply Direction C — Frosted Lens — Loud tier`

**Files touched**
- `frontend/src/index.css` (recipes for `.aurora-play-btn`,
  `.mix-btn-search`, `.mix-jam-primary`, `.mix-float-jam`)
- `frontend/src/components/ui/button.tsx` (the `primary` variant
  recipe)

**What it does** — for each of the five Loud-tier targets:

1. **`.aurora-play-btn`** ([index.css:512-518](../../frontend/src/index.css#L512-L518)):
   - Replace the `var(--aurora-gradient)` background with a uniform
     glass surface: `background: rgba(255, 255, 255, 0.04)`.
   - Add `position: relative; isolation: isolate;` so `::before` can
     sit at `z-index: -1` without escaping the stacking context.
   - Add `color: var(--aurora-slate)` (the play glyph stays dark on
     the lit disc, per §4.5 of the exploration — transport glyphs
     remain filled).
   - Add `box-shadow: inset 0 0 0 1px var(--aurora-rim-bright),
     0 0 var(--aurora-button-glow-rest) calc(-1 * var(--aurora-button-glow-spread))
     var(--aurora-accent-interactive-glow);` for the outer diffusion.
   - Add `::before` per Direction C: `inset: -6px; z-index: -1;
     border-radius: inherit; background: radial-gradient(closest-side,
     var(--aurora-accent-interactive) 0%,
     var(--aurora-accent-interactive-glow) 55%, transparent 100%);
     filter: blur(var(--aurora-backlight-blur)); opacity:
     var(--aurora-backlight-rest); transition: opacity 200ms ease;`.
   - Hover state: bump background to `rgba(255, 255, 255, 0.06)`,
     swap `box-shadow` outer to `--aurora-button-glow-hover` /
     `--aurora-button-glow-spread-hover`, and bump `::before`
     opacity to `var(--aurora-backlight-hover)`.
   - Active state already covered by `.aurora-btn-press` applied via
     JSX className composition; no change needed.
   - Reduced-motion: the existing global block in `index.css`
     collapses transitions to 0.01ms. No additional rule needed.

2. **Base `Button` `primary` variant**
   ([button.tsx:20-21](../../frontend/src/components/ui/button.tsx#L20-L21)):
   - Replace the inline `style={{ background: 'var(--aurora-gradient)' }}`
     ([button.tsx:38-41](../../frontend/src/components/ui/button.tsx#L38-L41))
     with a uniform glass surface in the variant className. The
     `primaryStyle` constant is removed; the `style` prop on the
     `<button>` becomes pure pass-through.
   - The variant's hardcoded box-shadow is replaced with token-driven
     shadows mirroring the play button's recipe.
   - Because Tailwind cannot directly express `::before` pseudo-
     element rules, the variant adopts a small dedicated class —
     **`aurora-btn-loud-primary`** — declared in `index.css` alongside
     the play button rule. The variant className composes that class
     in plus the existing utility classes for sizing/typography. This
     is the smallest scope that gets `::before` onto the primary
     variant without a JSX restructure.

3. **`.mix-btn-search`** ([index.css:695-705](../../frontend/src/index.css#L695-L705)):
   - Replace the solid `--aurora-accent-interactive` background with
     the same glass surface + `::before` + outer halo pattern.
   - Text colour stays `var(--aurora-slate)`.
   - Hover state mirrors the play button.

4. **`.mix-jam-primary`** ([index.css:808-834](../../frontend/src/index.css#L808-L834)):
   - The current rule has a teal→violet 135° gradient background and
     dual-glow. Direction C keeps the dual-glow *atmosphere*
     (interactive + secondary), so the outer `box-shadow` becomes a
     dual-colour pair where each layer reads
     `var(--aurora-button-glow-rest) / -spread` /
     `var(--aurora-accent-interactive-glow)` and the same with
     `--aurora-secondary-glow`.
   - Background becomes the uniform glass surface; the gradient
     identity moves into the `::before` backlight, which itself can
     be a dual-colour radial (interactive at 0%, secondary at 55%) to
     preserve the teal→violet character at rest.
   - Text colour stays `#ffffff`.
   - The existing `transform: scale(1.02)` on hover is **removed**.
     Rationale: Direction C's identity is light, not size. The
     `aurora-btn-press` active scale is preserved; the rest→hover
     scale is not.
   - Disabled-tier-3 opacity (0.55) is preserved via the existing
     `:disabled` rule.

5. **`.mix-float-jam`** ([index.css:886-911](../../frontend/src/index.css#L886-L911)):
   - Same treatment as `.mix-jam-primary` at smaller dimensions.
   - The existing `transform: scale(1.03)` on hover is removed for
     the same reason.

**Loud-first scope confirmation** — see §7.

**Rationale for ordering**
- Lands last because it consumes Commit 1's tokens and establishes the
  visual recipe that future tier work (Quiet, Warning) will inherit.
- Lands as one commit (not five per-target commits) because the
  recipe is the unit of change. Splitting per-target would produce
  five intermediate states where the play button uses Frosted Lens
  but Mix Search still uses the old solid-fill — visually
  inconsistent, harder to bisect.

**Acceptance criteria**
- `npm run build` clean.
- The five targets visibly read as Frosted Lens: uniform glass
  surface, coloured backlight visible behind, soft outer diffusion
  bleeding into the surrounding atmosphere.
- The play button no longer reads "left-heavy / teal-dominant" — the
  surface has no internal gradient axis.
- The PlayerBar override visibly dims the play button's outer halo
  relative to a primary `Button` rendered elsewhere (e.g., a dialog
  Save button). The play button's backlight is unchanged in
  PlayerBar scope.
- Reduced-motion (`@media (prefers-reduced-motion: reduce)` in
  DevTools or OS preference): the backlight and outer halo snap to
  their target opacity / blur instead of fading. The buttons remain
  legible.
- All other buttons in the app (sidebar nav, IconBtn pair, dialog
  ghost cancel, FooterAction, Edit-query pill, playlist chips,
  TagEditor row buttons, AlertDialog cancel) **render unchanged**.
- The Mix Jam buttons no longer scale on hover; click still fires.
- 25-button stress test: open the Mix page with a non-trivial
  result set so float-zone, inline Jam, Search, Shuffle, the SongRow
  per-row play button, and the PlayerBar play button all render at
  once. Frame-rate during a hover sweep stays smooth (no compositor
  jank). Watch the SongRow per-row `.aurora-play-btn` instances
  specifically because they carry the Frosted Lens recipe and there
  can be many on screen.
- After the commit, the regex search
  `var\(--aurora-gradient\)` in `frontend/src/components/ui/button.tsx`
  returns zero matches in the `primary` variant path (the gradient
  is no longer the Loud-tier surface). The gradient still appears
  elsewhere (wordmark, currently-playing title) — those are out of
  scope.

**Stop condition (per Commit 3, in priority order)**
1. **Halt:** any of the five Loud-tier targets visibly breaks
   (icon disappears, button becomes invisible against background,
   stacking context escapes and the `::before` paints over an
   unrelated element).
2. **Halt:** PlayerBar override does not actually scope — the play
   button's outer halo renders at full intensity inside the bar,
   which means the cascade isn't reaching the rule. Do not patch by
   adding `!important`; debug the scope (likely the override block
   is targeting the wrong selector).
3. **Halt:** the SongRow per-row play button's `::before` paints
   *over* the row's hover overlay (z-index conflict) instead of
   behind the disc. The fix is `isolation: isolate` on `.aurora-play-btn`
   and z-index ordering, but only attempt it if the rule is in
   `.aurora-play-btn` itself — do not reach into SongRow's row code.
4. **Surface:** any visual regression in a button **outside** the
   five Loud-tier targets. The recipe should not bleed.
5. **Surface:** Mix Jam dual-colour `::before` backlight reads
   muddy (the radial gradient between interactive teal at 0% and
   secondary violet at 55% can desaturate to brown on small surfaces).
   If so, propose the fallback inline: keep `::before` single-colour
   teal and let the secondary violet appear only in the outer halo
   layer. Do not ship a muddy backlight.

---

## 7. Loud-first scope — confirmation against §3

The user's named loud-first list: play button + primary `Button` +
Mix Search + Mix Jam.

The exploration's §3 "Categorisation map" lists the Identity / primary
action category as: base Button "primary", play button, Mix Search,
Mix Jam (inline + float). **There are five buttons in this category,
not four.** The user's "Mix Jam" is ambiguous between the inline
`.mix-jam-primary` ([index.css:808](../../frontend/src/index.css#L808))
and the float-zone `.mix-float-jam`
([index.css:886](../../frontend/src/index.css#L886)).

**This spec includes both.** Reasoning:

- Both share the identity role ("execute the query as a randomised
  jam"). Splitting them across sessions would leave the float-zone
  Jam button rendering in the old teal→violet-with-dual-glow
  recipe while the inline Jam reads as Frosted Lens, on the same
  page, often visible at the same time. That is a worse intermediate
  state than the pre-recipe baseline.
- The two share most of their CSS. Migrating both in one commit is
  smaller than migrating one and re-reading the other later.

**Surface for explicit user confirmation:** the spec's loud-first
list is `play button + primary Button + Mix Search + Mix Jam (inline)
+ Mix Jam (float)` — five targets. If the user wants float-Jam
deferred, halve §6 Commit 3 and ship four. Recommended: ship five.

**Other §3 categorisation entries explicitly excluded:**

| Category | Example | Why excluded |
|---|---|---|
| Secondary glass | base Button default/secondary/outline/ghost, Edit-query pill, Mix Shuffle, dialog Cancel | Quiet tier — chrome session |
| Destructive | AlertDialog action, IconBtn danger | Destructive *variant* lands in Commit 2 (filled fallback). Frosted Lens for destructive lands in chrome session. |
| Neutral nav / sidebar surface | NavItem, TagSidebarItem, FooterAction, TagEditor suggestion, Mix Clear | Quiet tier — chrome session |
| Icon-only row action | SongRow IconBtn, PlaylistDetail IconBtn, hero pencil/trash | Quiet/Warning tier; dedup is its own commit, deferred |
| Transport (no fill) | PlayerBar skip / prev / next / mute | These have no fill at rest by design (§3.3); Frosted Lens does not apply — they remain text-color icons. |
| Chips and keys | aurora-chip, mix-kbd, playlist chip | Out of category for buttons-with-light. Chips and keys retain their existing recipes; chrome session may revisit. |

**Loud-tier completeness check:** are there Loud-tier buttons in the
codebase that §3 *missed*? Spot-checked:

- Sidebar footer "New Playlist" — §3.6 places it under "Sidebar footer
  actions" (neutral nav surface, Quiet). Not Loud.
- Dialog "Save" / "Done" / "Scan" — §3.20 routes these through base
  `Button variant="primary"`, so they pick up the Loud recipe
  automatically when Commit 3 lands. No separate target needed.
- AlertDialog "Cancel" — uses base `Button variant="ghost"`. Quiet —
  chrome session.
- SongRow per-row hover play button — uses `.aurora-play-btn`
  ([SongRow.tsx:120-129](../../frontend/src/components/songs/SongRow.tsx#L120-L129)).
  The recipe is grafted onto `.aurora-play-btn` in Commit 3, so it
  picks up Frosted Lens automatically. **Note this:** the SongRow
  per-row instance does not currently have a halo
  ([SongRow.tsx:128-129](../../frontend/src/components/songs/SongRow.tsx#L128-L129));
  Commit 3 will give it one. Verify in acceptance that the row context
  doesn't get cluttered. If the SongRow per-row halo overpowers the
  row's hover overlay, the fix is the same PlayerBar-style
  contextual override on the SongTable container scope — *but* this
  spec recommends accepting the recipe as-is on first ship and
  surfacing if it's too loud, rather than pre-emptively adding a
  second scope override.

No Loud-tier buttons missed. Loud scope is complete with the five
named.

---

## 8. Sonnet stop conditions — priority order

These apply across the whole session, on top of per-commit stop
conditions in §6.

### 8.1 Halt immediately (do not continue, do not commit)

1. A token addition (Commit 1) collides with an existing `:root`
   declaration. Surface the collision and the existing declaration's
   line. Do not silently rename either.
2. The `destructive` variant addition (Commit 2) breaks any existing
   `<AlertDialog>` interaction (open, confirm, cancel, dismiss). The
   AlertDialog primitive is shared across the app; a regression here
   ripples.
3. Commit 3 produces a visual regression in a button **outside** the
   five Loud-tier targets — that is a recipe leak. Likely cause: a
   global selector somewhere reads a token added in Commit 1 with an
   unintended consumer.
4. The PlayerBar-scope override (Commit 1 + observed in Commit 3)
   does not actually scope — the play button's outer halo renders at
   full intensity in the bar. Do not patch with `!important`; debug
   the scope.
5. `@property` registration is reached for. Path B does not need
   animated CSS-custom-property colour transitions (those were
   AlbumArt-coupled). If a token starts to "need" `@property`, the
   recipe has drifted from the spec — halt and re-read this doc.
6. Build fails (`npm run build`) at the end of any commit. Investigate
   the failure root cause; do not skip the commit.

### 8.2 Surface to user (continue work, but raise it)

1. A button cannot be cleanly assigned to Loud / Quiet / Warning
   without judgment. The spec gives the loud-first scope; new
   buttons added since this spec was written might fall outside it.
2. A token default value (any of §5.1) reads visually too strong or
   too weak when finally consumed in Commit 3. Propose a tuned value;
   do not silently re-tune.
3. Mix Jam dual-colour `::before` reads muddy — fall back to single-
   colour teal backlight per §6 Commit 3 stop-condition #5.
4. The SongRow per-row play button's new halo competes with row
   hover overlay enough that a SongTable-scope override is warranted.
   Propose the override; do not ship pre-emptively.
5. Anything that contradicts this spec. The spec is wrong before
   ad-hoc invention is right.

### 8.3 Never do, in this session

1. **Touch the backend.** No migrations, no schema changes, no
   `dominant_color` column, no extraction, no Pillow / colorthief
   install. Path B is locked.
2. **Touch `AlbumArt.tsx` or `albumGradient.ts`.** Path B is locked.
3. **Modify `docs/design/button-system.md` or `docs/design-system.md`.**
   This spec extends them; conflicts get flagged in §11, not edited
   in source.
4. **Do chrome work:** sidebar nav, IconBtn dedup, dialog ghost
   restyle, FooterAction CSS migration, Edit-query pill CSS
   migration, playlist chip CSS migration, TagEditor button restyle.
   All deferred.
5. **Add `--aurora-album-bleed-*` tokens.** Even if the recipe
   "would benefit." Path B is locked.
6. **Add a `glowColor` prop to `AlbumArt`.** Path B is locked.
7. **Introduce a shared `.btn-loud` class.** §4.5 — defer to chrome
   session.
8. **Use `!important`** to force a token override or recipe rule.
   If the cascade isn't reaching, the rule is wrong — fix the rule,
   not the precedence.
9. **Add `will-change: filter` or `will-change: opacity`** anywhere.
   Per [design-system.md "Motion" §Rules](../design-system.md): the
   only `will-change` declared today is on PlayerBar height.
10. **Modify reduced-motion handling.** The global block in
    `index.css` already collapses transition-duration to 0.01ms;
    that covers everything in this spec. Do not add per-rule
    `prefers-reduced-motion` blocks.
11. **Skip pre-commit hooks** (`--no-verify`). If a hook fails,
    investigate.

---

## 9. Per-phase pre-flight checks

Sonnet runs these before staging each commit.

### Before Commit 1

- `git status` clean (no uncommitted work besides the staged token
  additions).
- Read [`index.css:56-145`](../../frontend/src/index.css#L56-L145)
  to confirm the `:root` block boundaries and surrounding context.
- Confirm none of the seven new token names collide with existing
  declarations: grep `--aurora-backlight-` and `--aurora-button-glow-`
  in `index.css` — both should return zero hits before this commit.

### Before Commit 2

- Read [`button.tsx:1-57`](../../frontend/src/components/ui/button.tsx#L1-L57)
  to confirm the variant union shape and the `variants` object structure.
- Read
  [`alert-dialog.tsx`](../../frontend/src/components/ui/alert-dialog.tsx)
  end-to-end to confirm whether `AlertDialogAction` accepts `asChild`
  or expects a className passthrough. The chosen pattern in Commit 2
  must match this primitive's API.
- Grep `bg-\[var\(--aurora-danger\)\]` across `frontend/src` to
  confirm only the two AlertDialogAction sites need migration.

### Before Commit 3

- Re-read §5 of this spec (the seven tokens are stable in scope; do
  not reach for tokens that aren't listed).
- Re-read §7 (loud-first scope) to confirm exactly five targets,
  not four, not six.
- Confirm Commit 1 is merged / staged and the seven tokens are
  available at `:root`.
- Read [`PlayerBar.tsx:154-170`](../../frontend/src/components/layout/PlayerBar.tsx#L154-L170)
  to confirm `.aurora-keyline-top` is applied at the bar root and
  scopes the children correctly.
- Run `npm run dev` and capture a baseline screenshot of: PlayerBar
  with a song playing, Mix page with results + float zone visible,
  a SongRow with hover state, a dialog with primary + cancel
  buttons. After Commit 3, the baseline screenshots are the diff
  reference.

---

## 10. Files Sonnet will read but not modify

- `docs/design/button-system.md` — exploration
- `docs/design-system.md` — token authority
- `docs/design/button-system-build-spec.md` — this spec
- `frontend/src/components/layout/PlayerBar.tsx` — read-only verification
- `frontend/src/components/songs/AlbumArt.tsx` — Path B locked
- `frontend/src/lib/albumGradient.ts` — Path B locked
- `frontend/src/components/ui/alert-dialog.tsx` — verify primitive API

---

## 11. Inferred vs. Explicit appendix

For every decision in this spec, this appendix records whether the
decision is codebase-supported (file:line) or this author's judgment.

### 11.1 Naming decisions

| Decision | Source | File:line |
|---|---|---|
| `icon-sm` is the locked size for h-7 w-7 | **Explicit** — already declared in code | [button.tsx:35](../../frontend/src/components/ui/button.tsx#L35); [SongRow.tsx:317](../../frontend/src/components/songs/SongRow.tsx#L317); [PlaylistDetail.tsx:697](../../frontend/src/components/playlists/PlaylistDetail.tsx#L697); [dialog.tsx:70-85](../../frontend/src/components/ui/dialog.tsx#L70-L85) |
| `destructive` is the variant name | **Explicit** — shadcn convention; design-system.md bridges `--destructive` → `--aurora-danger` | [design-system.md "Shadcn ↔ Aurora token bridge"](../design-system.md) |
| `--aurora-button-glow-rest/hover` token names | **Inferred** — follows the existing `--aurora-{family}-{state}` pattern. No identical name in code today, but the pattern is supported by `--aurora-accent-interactive-glow`, `--aurora-secondary-glow`, etc. | Author judgment, pattern-supported |
| `--aurora-button-glow-spread/-hover` token names | **Inferred** — matches the `-rest/-hover` pairing. | Author judgment |
| `--aurora-backlight-rest/hover/blur` token names | **Inferred** — same pattern as `-glow-*`. | Author judgment |
| Single `--aurora-backlight-blur` (12 px) instead of separate `-rest/-hover` blurs | **Inferred from spec** — Direction C state table only varies opacity at the loud tier, not blur, between rest and hover. Diverges from §8.3 which listed both. | [button-system.md §5 Direction C state table](./button-system.md) |
| Do not introduce a shared `.btn-loud` class this session | **Inferred** — judgment call. Each existing target carries bespoke sizing; a shared class can't hold all variants without restructuring JSX. | Author judgment |

### 11.2 Commit-ordering decisions

| Decision | Source |
|---|---|
| Tokens land first (Commit 1) | **Structural** — pure-additive declarations cannot regress; consumers in 2/3 then land with no race. |
| `destructive` variant lands before Frosted Lens recipe (Commit 2 before 3) | **Structural** — independent diffs; ordering keeps Commit 3's diff focused. |
| Loud-tier recipe ships as one commit, not five per-target (Commit 3) | **Inferred** — preference for one consistent recipe over five intermediate states with mixed dialects on the same page. Author judgment. |
| Dropped: JS-hover migration commit | **Structural** — none of the five Loud-tier targets use JS hover; the migration has no consumer in this session. |
| Dropped: IconBtn dedup commit | **Structural** — no IconBtn is in the Loud-tier scope; dedup needs `destructive-ghost` (chrome-tier) to cleanly handle the danger IconBtns; partial dedup leaves both private definitions in place anyway. |

### 11.3 Token list — kept, dropped, re-justified

| Item | Disposition | Source |
|---|---|---|
| `--aurora-backlight-rest`, `-hover`, `-blur` | **Kept** | Direction C consumer; not AlbumArt-coupled. |
| `--aurora-button-glow-rest`, `-hover`, `-spread`, `-spread-hover` | **Kept and re-justified** under Path B | Original justification was "respect deliberate album-tinted bleed"; new justification is "preserve emergent atmospheric character of existing AlbumArt boxShadow that the user has chosen not to engineer." Same mechanism, reframed. See §3 of this spec. |
| `--aurora-album-bleed-color` | **Dropped** — Path B locked | §7.6 of exploration |
| `--aurora-album-bleed-radius` | **Dropped** — Path B locked | §7.6 |
| `--aurora-album-bleed-opacity` | **Dropped** — Path B locked | §7.6 |
| `AlbumArt` prop `glowColor?: string` | **Dropped** — Path B locked | §7.6 |
| `Song.dominant_color?: string \| null` (frontend type + backend column) | **Dropped** — Path B locked | §7.6 |
| `@property --aurora-album-bleed-color` registration | **Dropped** — Path B locked | §7.6 |
| `Button` size `xs-icon` (or rename `icon-sm`) | **Resolved by code** — `icon-sm` already exists | [button.tsx:35](../../frontend/src/components/ui/button.tsx#L35) |
| `Button` variant `destructive` | **Kept** — landed in Commit 2 | §5.3 |
| Move `IconBtn` into base `Button` | **Deferred** — chrome session | §5.5 |
| Migrate JS hover handlers (FooterAction, Edit-query pill, playlist chips) | **Deferred** — chrome session | §5.5 |

### 11.4 §7.3 PlayerBar-scope override — keep or drop?

| Original justification | Path-B justification | Decision |
|---|---|---|
| "Don't fight AlbumArt's deliberate album-tinted bleed" — assumed Path A (extraction). | "Preserve the emergent atmospheric character of the existing AlbumArt boxShadow that the user has explicitly chosen not to engineer." Same mechanism (cool-family procedural glow + album-image leakage through blur), reframed motivation (emergent rather than deliberate). | **Keep.** The override's *function* (dim outer halo, leave backlight) is unchanged; only the *reason* is rewritten. |

This is the only item in the exploration that changed motivation
without changing implementation.

### 11.5 Loud-first scope completeness

| Decision | Source |
|---|---|
| Five targets, including both inline and float Mix Jam | **Inferred** — user's "Mix Jam" was ambiguous. Author chose to include both because they share Identity role; a session that ships only inline Jam leaves a worse intermediate visual state. **Surfaced for user confirmation in §7.** |
| SongRow per-row play button picks up the recipe automatically | **Explicit** — it consumes `.aurora-play-btn` directly | [SongRow.tsx:120-129](../../frontend/src/components/songs/SongRow.tsx#L120-L129) |
| Dialog primary buttons (Save/Done/Scan) pick up the recipe automatically | **Explicit** — they use base `Button variant="primary"` | [EditSongDialog.tsx:186-189](../../frontend/src/components/songs/EditSongDialog.tsx#L186-L189), [AddSongDialog.tsx:158-167](../../frontend/src/components/songs/AddSongDialog.tsx#L158-L167), and four other call-sites referenced in [button-system.md §3.20](./button-system.md) |

---

## 12. Stop conditions for THIS spec session — review

The spec-authoring session's own stop conditions, restated for
self-audit:

| Stop condition | Tripped? |
|---|---|
| `button-system.md` missing §8.3/§7.6 | No — both present and read |
| Base Button component not where expected and not findable | No — `frontend/src/components/ui/button.tsx` exists and was read |
| Existing button conventions are inconsistent enough that "fits the pattern" itself is ambiguous | No — variant naming follows shadcn; size naming is internally consistent (`default | sm | lg | icon | icon-sm`). |
| `§7.3` or `§7.6` has AlbumArt-coupled items beyond what was identified | No — the AlbumArt-coupled items are exactly the six listed in §5.4. |

No surfaces blocked the spec.

---

## 13. Final report

**Build-spec path:** [`docs/design/button-system-build-spec.md`](./button-system-build-spec.md)

**Total commits proposed:** 3 (diverged from the 5-commit working
hypothesis — see §6 and §11.2).

**Naming decisions in one line each:**
- Button h-7 w-7 size: `icon-sm` (already in code; rename question moot).
- Filled destructive variant: `destructive`.
- Backlight tokens: `--aurora-backlight-rest`, `--aurora-backlight-hover`, `--aurora-backlight-blur` (single blur, not two).
- Outer-halo tokens: `--aurora-button-glow-rest`, `--aurora-button-glow-hover`, `--aurora-button-glow-spread`, `--aurora-button-glow-spread-hover`.
- Recipe class: none introduced this session — recipe is grafted onto existing per-target classes.

**Top three inferred-vs-explicit items the user should scrutinise:**

1. **Mix Jam scope (§7).** This spec includes both the inline
   `.mix-jam-primary` and the float-zone `.mix-float-jam` under Loud-
   first. The user said only "Mix Jam." If the user wants the float
   variant deferred, halve Commit 3.

2. **Single `--aurora-backlight-blur` token instead of separate
   `-rest/-hover` blurs (§4.4, §11.1).** This diverges from the
   exploration's §8.3 which listed both. Direction C only varies
   opacity (not blur) between rest and hover at the Loud tier, so
   the second blur token would never be consumed in this session.
   If the user expects the chrome session to want a different Quiet-
   tier blur, that token is straightforward to add then.

3. **§7.3 PlayerBar-scope override re-justification (§3, §11.4).**
   The override survives Path B with a rewritten motivation
   ("preserve emergent atmosphere") rather than the original
   ("respect deliberate album-tinted source"). The function is
   unchanged. If the user reads the new justification as too thin —
   i.e., the play button at full halo would actually look fine
   against an unmodified AlbumArt — the override can drop and the
   spec collapses to seven tokens at `:root` with no override block.
