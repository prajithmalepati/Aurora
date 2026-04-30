# Aurora Button System — Design Exploration

> Draft · 2026-04-28 · Read-only design exploration
>
> **Status:** Proposal. No code has been written. A future Sonnet session
> builds from the chosen direction.
>
> **Constraint envelope:** [`docs/design-system.md`](../design-system.md)
> v2 is law. This document extends it; it does not revise it. Any new
> token surfaced here is flagged as a proposal pending user approval.
>
> **Scope:** A unified visual language for every button-shaped affordance
> in Aurora — primary actions, transport controls, sidebar nav, dialog
> actions, row icon buttons, chips, destructive confirms.

---

## 1. Pre-flight summary

| Check | Status |
|---|---|
| `docs/design-system.md` v2 readable, contains v2 token tables | ✓ Yes |
| `graphify-out/graph.json` non-empty | ✓ Yes (43 communities, 460 nodes) |
| `graphify-out/GRAPH_REPORT.md` reviewed | ✓ Yes — graph is backend-heavy; frontend visual layer is thinly extracted, so direct file reads were the primary inventory method. |
| ui-ux-pro-max (`scripts/search.py`) queryable | ✓ Yes — but returned style-level cards (Glassmorphism, Claymorphism, etc.), not specific backlight-button recipes. Useful for general glass guidance; primary technique source remains the layered pseudo-element pattern named in the brief. |
| caveman skill active | Yes (full). Doc body is full prose; caveman applies only to chat narration. |

No stop conditions tripped. Inventory was completed for every requested
button location. See §3.

---

## 2. The problem in one sentence

Aurora's buttons today do not share one light language: the play button
uses a 135° aurora gradient that reads left-heavy and teal-dominant; the
Mix Jam buttons use a teal→violet gradient with dual-color outer halos;
the base `Button` "primary" variant uses the same gradient as the play
button but with a different (smaller, vivid-teal-only) halo; sidebar nav
items use a 3px left-bar accent over a translucent surface fill;
`IconBtn` is a flat ghost with no light at all and exists in two
duplicated copies; dialog action buttons fall back to base `Button`
variants; destructive actions are styled by `className` override on
`AlertDialogAction`. Six visual dialects, no shared recipe for "where
does the light come from."

The user's request is that every button read as **one family**: a
frosted glass surface with colored light *behind* it, like a lens with
an LED inside.

---

## 3. Inventory of existing buttons

Each entry: location · file:line · current treatment · category.

### 3.1 Base `Button` component
[`button.tsx:14-41`](../../frontend/src/components/ui/button.tsx#L14-L41) —
Five variants (`default` / `primary` / `secondary` / `ghost` / `outline`)
and five sizes. `primary` applies `var(--aurora-gradient)` as the
background plus a vivid-teal outer halo; all other variants use
white-on-glass fills with rim shadows. State coverage is complete:
`hover`, `active:scale-[0.97]`, `aurora-focus`, `disabled:opacity-40`.

### 3.2 PlayerBar transport — play / pause
[`PlayerBar.tsx:122-136`](../../frontend/src/components/layout/PlayerBar.tsx#L122-L136)
(mobile) and
[`PlayerBar.tsx:221-237`](../../frontend/src/components/layout/PlayerBar.tsx#L221-L237)
(desktop) — Class is `.aurora-play-btn` plus `.aurora-btn-press`. The
CSS recipe is at
[`index.css:512-518`](../../frontend/src/index.css#L512-L518): a raw
`var(--aurora-gradient)` background, hover `filter: brightness(1.12)`,
plus an inline `boxShadow` of
`0 0 24px -6px var(--aurora-accent-interactive-glow)` (teal-only halo).
Disabled is tier 1 (`opacity-25 + pointer-events-none`).

**This is the most visible button in the app.** The 135° gradient
places teal (`#5eead4`) near the top-left and violet (`#a78bfa`) near
the bottom-right of the disc. On a small (40–44 px) circle, the teal
biased-toward-top-left reads as the dominant tone; the violet only
appears in the outermost ~25 % of the bottom-right.

### 3.3 PlayerBar transport — skip prev / next, mute toggle
[`PlayerBar.tsx:114-121, 137-144, 209-219, 239-246, 283-293`](../../frontend/src/components/layout/PlayerBar.tsx#L114-L121) —
Plain `<button>` with text-color icons. Hover swaps
`text-secondary → text` (150 ms). Disabled is tier 1
(`opacity-25 + pointer-events-none`). No fill, no border, no halo. They
read as pure chrome.

### 3.4 Sidebar nav items
[`Sidebar.tsx:207-250`](../../frontend/src/components/layout/Sidebar.tsx#L207-L250) —
A custom `NavItem` (does not use base `Button`). Active state: 3 px
left bar at `--aurora-accent-interactive` with a teal glow plus
`--aurora-surface` background fill. Hover: `--aurora-surface-hover`
overlay fades in (200 ms). Text colour transitions
secondary → primary.

### 3.5 Sidebar tag items
[`Sidebar.tsx:279-305`](../../frontend/src/components/layout/Sidebar.tsx#L279-L305) —
Custom `TagSidebarItem`. Same hover-overlay technique as nav, smaller
padding, 4 px dot at `--aurora-muted`. Counts dim → secondary on
parent hover.

### 3.6 Sidebar footer actions ("New Playlist", "Scan Folder", "Add Song")
[`Sidebar.tsx:258-271`](../../frontend/src/components/layout/Sidebar.tsx#L258-L271) —
Custom `FooterAction`. Background is set via inline
`onMouseEnter`/`onMouseLeave` JS handlers rather than CSS `:hover`. This
is a small drift from the rest of the app's CSS-first hover convention.

### 3.7 SongRow row-hover play button (the small circular one)
[`SongRow.tsx:120-129`](../../frontend/src/components/songs/SongRow.tsx#L120-L129) —
Reuses class `.aurora-play-btn` (same gradient as PlayerBar) but with
`text-white` icon (vs. `text-[#050608]`) and no halo. 40 px circle,
fades in on row hover with `hover:scale-105`.

### 3.8 SongRow icon buttons (Edit tags, Edit song, Delete)
[`SongRow.tsx:233-261, 311-326`](../../frontend/src/components/songs/SongRow.tsx#L233-L261) —
Local `IconBtn` component. `aurora-focus h-7 w-7 rounded-md`. Default
hover: text-tertiary → text, bg `white/[0.04]`. `danger` variant: hover
text → `--aurora-danger`, bg `danger/10`. 150 ms transition.

### 3.9 PlaylistDetail icon buttons (Move up, Move down, Remove)
[`PlaylistDetail.tsx:646-675, 690-706`](../../frontend/src/components/playlists/PlaylistDetail.tsx#L690-L706) —
**A duplicated copy of the same `IconBtn`**, with the addition of a
`disabled:opacity-25` rule (tier 1). This duplication is itself a
symptom of the missing system.

### 3.10 PlaylistDetail hero pencil / trash buttons
[`PlaylistDetail.tsx:309-327`](../../frontend/src/components/playlists/PlaylistDetail.tsx#L309-L327) —
Inline `<button>`, **not** using `IconBtn`. `h-9 w-9` (vs. row IconBtn
`h-7 w-7`). The trash uses the danger-on-hover recipe; the pencil uses
the default ghost recipe. So a third visual dialect for the same
icon-button pattern.

### 3.11 QueryBuilder Search button
[`QueryBuilder.tsx:132-139`](../../frontend/src/components/filter/QueryBuilder.tsx#L132-L139) —
Class `.mix-btn-search` ([`index.css:696-705`](../../frontend/src/index.css#L696-L705)).
Solid `--aurora-accent-interactive` fill with dark slate text, teal-only
small halo. Disabled tier 3 (`opacity-[0.55]`).

### 3.12 QueryBuilder Shuffle button
[`QueryBuilder.tsx:140-152`](../../frontend/src/components/filter/QueryBuilder.tsx#L140-L152) —
Round 32 px ghost icon button, surface fill + rim shadow, no halo.
Disabled tier 3.

### 3.13 QueryBuilder Clear button
[`QueryBuilder.tsx:153-159`](../../frontend/src/components/filter/QueryBuilder.tsx#L153-L159) —
Plain text-only, no fill. Tertiary → secondary text on hover.

### 3.14 QueryBuilder Edit query pill
[`QueryBuilder.tsx:83-103`](../../frontend/src/components/filter/QueryBuilder.tsx#L83-L103) —
Inline-styled pill with JS `onMouseEnter`/`Leave` handlers swapping
background and color tokens. Same drift as §3.6.

### 3.15 QueryBuilder operator keys ("AND", "OR", "NOT", parentheses)
[`QueryBuilder.tsx:198-204`](../../frontend/src/components/filter/QueryBuilder.tsx#L198-L204) —
Class `.mix-kbd` ([`index.css:662-693`](../../frontend/src/index.css#L662-L693)).
Keyboard-key style: surface fill, 1 px white border, monospace 10 px,
press translates 1 px down. Has its own focus-visible recipe (raw
`outline` rather than `aurora-focus`).

### 3.16 QueryBuilder tag chips
[`QueryBuilder.tsx:177-186`](../../frontend/src/components/filter/QueryBuilder.tsx#L177-L186) —
Class `.aurora-chip`. Translucent surface fill, rim border, 11 px
medium text.

### 3.17 QueryBuilder playlist chips
[`QueryBuilder.tsx:219-247`](../../frontend/src/components/filter/QueryBuilder.tsx#L219-L247) —
Custom inline `<button>` with **per-playlist colour** (raw hex) applied
through inline JS event handlers. Not a token-based recipe.

### 3.18 Mix inline Jam button
[`QueryBuilder.tsx:262-269`](../../frontend/src/components/filter/QueryBuilder.tsx#L262-L269) —
Class `.mix-jam-primary` ([`index.css:808-834`](../../frontend/src/index.css#L808-L834)).
Pill, 50 px tall, teal→violet 135° linear gradient fill, dual-glow halo
(teal + violet). Disabled tier 3.

### 3.19 Mix float-zone Search and Jam
[`QueryBuilder.tsx:317-332`](../../frontend/src/components/filter/QueryBuilder.tsx#L317-L332) —
`.mix-float-search` (transparent ghost, color-only hover) and
`.mix-float-jam` (smaller pill, single-glow → dual-glow on hover).
Disabled tier 3.

### 3.20 Dialog action buttons (Save / Cancel / Done / Scan)
[`EditSongDialog.tsx:186-189`](../../frontend/src/components/songs/EditSongDialog.tsx#L186-L189),
[`AddSongDialog.tsx:158-167`](../../frontend/src/components/songs/AddSongDialog.tsx#L158-L167),
[`CreatePlaylistDialog.tsx:175-182`](../../frontend/src/components/playlists/CreatePlaylistDialog.tsx#L175-L182),
[`ScanDialog.tsx:202-226`](../../frontend/src/components/scanner/ScanDialog.tsx#L202-L226),
[`PlaylistDetail.tsx:476-487`](../../frontend/src/components/playlists/PlaylistDetail.tsx#L476-L487) —
All use base `<Button variant="ghost" />` for cancel and
`<Button variant="primary" />` for confirm. So this category is the
only one that already converges on the base component.

### 3.21 AlertDialog destructive action
[`SongRow.tsx:277-282`](../../frontend/src/components/songs/SongRow.tsx#L277-L282),
[`PlaylistDetail.tsx:505-510`](../../frontend/src/components/playlists/PlaylistDetail.tsx#L505-L510) —
`<AlertDialogAction>` (a thin wrapper over base `Button`) overridden
with `className="bg-[var(--aurora-danger)] text-black hover:bg-[var(--aurora-danger)]/90"`.
Bypasses the variant system. There is no `destructive` variant on
`Button`.

### 3.22 TagEditor tag-suggestion buttons and chip-X buttons
[`TagEditor.tsx:94-99`](../../frontend/src/components/tags/TagEditor.tsx#L94-L99) (chip remove),
[`TagEditor.tsx:132-143`](../../frontend/src/components/tags/TagEditor.tsx#L132-L143) (suggestion row) —
Plain `<button>` with ghost-row hover recipe. Two more local dialects.

### 3.23 Dialog close button
[`dialog.tsx:70-85`](../../frontend/src/components/ui/dialog.tsx#L70-L85) —
Renders `<Button variant="ghost" size="icon-sm" />`. Already on the
base component.

### Categorisation map

| Category | Examples | Current count of dialects |
|---|---|---|
| **Identity / primary action** | base Button "primary", play button, Mix Search, Mix Jam (inline + float) | 4 |
| **Secondary glass** | base Button "default" / "secondary" / "outline" / "ghost", Edit query pill, Shuffle, dialog Cancel | 3 |
| **Destructive** | AlertDialog action override, IconBtn danger | 2 |
| **Neutral nav / sidebar surface** | NavItem, TagSidebarItem, FooterAction, TagEditor suggestion row, Clear text button | 4 |
| **Icon-only row action** | SongRow IconBtn, PlaylistDetail IconBtn (duplicate), hero pencil/trash | 3 |
| **Transport (no fill)** | PlayerBar skip / prev / next / mute | 1 |
| **Chips and keys** | aurora-chip, mix-kbd, playlist chip | 3 (chip is the closest to coherent) |

**Stop condition #2** (is this just a play-button issue?): No. The play
button is the loudest offender, but the seven categories above run on
roughly seventeen different visual recipes. Even if the play button
were fixed in isolation, the rest of the app would still not feel like
one family. A system response is justified — though the **scope** of
what to migrate first is a legitimate user choice (see §6
recommendation).

**Stop condition #3** (do categories map to 2-3 directions?): Yes. Every
direction below specifies a recipe for each of the seven categories.
The directions differ in *where the light lives*, not in *which
buttons get it*.

---

## 4. Decisions taken in this doc

These are the four cross-cutting choices the directions inherit. Where
the user explicitly deferred to my reasoning, I chose; where I am
genuinely uncertain, I split into directions.

### 4.1 Light **colour** strategy: uniform aurora, with one exception

Aurora's design-system.md Principle 2 states "Aurora gradient is meaning,
not decoration. Gradient marks a thing that is speaking." A second
semantic light layer (go-light for play, warning for destructive,
aurora for neutral) would compete with that principle and require new
tokens that have no defensible role outside the button system.

**Decision:** All affirmative / identity-bearing buttons use the same
colour family — `--aurora-accent-interactive` (smoked teal) at rest,
escalating to a teal+violet pair on hover. The single exception is
**destructive**, which uses `--aurora-danger`. Destructive is the only
case where a non-aurora colour has a defensible role (it carries a
warning, not identity).

This is a 2-tone system, not a 4-tone semantic system. It respects P2.

### 4.2 Light **intensity** behaviour: tiered, not binary

The user's stated lean is cozy/lived-in (always-on at low ambience).
Universal always-on creates light pollution on dim chrome. Universal
hover-up loses the lived-in feel.

**Decision:** Three intensity tiers, applied per category:

| Tier | Behaviour | Categories |
|---|---|---|
| **Loud** | Always-on at low ambience; brightens on hover | Play button, primary action (Submit, Save, Jam, Search, Done) |
| **Quiet** | Off at rest; lights up on hover | Secondary glass, neutral nav, sidebar items, icon-only row actions |
| **Warning** | Off at rest; lights up on hover; uses `--aurora-danger` instead of aurora colour | Destructive (Delete buttons, AlertDialog actions, trash IconBtn) |

This preserves the lived-in feel where it belongs (the buttons that
*are* the app) and keeps the chrome quiet.

### 4.3 Light **placement**: this is the direction differentiator

Three meaningfully different answers; see §5.

### 4.4 State system: shared across all directions

Every direction inherits these from design-system.md v2 unchanged:

- **Hover** colour change at 150 ms `ease`, surface change at 150 ms.
- **Active** `transform: scale(0.97)` over 100 ms via `.aurora-btn-press`.
- **Focus** `.aurora-focus` (vivid teal at /70, ring offset 2 against
  `--aurora-surface-0`).
- **Disabled** three-tier opacity (0.25 / 0.40 / 0.55) chosen by
  category, plus `pointer-events: none`.
- **Reduced motion** all halo and backlight transitions collapse to
  ~0 ms; static colour and rim treatment remain so the button still
  reads as interactive.

### 4.5 Transport glyphs stay filled, not stroked

Per design-system.md iconography rule, Play/Pause/SkipBack/SkipForward
are `fill="currentColor"` with `strokeWidth={0}`. All directions keep
this; the play button glyph is a solid black silhouette (`#050608`,
on-gradient text token) regardless of which direction we pick.

---

## 5. Three directions

Each direction is named, summarised, then specified as: **showcase
(play button)** + **quieter dialect (one other button)** + **state
table** + **reduced-motion fallback** + **token usage** + **tradeoffs**
+ **performance note**.

---

### Direction A — **Lantern**

> *Light only behind the button.*

**Vibe summary.** The button is a frosted glass disc with a coloured
light source sitting behind it. The disc itself is near-transparent on
black; the light bleeds out around the edge as a soft, low-saturation
halo, and the disc top-rim catches a thin white keyline. On hover the
light brightens and grows. The sense is of a porthole over an aurora —
the aurora is *behind*, the glass is in front. Primary buttons feel
inhabited; chrome buttons are dark glass with no LED until hover.

**Showcase: play button.** A 44 × 44 circle, `border-radius: 999px`.

```css
/* sketch — DO NOT TREAT AS DROP-IN; future Sonnet will adapt */
.btn-loud {
  position: relative;
  isolation: isolate;
  background: rgba(255, 255, 255, 0.04);          /* glass surface */
  box-shadow: inset 0 0 0 1px var(--aurora-rim);
  color: var(--aurora-slate);
  transition:
    background 150ms ease,
    box-shadow 200ms ease;
}
.btn-loud::before {
  /* the light source — sits behind, smaller than the button so the
     glow bleeds past the edge */
  content: "";
  position: absolute;
  inset: -8px;                                    /* extends beyond edge */
  z-index: -1;
  border-radius: inherit;
  background: radial-gradient(
    closest-side,
    var(--aurora-accent-interactive) 0%,
    var(--aurora-accent-interactive-glow) 55%,
    transparent 100%
  );
  filter: blur(14px);
  opacity: 0.55;                                  /* always-on ambience */
  transition: opacity 200ms ease, filter 200ms ease;
}
.btn-loud:hover::before {
  opacity: 0.85;
  filter: blur(16px);
}
.btn-loud:active {
  transform: scale(0.97);
  transition: transform 100ms ease;
}
```

The glass disc itself is *uniformly* coloured — no asymmetric gradient.
The light comes from behind. The previous "left-heavy" reading of the
play button disappears because there is no internal gradient axis to
read. Identity is carried by the light, not by the surface.

**Quieter dialect: dialog Cancel button.** Same recipe, but the `::before`
ambience opacity drops to `0`; light only appears on hover.

```css
.btn-quiet {
  /* same surface as .btn-loud */
}
.btn-quiet::before { opacity: 0; }
.btn-quiet:hover::before { opacity: 0.45; filter: blur(12px); }
```

Sidebar nav uses `.btn-quiet`; the active state replaces the `::before`
ambience with `opacity: 0.4` and keeps the existing 3 px left-bar
indicator on top.

**State table.**

| State | Surface | `::before` halo | Rim | Notes |
|---|---|---|---|---|
| Rest (Loud) | `rgba(255,255,255,0.04)` | opacity 0.55, blur 14 px | `--aurora-rim` |  |
| Hover (Loud) | `rgba(255,255,255,0.06)` | opacity 0.85, blur 16 px | `--aurora-rim-bright` |  |
| Rest (Quiet) | `rgba(255,255,255,0.025)` | opacity 0 | `--aurora-rim` |  |
| Hover (Quiet) | `rgba(255,255,255,0.04)` | opacity 0.45, blur 12 px | `--aurora-rim-bright` |  |
| Hover (Warning) | `rgba(248,113,113,0.06)` | opacity 0.45, blur 12 px, **danger** colour | rgba(248,113,113,0.4) |  |
| Active | scale(0.97) | unchanged | unchanged | Same `.aurora-btn-press` |
| Focus | unchanged | unchanged | + `.aurora-focus` ring | Vivid teal /70 |
| Disabled (tier 1: text-only) | n/a | n/a | n/a | opacity 0.25 |
| Disabled (tier 2: filled) | unchanged | opacity 0 | unchanged | opacity 0.40 |
| Disabled (tier 3: secondary) | unchanged | opacity 0 | unchanged | opacity 0.55 |

**Reduced-motion fallback.** `::before` snaps to its target opacity in
~0 ms instead of fading. The light still appears (it is colour-coded
state, not motion-coded), just without animation. No infinite loops
were introduced.

**Token usage (verified in design-system.md unless flagged).**

- `--aurora-accent-interactive` ✓
- `--aurora-accent-interactive-glow` ✓
- `--aurora-rim`, `--aurora-rim-bright` ✓
- `--aurora-slate` ✓ (text on light source)
- `--aurora-danger` ✓ (warning tier)
- `--aurora-surface-0` ✓ (focus offset)
- `--aurora-accent-vivid` ✓ (focus ring inside `.aurora-focus`)

**Proposed extensions (require user approval before build).**

- `--aurora-backlight-rest: 0.55` — opacity scalar, loud-tier rest.
- `--aurora-backlight-hover: 0.85` — opacity scalar, loud-tier hover.
- `--aurora-backlight-blur-rest: 14px` and `--aurora-backlight-blur-hover: 16px`.

These are **opacity / length scalars, not new colours.** They exist so
the recipe can be tuned in one place.

**Tradeoffs.**

- ✓ Best fit for the user's stated mental model ("frosted lens with LED inside").
- ✓ Eliminates the play button's left-heavy gradient problem entirely.
- ✓ Pseudo-element technique scales cleanly: every category gets the
  same recipe, with intensity tier as the only knob.
- ✗ Backlight bleed past the edge consumes ~8 px of layout space. Tight
  toolbars (Mix header) need to be re-checked for overlap.
- ✗ Removes the gradient from the play button surface itself. The
  signature aurora gradient now appears only on the wordmark, the
  currently-playing title, and the Mix Jam button — narrower
  application than today. Some may read this as the play button
  becoming "less special."
- ✗ Inline JS hover handlers (`FooterAction`, `Edit query`, playlist
  chips) cannot use `::before` on hover; they would need migrating to
  CSS.

**Performance note.** Each backlight is one extra `position: absolute`
pseudo-element with `filter: blur()`. `filter: blur()` is GPU-rendered
in modern Chromium / WebKit / Firefox. Aurora has at most ~25 buttons
visible at once (Mix page, full song table); 25 blurred pseudo-elements
is well under the threshold where the browser composites unhappily.
**Do not** add `will-change: filter` — `will-change` should only
apply where layout-cost transitions justify it (per design-system.md
§Motion). Watch for Mac Safari's lower-tier filter performance; the
fallback is to drop the blur and rely on a smaller, sharper radial
without blur, which still reads as backlight.

---

### Direction B — **Aurora Halo**

> *Light only around the button.*

**Vibe summary.** The button is an opaque (or near-opaque) glass disc
with a strong outer `box-shadow` halo. The light lives in the air
*around* the button, not behind it. This is the most conservative
direction — it formalises what Aurora already does in `.mix-jam-primary`
and `.aurora-play-btn` and extends that recipe consistently across
every category. No pseudo-elements; the light is purely a box-shadow.
Primary buttons get a dual-color teal+violet halo at rest; quieter
buttons get no halo until hover.

**Showcase: play button.** A 44 × 44 circle.

```css
.btn-loud {
  position: relative;
  background: var(--aurora-accent-interactive);   /* solid muted teal */
  color: var(--aurora-slate);
  box-shadow:
    inset 0 0 0 1px var(--aurora-rim-bright),     /* keyline */
    0 0 22px -6px var(--aurora-accent-interactive-glow),
    0 0 22px -6px var(--aurora-secondary-glow);   /* dual-color halo */
  transition: box-shadow 200ms ease, background 150ms ease;
}
.btn-loud:hover {
  background: var(--aurora-accent-interactive-hover);
  box-shadow:
    inset 0 0 0 1px var(--aurora-rim-bright),
    0 0 32px -4px var(--aurora-accent-interactive-glow),
    0 0 32px -4px var(--aurora-secondary-glow);
}
```

Notably this **drops** the aurora gradient from the play button surface.
The play button becomes a flat smoked-teal disc with a teal+violet
halo. The user's "left-heavy" complaint goes away because the surface
is uniform; the violet enters as the second layer of the halo, not as
a built-in gradient stop.

**Quieter dialect: sidebar nav item.** No halo at rest; on hover, a thin
single-colour halo + the existing `--aurora-surface-hover` overlay.

```css
.btn-quiet { box-shadow: inset 0 0 0 1px var(--aurora-rim); }
.btn-quiet:hover {
  background: var(--aurora-surface-hover);
  box-shadow:
    inset 0 0 0 1px var(--aurora-rim-bright),
    0 0 16px -8px var(--aurora-accent-interactive-glow);
}
```

**State table.**

| State | Surface | Halo | Rim |
|---|---|---|---|
| Rest (Loud) | `--aurora-accent-interactive` | dual-color, 22 px | `--aurora-rim-bright` |
| Hover (Loud) | `--aurora-accent-interactive-hover` | dual-color, 32 px | `--aurora-rim-bright` |
| Rest (Quiet) | `rgba(255,255,255,0.025)` | none | `--aurora-rim` |
| Hover (Quiet) | `--aurora-surface-hover` | single-color, 16 px | `--aurora-rim-bright` |
| Hover (Warning) | `rgba(248,113,113,0.06)` | single-color, 16 px, danger glow | rgba(248,113,113,0.4) |
| Active | scale(0.97) | unchanged | unchanged |
| Focus | unchanged | unchanged | + `.aurora-focus` |
| Disabled | per tier | suppressed (opacity inherits) | unchanged |

**Reduced-motion fallback.** Halo collapses to its hover target in ~0 ms
instead of fading. Static colour state retained.

**Token usage.** All verified — `--aurora-accent-interactive`,
`-interactive-hover`, `-interactive-glow`, `-secondary-glow`,
`--aurora-rim`, `--aurora-rim-bright`, `--aurora-slate`, `--aurora-danger`.

**Proposed extensions.** None. **Direction B can be built without
adding a single new token.** This is its strongest argument.

**Tradeoffs.**

- ✓ Zero new tokens. Smallest extension to design-system.md.
- ✓ Builds on a recipe Aurora already validated (`.mix-jam-primary`,
  `.mix-btn-search`).
- ✓ Best performance — `box-shadow` is cheap; no `filter: blur()`.
- ✗ Furthest from the user's stated mental model. The light is
  *around* the button, not *behind* it. "Frosted lens with an LED
  inside" → not really; this is more "neon disc."
- ✗ Box-shadow halos are hard to scale to icon-only buttons (`h-7 w-7`
  IconBtn) without overpowering the row. The quietest tier may have
  to drop the halo entirely on row icon buttons, opening a small
  category-coverage hole.
- ✗ Drops the gradient from the play button. Same caveat as A.

**Performance note.** Best-in-class. `box-shadow` is paint-only; no
GPU compositing concerns. Even 50 visible haloed buttons would be fine.

---

### Direction C — **Frosted Lens**

> *Light both behind and around the button.*

**Vibe summary.** The button is a frosted glass disc, with a coloured
backlight bloom *behind* (Lantern's `::before` recipe) **and** a softer
outer halo of the same colour wrapping past the edge into the
surrounding atmosphere (Halo's `box-shadow`). The disc itself catches
a thin white keyline at the top, picking up the "lens" reading. The
combination resolves the user's exact phrasing: "frosted lens with an
LED inside" — the LED is the backlight, the lens is the glass, and a
faint diffusion blooms outside. On a black OLED ground, the dual-layer
light reads as the most physically grounded of the three.

**Showcase: play button.**

```css
.btn-loud {
  position: relative;
  isolation: isolate;
  background: rgba(255, 255, 255, 0.04);
  color: var(--aurora-slate);
  box-shadow:
    inset 0 0 0 1px var(--aurora-rim-bright),
    0 0 28px -10px var(--aurora-accent-interactive-glow); /* outer diffusion */
  transition:
    background 150ms ease,
    box-shadow 200ms ease;
}
.btn-loud::before {
  content: "";
  position: absolute;
  inset: -6px;
  z-index: -1;
  border-radius: inherit;
  background: radial-gradient(
    closest-side,
    var(--aurora-accent-interactive) 0%,
    var(--aurora-accent-interactive-glow) 55%,
    transparent 100%
  );
  filter: blur(12px);
  opacity: 0.65;
  transition: opacity 200ms ease;
}
.btn-loud:hover {
  background: rgba(255, 255, 255, 0.06);
  box-shadow:
    inset 0 0 0 1px var(--aurora-rim-bright),
    0 0 36px -6px var(--aurora-accent-interactive-glow);
}
.btn-loud:hover::before { opacity: 0.9; }
```

The disc surface is uniform (no gradient), so the play button no longer
reads left-heavy. The backlight gives it identity at rest; the outer
diffusion makes it sit in the atmosphere instead of *on* the screen.

**Quieter dialect: dialog Cancel.** Same surface as `.btn-loud`, but the
`::before` is `opacity: 0` at rest and the outer halo is dropped. On
hover the `::before` lifts to `0.5` and a much smaller outer halo
appears.

**State table.**

| State | Surface | `::before` (backlight) | `box-shadow` (outer halo) | Rim |
|---|---|---|---|---|
| Rest (Loud) | `rgba(255,255,255,0.04)` | 0.65 opacity, 12 px blur | `0 0 28px -10px ...glow` | `--aurora-rim-bright` |
| Hover (Loud) | `rgba(255,255,255,0.06)` | 0.9 | `0 0 36px -6px ...glow` | `--aurora-rim-bright` |
| Rest (Quiet) | `rgba(255,255,255,0.025)` | 0 | none | `--aurora-rim` |
| Hover (Quiet) | `rgba(255,255,255,0.04)` | 0.5, 10 px blur | `0 0 18px -10px ...glow` | `--aurora-rim-bright` |
| Hover (Warning) | `rgba(248,113,113,0.05)` | 0.5, danger colour | `0 0 18px -10px rgba(248,113,113,0.35)` | rgba(248,113,113,0.4) |
| Active | scale(0.97) | unchanged | unchanged | unchanged |
| Focus | unchanged | unchanged | unchanged | + `.aurora-focus` |
| Disabled | per tier | 0 | suppressed | unchanged |

**Reduced-motion fallback.** Both `::before` and `box-shadow` snap to
target. No infinite ambient loop is introduced (no pulsing). The
buttons remain readable as buttons because the rim and surface tokens
provide static affordance.

**Token usage.** All verified —
`--aurora-accent-interactive`,
`--aurora-accent-interactive-glow`,
`--aurora-rim`, `--aurora-rim-bright`,
`--aurora-slate`, `--aurora-danger`.

**Proposed extensions.** Same scalars as Direction A
(`--aurora-backlight-rest`, `--aurora-backlight-hover`,
`--aurora-backlight-blur-rest`, `--aurora-backlight-blur-hover`).
Could additionally introduce `--aurora-button-glow-rest` and
`--aurora-button-glow-hover` for the outer halo length scalars; or
inline these and let the recipe live in one CSS class.

**Tradeoffs.**

- ✓ Closest match to the user's stated mental model.
- ✓ Most physically grounded — light source + diffusion + lens + black
  ground = a coherent optical metaphor.
- ✓ Eliminates the play button gradient asymmetry like A and B.
- ✗ Most expensive of the three: pseudo-element + blur filter + outer
  box-shadow per button. Still well within budget, but worst-case.
- ✗ Two layers of glow can cross-contaminate when buttons sit close
  (Mix header trio: Search, Shuffle, Clear are 8 px apart). May need
  per-context dimming.
- ✗ Largest visual surface area — backlight + halo together extend
  ~14 px past the button edge; tight toolbars are tighter.
- ✗ Most new tokens of the three.

**Performance note.** ~25 buttons × (1 blurred pseudo + 1 box-shadow) =
manageable but the biggest of the three. Watch the Mix page especially
when chip rows wrap. If perceived sluggishness arises, the cheap
mitigation is to turn off the outer halo on `Quiet` tier (it's the
least load-bearing layer).

---

## 6. Recommendation

**My recommendation is C (Frosted Lens),** with one of two scoping
options:

- **Full migration:** apply the recipe across every category in
  one consolidation session. Highest visual coherence; most code
  churn (replaces seven dialects with one, deduplicates `IconBtn`).
- **Loud-first scoping:** apply the Loud tier first to the play
  button, primary `Button` variant, Mix Search, and Mix Jam. Leave
  Quiet-tier categories (sidebar, IconBtn, dialog ghost) on their
  current treatments and migrate them in a follow-up. This fixes the
  most visible problem (play button) while letting the user judge
  the language before the chrome migrates.

**Why C over A:** A is purer to the stated mental model on paper, but
in practice C reads as more anchored to Aurora's existing language
(box-shadow halos already feel like home in this app). C also has a
softer "outer" reading in tight toolbars where A's hard backlight bleed
might compete with adjacent button bleeds.

**Why C over B:** B is cheapest, but it doesn't change the experiential
quality of the buttons — only their consistency. The user explicitly
asked for "colored light *behind* it, like a frosted lens with an LED
inside." B has no behind. If the user reads the ranked tradeoffs and
picks B for the zero-new-token cost, that's a defensible call; just
recognise it's a "make existing recipe consistent" move, not a
"reinvent the family" move.

**Why not A:** A is closest to the literal description, but the lack
of any outer diffusion makes Aurora's atmospheric, OLED-bleed
character feel less continuous between button and ground. C buys you
that diffusion for one box-shadow per button.

---

## 7. Composition with AlbumArt — coexistence in the PlayerBar

> **Direction selected: C — Frosted Lens.** This section assumes C is
> locked and addresses how its per-button outer diffusion composes with
> a newly-intentional, album-color-tied AlbumArt bleed in the same bar.
> The user has decided to upgrade the existing bleed from "incidental
> procedural glow" to "deliberate ambient atmosphere driven by the
> currently-playing album's dominant colour." This changes one of the
> ground assumptions in §3.2 and forces a composition decision: the
> PlayerBar now contains two intentional light sources — the play
> button (Loud-tier Frosted Lens) and the album-tinted atmosphere —
> within a single horizontal bar.

### 7.1 Geometry: do they overlap?

Measured against the PlayerBar source.

**Desktop, playing state** ([`PlayerBar.tsx:150-310`](../../frontend/src/components/layout/PlayerBar.tsx#L150-L310)).
The bar is 80 px tall. The LEFT cluster is 240 px wide
([`PlayerBar.tsx:175`](../../frontend/src/components/layout/PlayerBar.tsx#L175))
and contains a 56 × 56 `AlbumArt size="md"` followed by the title /
artist column with a 14 px gap-3.5
([`PlayerBar.tsx:175`](../../frontend/src/components/layout/PlayerBar.tsx#L175)).
The CENTER cluster (flex-1, max-w-[580px])
([`PlayerBar.tsx:207`](../../frontend/src/components/layout/PlayerBar.tsx#L207))
holds the SkipBack / Play / SkipForward trio centered, then the seek
row beneath. The gap from LEFT cluster to CENTER cluster is 32 px
(gap-8) ([`PlayerBar.tsx:173`](../../frontend/src/components/layout/PlayerBar.tsx#L173)).

The album-art right edge is at roughly x ≈ 56 + (the px-8 left padding,
32 px) = 88 px from the bar's left edge. The play-button centre lands
near the horizontal middle of the bar — at a viewport width of 1280 px
that is ≈ 640 px from the left, so ≈ 550 px from the album-art right
edge. Even at narrow viewport widths the gap stays comfortably above
200 px.

The AlbumArt outer glow is `0 0 24px -6px ...glow`
([`PlayerBar.tsx:182`](../../frontend/src/components/layout/PlayerBar.tsx#L182)) —
spread offset of −6 px and blur 24 px → bleed reaches ≈ 18 px past
the art edge. Direction C's Loud-tier outer halo is
`0 0 28px -10px ...glow` → bleed reaches ≈ 18 px past the button edge.
**The two glows do not geometrically overlap.** They share the bar
atmospherically, not pixel-wise.

**Mobile, playing state** ([`PlayerBar.tsx:46-148`](../../frontend/src/components/layout/PlayerBar.tsx#L46-L148)).
Three stacked rows with `gap-2` (8 px) between them. AlbumArt `size="sm"`
(40 × 40, [`PlayerBar.tsx:64`](../../frontend/src/components/layout/PlayerBar.tsx#L64))
in row 1, controls including the play button (40 × 40,
[`PlayerBar.tsx:125`](../../frontend/src/components/layout/PlayerBar.tsx#L125))
in row 3. Vertical distance between art bottom and play-button top is
roughly 8 px (row gap) + ~24 px (the seek row in row 2) = ≈ 32 px. The
art glow uses a tighter `0 0 16px -4px`
([`PlayerBar.tsx:68`](../../frontend/src/components/layout/PlayerBar.tsx#L68)) —
bleed ≈ 12 px. Direction C's Loud halo bleed ≈ 18 px. Combined reach
30 px against a 32 px gap — **brushing the same air, not overlapping**.

**Verdict on geometry.** They do not occupy the same pixels. They co-
inhabit the same approximately 80 px × 1200 px atmospheric volume.
Composition concerns are perceptual ("does the bar feel busy?"), not
spatial ("do the halos collide?").

### 7.2 Atmospheric composition: complement, compete, or tune?

Three regimes, depending on the dominant album colour.

**Regime 1 — album dominant in the aurora family** (teal, mint, cyan,
ice blue, violet, indigo). The AlbumArt bleed is roughly the same
hue as the play button's teal outer diffusion. The two sources read
as one continuous atmospheric wash; the bar feels lit by a single
coloured presence. **Complement, no tuning needed.**

**Regime 2 — album dominant warm** (orange, red, amber, warm yellow).
The AlbumArt bleed is a warm puddle on the bar's left; the play
button's teal outer diffusion is a cool puddle near the horizontal
centre. On OLED black at low alpha both are subtle, and the gap
between them keeps the eye from forcing a comparison. The reading is
"two coloured ambient sources" — defensible as deliberate, but only
if both stay in the *atmospheric* register rather than competing for
identity. **The play button's outer diffusion needs to dim** so that
the album-coloured atmosphere reads as the bar's primary mood and the
play button's halo recedes into a quieter accent. The button's
backlight (`::before`) stays at full Loud-tier intensity — that is
the play button's identity, not its atmosphere.

**Regime 3 — album dominant high-saturation any hue.** Same calculus as
Regime 2 amplified. The dimming proposed for Regime 2 covers this
case at no extra cost.

The implication for Direction C: **the Loud-tier recipe needs a
PlayerBar contextual override that reduces the outer halo by roughly
40-50 % while leaving the backlight untouched.** The default Loud
recipe stands everywhere else (Mix Search, Mix Jam, primary `Button`
in dialogs).

### 7.3 Play button: contextual intensity override

Use a CSS-custom-property override on the PlayerBar root rather than a
new variant on the button. The button reads its outer-halo length
scalar from a custom property; the PlayerBar overrides that property
within its scope; nothing else needs to know.

Sketch (not for implementation; future Sonnet adapts):

```css
/* In the Loud-tier button recipe: */
.btn-loud {
  /* defaults defined at :root */
  box-shadow:
    inset 0 0 0 1px var(--aurora-rim-bright),
    0 0 var(--aurora-button-glow-rest, 28px)
        calc(-1 * var(--aurora-button-glow-spread, 10px))
        var(--aurora-accent-interactive-glow);
}
.btn-loud:hover {
  box-shadow:
    inset 0 0 0 1px var(--aurora-rim-bright),
    0 0 var(--aurora-button-glow-hover, 36px)
        calc(-1 * var(--aurora-button-glow-spread-hover, 6px))
        var(--aurora-accent-interactive-glow);
}

/* PlayerBar scope dims the outer halo so AlbumArt's album-tinted
   bleed reads as the bar's atmospheric source. Backlight (`::before`)
   is unaffected because it doesn't reference these scalars. */
.aurora-keyline-top {
  --aurora-button-glow-rest: 14px;
  --aurora-button-glow-hover: 18px;
}
```

The skip / prev / next buttons in the PlayerBar are Tier 1 text-only
and have no halo, so they are unaffected by the override. The play
button is the only Loud-tier button in the bar; the override targets
it without naming it.

### 7.4 AlbumArt API change

**Today's AlbumArt** ([`AlbumArt.tsx:13-52`](../../frontend/src/components/songs/AlbumArt.tsx#L13-L52))
accepts `{ song, size, className, style }`. The glow is derived
*deterministically from the song id or title* via
[`albumGradient.ts:39-63`](../../frontend/src/lib/albumGradient.ts#L39-L63),
which selects from a hard-coded `HUES` array of eight cool-family
hues (teal, mint, cyan, ice blue, violet, purple, indigo, forest mint
— [`albumGradient.ts:10-19`](../../frontend/src/lib/albumGradient.ts#L10-L19)).
**The procedural glow is structurally cool-only.** A warm-leaning
playerbar bleed observed today does not come from `art.glow`; it
must be coming from another source (most plausibly the album image
content itself rendered into the `<img>` overlaid on the procedural
background, picked up by the eye through the boxShadow's blurred
edge against the OLED ground). This is worth the user's attention:
"intentionalize the warm bleed" requires *extracting* a real album
colour, because the procedural one cannot represent warm tones at
all.

**Proposed API.** AlbumArt grows an optional `dominantColor` prop:

```ts
interface AlbumArtProps {
  song: { id?: number; title?: string; album_art_path?: string | null;
          dominant_color?: string | null }   // new
  size: "sm" | "md" | "lg" | "fill"
  className?: string
  style?: React.CSSProperties
  /**
   * Override the boxShadow glow colour. When omitted, the component
   * uses song.dominant_color if present, else falls back to the
   * procedural albumGradient glow. Pass an explicit hex/hsla to
   * force a colour (rare).
   */
  glowColor?: string                          // new
}
```

The component prefers `glowColor` → `song.dominant_color` →
`albumGradient(...).glow` in that order. Existing call sites need no
change because the prop is optional and the fallback is the current
behaviour.

**Where the dominant colour is extracted.** Two options; the user
should pick.

| Option | Where | Tradeoff |
|---|---|---|
| **Backend extraction at scan / backfill time** | Add a `dominant_color TEXT` column to `songs`; populate inside `extract_album_art` ([`backend/app/services/file_scanner.py`](../../backend/app/services/file_scanner.py)) and `_backfill_album_art` ([`backend/app/database.py`](../../backend/app/database.py)). Use a lightweight Python image library (Pillow, already a transitive dep of mutagen for some formats; or `colorthief` ~7 KB). | Stable, cached, single source of truth. Survives reload. No client work per render. Requires a migration + scan re-run. |
| **Frontend extraction at image load** | Sample a downscaled canvas after `<img>` `onLoad` and compute average chroma + dominant hue. Stash on a `useRef` keyed by `album_art_path`. | No backend change. Adds a per-load CPU pulse (tens of ms on a 200 × 200 sample) and the result is lost on next session. |

I lean **backend** because Aurora is local-first and the backend
already owns album-art bytes — extracting once at scan time is far
cheaper than re-extracting on every PlayerBar mount. The dominant
colour also becomes addressable for any other future feature
(playlist tinting, sidebar accents). But the user owns this call.

**Whichever path is taken, AlbumArt becomes a passive consumer of a
colour value.** The component itself does no extraction; it merely
prefers an explicit colour over the procedural one.

### 7.5 Reduced-motion fallback for the colour-tied bleed

The bleed is *colour-coded state*, not motion-coded state. With or
without motion preference, the bleed must remain tied to the current
track's dominant colour — that is the *information* the bleed carries.
What changes under `prefers-reduced-motion: reduce` is whether the
colour transition between songs animates.

**Default (motion OK).** When `currentSong` changes, the AlbumArt
boxShadow colour transitions over ~300 ms with the house curve so the
bar's atmosphere shifts smoothly between tracks rather than snapping.
This needs implementing as a CSS variable transition on AlbumArt's
container: declare `--aurora-album-bleed-color` on the AlbumArt root
and add `transition: --aurora-album-bleed-color 300ms cubic-bezier(0.2, 0.7, 0.2, 1)`.
(Animating CSS custom properties requires `@property` registration in
modern browsers — note this in the build session.)

**Reduced motion.** The colour snaps to the new dominant colour.
**Do not** fade to a neutral / aurora-default colour — that would
strip the information from the bleed. The bleed continues to carry
"this is what's playing"; only the *transition* is removed. This
matches design-system.md's reduced-motion philosophy of preserving
state-feedback through colour rather than animation.

```css
@media (prefers-reduced-motion: reduce) {
  /* bleed colour snaps; the rest of the existing reduced-motion block
     in index.css already collapses transition-duration to 0.01ms */
}
```

No additional reduced-motion code is needed beyond what design-system.md
already mandates — the existing global `transition-duration: 0.01ms`
override already covers this case.

### 7.6 New tokens / API additions specific to composition

These are additions **beyond** the existing list in §8.3 (formerly
§7.3 — that list addresses the button system itself; the tokens here
address composition with AlbumArt). They need user approval before
build.

| Proposed | What it is | Status |
|---|---|---|
| `--aurora-button-glow-rest` (length, default `28px`) | Loud-tier outer-halo blur length scalar. Lives at `:root`; PlayerBar scope overrides to `14px`. | New |
| `--aurora-button-glow-hover` (length, default `36px`) | Loud-tier outer-halo blur length scalar on hover. PlayerBar scope override `18px`. | New |
| `--aurora-button-glow-spread` (length, default `10px`) and `-spread-hover` (default `6px`) | Negative-spread length scalars. May be inlined if simpler. | New, optional |
| `--aurora-album-bleed-color` (CSS custom property, set per-instance on AlbumArt's container) | Drives the AlbumArt boxShadow colour. Defaults to `albumGradient(...).glow` when no dominant colour is available. | New |
| `--aurora-album-bleed-radius` (length, default `24px` desktop, `16px` mobile) | Length scalar for AlbumArt boxShadow blur radius. Lets future themes / contexts tune the bleed reach without touching AlbumArt. | New |
| `--aurora-album-bleed-opacity` (scalar, default `0.25`) | Alpha applied to the bleed colour before painting. Currently baked into `albumGradient`'s HSLA `0.25`; surfacing it as a token lets the override path work for arbitrary hex colours from `dominant_color`. | New |
| `AlbumArt` prop `glowColor?: string` | Optional override; falls back to `song.dominant_color` then to procedural. | New API |
| `Song` type field `dominant_color?: string \| null` (frontend type + backend column) | Source of truth for the AlbumArt bleed colour. Backend extraction at scan time recommended. | New schema |
| `@property --aurora-album-bleed-color` registration in `index.css` | Required for CSS-custom-property colour transitions (300 ms house curve). | New |

These are listed here so the appendix's existing §8.3 list (formerly
§7.3 — token proposals for the button system itself) stays untouched.

---

## 8. Inferred vs. Explicit appendix

### 8.1 Claims about Aurora's current state — sourced

**Read directly from code (explicit):**

- All button locations and recipes in §3 — every entry has a
  `file:line` citation that was opened and read in this session.
- The base `Button` component's variant set, sizes, and recipes
  ([button.tsx:14-41](../../frontend/src/components/ui/button.tsx#L14-L41)).
- All `.aurora-*` and `.mix-*` button CSS class definitions
  ([index.css:512-518, 696-718, 793-911](../../frontend/src/index.css#L512-L518)).
- The `.aurora-focus` recipe (referenced from design-system.md and
  applied in components).
- The three-tier disabled opacity rule (design-system.md §Interaction
  states).
- `IconBtn` is duplicated between SongRow and PlaylistDetail (compared
  the two definitions side-by-side).
- Inline `onMouseEnter` / `onMouseLeave` JS handlers in
  `Sidebar.FooterAction`, `QueryBuilder` Edit-query pill, and
  `QueryBuilder` playlist chips.
- Dialog action buttons converge on base `Button` "ghost" + "primary".
- `AlertDialogAction` destructive uses a `className` override, not a
  variant.
- The aurora gradient is `linear-gradient(135deg, #5eead4 0%, #86efac 55%, #a78bfa 100%)`
  ([index.css:87](../../frontend/src/index.css#L87)). On a small disc
  this places teal at the top-left and violet at the bottom-right,
  creating an asymmetric, teal-biased reading at small sizes.

**Inferred from code (interpretation):**

- "Buttons today do not share one light language" — interpretation
  drawn from cross-component comparison; not a single source-of-truth
  document I can cite.
- "Seventeen different visual recipes" — count is approximate; I
  rolled near-duplicates into one and split visually distinct
  treatments. A different observer might count 12 or 22.
- "PlayerBar fights a faint warm bottom-edge bleed" — this came from
  the user's brief; I did not run the dev server and observe the
  rendered PlayerBar in this session, so I treat the bleed as a
  user-reported observation rather than something I verified at the
  pixel level. The most plausible source is the `albumGradient` glow
  applied as an inline `boxShadow` to `AlbumArt` in
  [`PlayerBar.tsx:67-68, 181-184`](../../frontend/src/components/layout/PlayerBar.tsx#L67-L68),
  which pulls a per-album warm tint into the PlayerBar's lower zone;
  but that's an inference, not a confirmed pixel observation.
- The categorisation in §3 (seven categories) — my grouping;
  defensible but not the only possible taxonomy.

### 8.2 Tokens treated as existing

| Token | Status |
|---|---|
| `--aurora-void`, `--aurora-obsidian`, `--aurora-slate`, `--aurora-elevated`, `--aurora-surface-0..3` | ✓ Verified (design-system.md §Color → Surfaces) |
| `--aurora-surface`, `--aurora-surface-hover`, `--aurora-surface-border`, `--aurora-surface-pressed`, `--aurora-muted` | ✓ Verified (Glass surfaces) |
| `--aurora-rim`, `--aurora-rim-bright`, `--aurora-rim-glow` | ✓ Verified (Rim lights) |
| `--aurora-accent-interactive`, `-interactive-hover`, `-interactive-glow` | ✓ Verified |
| `--aurora-accent-muted` | ✓ Verified |
| `--aurora-accent-vivid`, `-vivid-dim`, `--aurora-mint`, `--aurora-violet` | ✓ Verified |
| `--aurora-secondary`, `-secondary-hover`, `-secondary-glow` | ✓ Verified |
| `--aurora-text`, `-text-secondary`, `-text-tertiary` | ✓ Verified |
| `--aurora-danger`, `--aurora-warning` | ✓ Verified |
| `--aurora-glow`, `--aurora-gradient` | ✓ Verified |

No tokens were assumed.

### 8.3 New tokens / patterns proposed as extensions to design-system.md

These need user approval before they ship. They are not introduced by
this doc — only proposed here.

| Proposed | What it is | Used by |
|---|---|---|
| `--aurora-backlight-rest` | Opacity scalar for Loud-tier backlight at rest. Suggested value: `0.55` (Direction A) or `0.65` (Direction C). | Directions A, C |
| `--aurora-backlight-hover` | Opacity scalar for Loud-tier backlight on hover. Suggested value: `0.85` or `0.9`. | Directions A, C |
| `--aurora-backlight-blur-rest`, `--aurora-backlight-blur-hover` | Length scalars for the blur radius applied to the `::before` pseudo-element. Suggested: `12-14px` rest, `14-16px` hover. | Directions A, C |
| `--aurora-button-glow-rest`, `--aurora-button-glow-hover` | Optional outer-halo length scalars. Could also be inlined in CSS. | Direction C (only) |
| `Button` variant `destructive` | New base-component variant that bakes in the `--aurora-danger` recipe so callers stop using `className` overrides on `AlertDialogAction`. | All directions |
| `Button` size `xs-icon` (or rename `icon-sm`) | Match the `h-7 w-7` IconBtn size so `IconBtn` can be deleted in favour of base `Button`. | All directions |
| Move `IconBtn` into the base `Button` component | Not a token, but a code-organisation change required to deduplicate the SongRow / PlaylistDetail pair. | All directions |
| Migrate JS hover handlers in `FooterAction`, Edit-query pill, and playlist chips to CSS `:hover` | Not a token. Required for any direction that uses pseudo-elements (A, C); recommended for B too. | All directions |

---

## 9. Top three things to scrutinise before greenlighting

If the user reads only one section, it should be this one.

1. **§4.1 — the colour-strategy decision.** I committed to "uniform
   aurora light, with `--aurora-danger` as the only exception." A
   semantically-richer palette (e.g. distinct go / warn / aurora /
   destructive light colours) is also defensible, would require
   ~3 new accent tokens, and would compete with Principle 2. If the
   user wants the system to *speak* through colour categories, this
   needs reopening before build.

2. **§5 Direction recommendation (C).** I committed to C over A and
   B. The choice between A (purest backlight) and C (backlight + outer
   diffusion) is genuinely close. C is more conservative and
   atmospherically continuous; A is more literal to the user's
   description. If the user prefers a starker "behind only" reading,
   pick A — the doc supports either being built.

3. **§8.3 — the proposed new tokens.** Six new tokens (four scalars,
   one variant, one size or rename), plus a code-organisation change
   to deduplicate `IconBtn`. The scalars are defensible because they
   make the recipe tunable in one place; the `destructive` variant
   is overdue regardless of direction. The user should still
   explicitly approve before any of these land in `index.css` or
   `button.tsx`.
