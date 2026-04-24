# Aurora Design System

> v2 — revised 2026-04-23 per design-decisions-memo.md
>
> Prescriptive constraint document. All UI work must conform. Deviations
> require explicit justification in the session where they occur.
>
> **Scope:** visual and interaction concerns only — colour, typography,
> spacing, elevation/glass, motion, state, iconography. Component
> patterns, IA, copy voice, page layouts are not in scope.

---

## Principles

Extracted from the consistent patterns in [frontend/src/index.css](../frontend/src/index.css) and the component layer. These are observations of how the code already behaves, promoted to rules.

1. **OLED void is the ground plane.** Page base is pure `#000000` ([index.css:58](../frontend/src/index.css#L58), [index.css:218](../frontend/src/index.css#L218)). Depth is drawn with near-blacks (`#060709` → `#0e1116`) and rim-light keylines, not drop shadows.
2. **Aurora gradient is meaning, not decoration.** Teal → mint → violet gradient appears only on elements that carry identity or primary intent: the Aurora wordmark, the currently-playing title, the play button gradient rim, the primary `Button` fill, and the Mix Jam buttons. Never as a background swath, never as a divider, never as a border on anything else. **This rule is now locked and explicit.** "Gradient marks a thing that is speaking."
3. **Muted at rest, bright on hover.** Interactive elements start dim and resolve toward `--aurora-text` / `--aurora-accent-interactive` when the pointer enters. This is the dominant interaction grammar (play button `--aurora-accent-muted` → `--aurora-accent-interactive`, nav text `--aurora-text-secondary` → `--aurora-text`, keys, chips, IconBtns, FooterActions, seek/volume range tracks).
4. **Rim lights define surfaces; shadows are for depth, not edges.** Every elevated surface — dialogs, the query bar, the float zone, buttons, inputs, chips — gets `inset 0 0 0 1px` at one of the `--aurora-rim*` tokens. Outer shadows are reserved for the glow vocabulary and the dialog lift.
5. **Atmosphere is fixed, content is quiet.** The aurora photograph + veil + radial + noise layers live on `z-index: 0–1` ([index.css:403-460](../frontend/src/index.css#L403-L460)); the UI itself is mostly unsaturated so the atmosphere can breathe through.

---

## Color

### Naming migration (v1 → v2)

v2 renames two token families. **No hex values changed.** This is a semantic rename only.

| v1 name | v2 name | Hex |
|---|---|---|
| `--aurora-primary` | `--aurora-accent-interactive` | `#4db8a4` |
| `--aurora-primary-hover` | `--aurora-accent-interactive-hover` | `#5ec9b5` |
| `--aurora-primary-glow` | `--aurora-accent-interactive-glow` | `rgba(77,184,164,0.18)` |
| `--aurora-teal` | `--aurora-accent-vivid` | `#5eead4` |
| `--aurora-teal-dim` | `--aurora-accent-vivid-dim` | `rgba(94,234,212,0.55)` |

The rename encodes semantic roles: `-interactive` = hover destinations, fills, active states. `-vivid` = gradient constituents, focus rings, `::selection`, rim-aurora fades. Reach for `-interactive` on interactive controls; reach for `-vivid` on identity and spectacle.

### Core palette

All tokens declared at `:root` in [index.css:56-145](../frontend/src/index.css#L56-L145). Use the semantic token name; never the hex directly.

**Surfaces — OLED stack** ([index.css:58-61, 138-141](../frontend/src/index.css#L58-L141)):

| Token | Value | Use |
|---|---|---|
| `--aurora-void` | `#000000` | App background, page base, scrollbar track, logo-ring offset |
| `--aurora-obsidian` | `#060709` | PlayerBar base tint (at 80% alpha) |
| `--aurora-slate` | `#0a0c11` | Play-button text colour (dark on gradient) |
| `--aurora-elevated` | `#0e1116` | Top edge of dialog gradient |
| `--aurora-surface-0` | `#000000` | Page base (duplicate of void for scale clarity) |
| `--aurora-surface-1` | `#0a0a0c` | Cards, drawers |
| `--aurora-surface-2` | `#111114` | Popovers, dropdowns |
| `--aurora-surface-3` | `#17171b` | Modals, sheets — highest elevation |

**Glass surfaces — translucent white** ([index.css:127-132](../frontend/src/index.css#L127-L132)):

| Token | Value | Use |
|---|---|---|
| `--aurora-surface` | `rgba(255,255,255,0.04)` | Chip/pill fill, nav active background, kbd keys |
| `--aurora-surface-hover` | `rgba(255,255,255,0.065)` | Hover lift on **all** hover surfaces — nav items, song rows, footer actions. See C7 note. |
| `--aurora-surface-border` | `rgba(255,255,255,0.07)` | Border for glass surfaces |
| `--aurora-surface-pressed` | `rgba(255,255,255,0.035)` | Pressed state for surface-1 items |
| `--aurora-muted` | `rgba(255,255,255,0.14)` | Chip default border, dividers, inactive outlines |

> **C7 note:** `--aurora-surface-hover` is the single unified hover surface for the entire app. Counter-intuitively, `rgba(255,255,255,0.065)` composited on OLED black resolves to gray 17/17/17, which is *brighter* than the former solid `--aurora-surface-1` hover (gray 10/10/12). Unification does not lose legibility; it preserves the "atmosphere is fixed" principle by keeping hover translucent over any faint image bleed.

**Rim lights** ([index.css:70-72](../frontend/src/index.css#L70-L72)):

| Token | Value | Use |
|---|---|---|
| `--aurora-rim` | `rgba(255,255,255,0.06)` | Default inset keyline on every elevated surface |
| `--aurora-rim-bright` | `rgba(255,255,255,0.12)` | Hover/focus keyline |
| `--aurora-rim-glow` | `rgba(94,234,212,0.18)` | Top of sidebar keyline only ([index.css:366](../frontend/src/index.css#L366)) — uses `--aurora-accent-vivid` hex |

**Accent colors** ([index.css:108-116](../frontend/src/index.css#L108-L116)):

| Token | Value | Use |
|---|---|---|
| `--aurora-accent-interactive` | `#4db8a4` (smoked teal) | Primary action fill on hover, active nav indicator, seek-bar hover fill, currently-playing row accent bar, "Playing" label. **Renamed from `--aurora-primary`.** |
| `--aurora-accent-interactive-hover` | `#5ec9b5` | One-step-brighter interactive for nested hover (Search/Jam buttons). **Renamed from `--aurora-primary-hover`.** |
| `--aurora-accent-interactive-glow` | `rgba(77,184,164,0.18)` | Focus halos, primary-action box-shadow. **Renamed from `--aurora-primary-glow`.** |
| `--aurora-accent-muted` | `#459687` | Play-button fill at rest, range-track fill at rest, equalizer bars — the "at-rest" tone |
| `--aurora-secondary` | `#8a75c8` (twilight violet) | Jam button paired with interactive, sidebar gradient line, upgraded-song dot |
| `--aurora-secondary-hover` | `#9b88d6` | Rarely used directly; reserved for nested hover |
| `--aurora-secondary-glow` | `rgba(138,117,200,0.15)` | Violet companion to interactive glow, dual-glow focus rings |
| `--aurora-glow` | `rgba(77,184,164,0.12)` | Generic hover glow (`.aurora-btn-glow`, search focus-within) |

**Text hierarchy** ([index.css:91-96](../frontend/src/index.css#L91-L96)):

| Token | Value | Use |
|---|---|---|
| `--aurora-text` | `#e8e6e3` (warm near-white) | Primary text, headings, on-surface text, hover-destination colour |
| `--aurora-text-secondary` | `#8b95a7` | Artist names, metadata, secondary button text, inactive nav. **Canonical.** |
| `--aurora-text-tertiary` | `#4b5563` | Counts in sidebar, end-times in PlayerBar, captions under empty-state illustrations. **Canonical.** |

> **C4 migration:** `--aurora-text-dim` (= `--aurora-text-secondary`) and `--aurora-text-muted` (= `--aurora-text-tertiary`) are **deprecated aliases** declared in [index.css:94-95](../frontend/src/index.css#L94-L95). They remain until a component sweep replaces all occurrences (`text-dim` in SongRow, button.tsx; `text-muted` in `.label-micro`, PlayerBar mobile). New code must use `-secondary` / `-tertiary` only. Aliases will be deleted after the sweep.

**Semantic** ([index.css:99-100](../frontend/src/index.css#L99-L100)):

| Token | Value | Use |
|---|---|---|
| `--aurora-danger` | `#f87171` | Destructive text/borders, error messages, trash-icon hover, required `*` markers |
| `--aurora-warning` | `#fbbf24` | Reserved for the missing-file indicator feature (completeness audit priority #6). Contrast on OLED: ~13.1:1 (AAA). Do not use for unrelated amber needs. Delete if the feature does not land in the next 1–2 sessions. |

**Accent-vivid palette — gradient constituents** ([index.css:75-78](../frontend/src/index.css#L75-L78)):

These are the *brighter* teal/mint/violet used inside the signature gradient and related glow lines. Not interchangeable with the smoked `--aurora-accent-interactive` family.

| Token | Value | Use |
|---|---|---|
| `--aurora-accent-vivid` | `#5eead4` | Gradient start, focus rings, `::selection` tint, playlist-chip default dot, rim-aurora fades. **Renamed from `--aurora-teal`.** |
| `--aurora-accent-vivid-dim` | `rgba(94,234,212,0.55)` | Reduced-opacity vivid. **Renamed from `--aurora-teal-dim`.** |
| `--aurora-mint` | `#86efac` | Gradient middle stop |
| `--aurora-violet` | `#a78bfa` | Gradient end stop, default-playlist chip colour |

> **Deleted tokens (C5):** `--aurora-tertiary`, `--aurora-tertiary-hover`, `--aurora-tertiary-glow` (zero component usage, no pending consumer), and `--aurora-text-disabled` (replaced by the C3 opacity tier system) have been removed from the token set. See Historical decisions #9.

### Aurora gradient

**Definition** ([index.css:87](../frontend/src/index.css#L87)):

```css
--aurora-gradient: linear-gradient(135deg, #5eead4 0%, #86efac 55%, #a78bfa 100%);
```

The start stop (`#5eead4`) is the hex value of `--aurora-accent-vivid`. Gradient constituents are not referenced via token inside the gradient definition; use the hex directly here only.

**Soft companion** ([index.css:88](../frontend/src/index.css#L88)) — same stops at 12-16% opacity for low-intensity fills. Not currently used in any component; reserved.

**Applied via `.aurora-gradient-text`** (text clipping) and `.aurora-gradient-bg` (solid fill). In practice the gradient appears on:

- Aurora wordmark — [Sidebar.tsx:57](../frontend/src/components/layout/Sidebar.tsx#L57)
- Currently-playing song title in a row — [SongRow.tsx:146](../frontend/src/components/songs/SongRow.tsx#L146)
- Primary `Button` variant fill — [button.tsx:38-40](../frontend/src/components/ui/button.tsx#L38-L40)
- The `.mix-jam-primary` / `.mix-btn-jam` / `.mix-float-jam` buttons — teal→violet companion gradient ([index.css:705, 811, 889](../frontend/src/index.css#L705))
- Aurora-coloured keyline fades at the top of the PlayerBar and the right edge of the sidebar — [index.css:357-394](../frontend/src/index.css#L357-L394)

### Rules

- **Use `--aurora-accent-interactive` (smoked teal)** for interactive fills, active states, hover destinations, and accent bars. This is the everyday teal.
- **Use `--aurora-accent-vivid` (bright teal)** only inside the signature gradient, `::selection`, focus rings, and the sidebar/PlayerBar keyline-aurora fade. Do not introduce `--aurora-accent-vivid` as a button fill.
- **Use `--aurora-accent-muted`** for anything "at rest that wakes on hover": play buttons at rest, range tracks at rest, equalizer bars.
- **Never use the gradient** on dividers, card fills, empty-state illustrations, icon strokes, or as a hover lift. Gradient is identity and primary intent only.
- **Never use raw hex in components** where a token exists. `#5eead4` appearing outside `index.css` is a bypass of the system ([SongRow.tsx:192-193](../frontend/src/components/songs/SongRow.tsx#L192-L193), [ScanDialog.tsx:149](../frontend/src/components/scanner/ScanDialog.tsx#L149) — both use raw hex for a preferred-colour dot; arguable exceptions because they are colour-swatches, not semantic fills).
- **Destructive always uses `--aurora-danger`.** No other red.

---

## Theme architecture

Aurora is dark-only and multi-theme-ready. The `:root` light theme block ([index.css:147-180](../frontend/src/index.css#L147-L180)) is dead code and has been deleted. All shadcn primitives scope to `.dark`.

### Shadcn ↔ Aurora token bridge

The `.dark` block ([index.css:182-210](../frontend/src/index.css#L182-L210)) bridges shadcn's role-based tokens to Aurora's semantic tokens via `var(--aurora-*)` references. A future theme override changes only the aurora tokens; shadcn follows automatically.

| Shadcn token | Aurora source | Note |
|---|---|---|
| `--background` | `--aurora-surface-0` (`#000`) | Page ground = OLED void |
| `--foreground` | `--aurora-text` (`#e8e6e3`) | Primary warm near-white |
| `--card` | `--aurora-surface-1` (`#0a0a0c`) | Cards, popover floor |
| `--popover` | `--aurora-surface-2` (`#111114`) | One tier above card |
| `--muted` | `--aurora-surface-1` | shadcn "muted block" — a surface, not a text token |
| `--muted-foreground` | `--aurora-text-secondary` (`#8b95a7`) | Secondary text |
| `--accent` | `--aurora-surface-1` | "Accent" in shadcn = hover-surface, not a color accent |
| `--accent-foreground` | `--aurora-text` | Text on accent surface = primary text |
| `--border` | `--aurora-rim` (`rgba(255,255,255,0.06)`) | Already aligned |
| `--input` | `--aurora-rim` | Already aligned |
| `--ring` | `--aurora-accent-vivid` (`#5eead4`) | Focus ring — vivid teal per C2 |
| `--primary` | `--aurora-accent-vivid` | shadcn "primary" = identity color |
| `--primary-foreground` | `--aurora-slate` (`#0a0c11`) | Dark text on gradient |
| `--secondary` | `--aurora-surface-1` | shadcn's secondary is a low-key surface |
| `--secondary-foreground` | `--aurora-text` | |
| `--destructive` | `--aurora-danger` (`#f87171`) | Already aligned |
| `--destructive-foreground` | `--aurora-text` | |
| `--sidebar*` | `--aurora-obsidian` and text tokens | |

### Multi-theme direction

The target token architecture isolates theme-specific values:

```
frontend/src/styles/
  tokens.css           ← immutable scaffolding: --aurora-void, radius, primary text
  themes/
    dark-aurora.css    ← current default (.theme-dark-aurora applied on <html>)
    dark-ember.css     ← example future theme (red/amber accents)
    dark-noir.css      ← example future theme (monochrome)
  bridge.css           ← the shadcn ↔ aurora bridge above
```

Each future theme overrides only the accent and surface-tint tokens. Switching themes means swapping one class on `<html>`. This directory structure is the target; file migration is deferred until a second theme is actively needed.

---

## Typography

### Font stack

Declared in [index.css:9-11](../frontend/src/index.css#L9-L11) and [index.css:221](../frontend/src/index.css#L221):

| Token | Stack | Use |
|---|---|---|
| `--font-sans` | `'Geist Variable', system-ui, sans-serif` | All body, labels, UI chrome |
| `--font-display` | `'Fraunces', ui-serif, Georgia, serif` | Headings, hero titles, italic quiet copy |
| Mono (inline only) | `ui-monospace, 'SF Mono', 'Menlo', monospace` | Keyboard keys in Mix bar ([index.css:669](../frontend/src/index.css#L669)), scan-error file paths ([ScanDialog.tsx:189](../frontend/src/components/scanner/ScanDialog.tsx#L189)) |

**Font loading:** Geist is loaded via `@fontsource-variable` ([index.css:4](../frontend/src/index.css#L4)). Fraunces is currently loaded via a Google Fonts `<link>` in [index.html:9](../frontend/index.html#L9) — it renders correctly today across all variable axes (opsz, weight, SOFT, WONK). The planned migration (C9) is to self-host via `@fontsource-variable/fraunces` for privacy, offline capability, and CSP compliance. This is a migration from CDN to self-hosted, not a bug fix — there is no latent bug in the current setup.

### Display utilities

Three variable-font recipes, defined in [index.css:237-262](../frontend/src/index.css#L237-L262):

| Class | Optical size | Weight | Style | Use |
|---|---|---|---|---|
| `.font-display` | 144 | 600 | Roman, soft 60 | Hero titles ("Mix" h1, dialog titles, row empty-state headline, PlayerBar song title, Aurora wordmark) |
| `.font-display-subtitle` | 36 | 500 | Roman, soft 50 | Declared, no current component usage — reserved for sub-headings |
| `.font-display-italic` | 36 | 500 | Italic, soft 100 | Quiet copy: "Nothing playing," "Build a query above," empty-state sub-lines, sidebar "No playlists yet," placeholder text in `Input` |

### Label / micro

`.label-micro` ([index.css:264-270](../frontend/src/index.css#L264-L270)): 10.5px / 500 / letter-spacing 0.16em / uppercase / colour `--aurora-text-tertiary`. Used on: sidebar section headers ("Playlists," "Tags"), dialog field labels ("Folder path," "Cover," "Name"), song-table column headers, Mix result count.

> **C4:** `.label-micro` references `--aurora-text-tertiary` directly. Previous usage via the deprecated `--aurora-text-muted` alias must be migrated.

### Size scale (observed)

No formal numeric scale is declared. The values that recur in components:

| Size | Where it appears |
|---|---|
| `34px` | Aurora wordmark in sidebar |
| `28px` | Mix h1 |
| `26px` | Quick-tag compact header |
| `22px` | Dialog titles, empty-state headlines |
| `18-20px` | PlayerBar desktop song title, Mix empty-state, Jam button label |
| `15px` | PlayerBar mobile song title, idle "Nothing playing" |
| `14px` | Song-row title, default button text |
| `13px` | Input text, dialog result rows, scan stats |
| `12-12.5px` | Descriptions, secondary button text, sidebar tag name, footer actions |
| `11px` | Captions ("Playing," artist row, chip labels) |
| `10.5px` | `label-micro` |
| `10px` | Section counts, table header labels, chip text, volume time readout |
| `9.5px` | Dialog labels (`label-micro` override) |

Line-height is set contextually — headings use `leading-none` or `leading-tight`; body text is left to default.

### Weight scale (observed)

`400` is never used; the code skips directly to `500` (`font-medium`) for almost all UI chrome, with `600` (`font-semibold`) reserved for keyboard keys and pill-buttons (Search/Edit-query), and `font-display` pinned at `600`. Body copy has no weight-weight contrast.

### Tracking

- Body / UI chrome: `tracking-tight` (`-0.025em`) on navigation items, titles
- Display: `letter-spacing: -0.03em` (`.font-display`), `-0.02em` (`.font-display-subtitle`), `-0.01em` (`.font-display-italic`)
- Micro labels: `letter-spacing: 0.16em` (`label-micro`), `0.05em` (`.mix-kbd`)

### OpenType features

Body inherits `font-feature-settings: "ss01", "cv11"` from [index.css:224](../frontend/src/index.css#L224) — these are Geist's stylistic alternates. Do not override per-component.

### Rules

- **Use `.font-display`** for any hero-sized title and for the Aurora wordmark. Do not inline Fraunces.
- **Use `.font-display-italic`** for all "quiet" copy: empty-state sub-lines, "Nothing playing," placeholder text, and any text that should feel editorial or ambient.
- **Use `.label-micro`** for every section heading and form-field label. Never write `uppercase tracking-widest` inline.
- **Use `tabular-nums`** for every number that will update (durations, counts, seek/volume time). Applied inline in PlayerBar, SongRow, Sidebar counts.
- **Numeric size** — pick from the observed scale above. If you reach for a value not on that list, justify it in the session.
- **Text tokens:** use `--aurora-text-secondary` and `--aurora-text-tertiary`. Never use deprecated `--aurora-text-dim` or `--aurora-text-muted` in new code.

---

## Spacing & layout

### Grid & containers

- **App shell grid** ([AppShell.tsx:63](../frontend/src/components/layout/AppShell.tsx#L63)): `grid-cols-1 md:grid-cols-[240px_1fr] grid-rows-[1fr_auto]`. 240px is the sidebar; PlayerBar spans both columns.
- **Sidebar width:** `w-60` = 240px ([Sidebar.tsx:52](../frontend/src/components/layout/Sidebar.tsx#L52)). Sidebar content padding is `px-6` for section headers and `px-3` for item lists.
- **Main content max width:** `max-w-[1400px] mx-auto` ([QueryBuilder.tsx:60, 125](../frontend/src/components/filter/QueryBuilder.tsx#L125)).
- **Page padding:** `p-4 sm:px-10 sm:pt-6` on the Mix/QueryBuilder root. PlayerBar uses `px-4` (mobile) / `px-8` (desktop).

### Radius scale

Defined via `--radius: 0.625rem` (10px) with arithmetic tiers ([index.css:43-49](../frontend/src/index.css#L43-L49)):

| Token | Value |
|---|---|
| `--radius-sm` | 6px |
| `--radius-md` | 8px |
| `--radius-lg` | 10px |
| `--radius-xl` | 14px |
| `--radius-2xl` | 18px |
| `--radius-3xl` | 22px |
| `--radius-4xl` | 26px |

In components, Tailwind tokens `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl` map to these. Two other values appear:

- `rounded-full` / `rounded-[999px]` — all pills (chips, play button, Jam buttons, range track, preset swatches, action pills).
- `rounded-r-full` — left-edge active-state accent bars (`3px × 20px` in Sidebar, `3px × 28px` in SongRow).

### PlayerBar sizing

Heights are a fixed three-state system, documented in [index.css:743-770](../frontend/src/index.css#L743-L770) and overridden inline in [PlayerBar.tsx:154](../frontend/src/components/layout/PlayerBar.tsx#L154):

| State | Height | Padding |
|---|---|---|
| Mobile, idle | 44px | `px-4` |
| Mobile, playing | auto (stacks 3 rows) | `px-4 py-3 gap-2` |
| Desktop, idle | 52px | `px-8 gap-4` |
| Desktop, playing | 80px | `px-8 gap-8` |

### Row & control heights

- Sidebar nav item: `py-2` (~40px total)
- Sidebar tag item: `py-[6px]` (~28px total)
- Sidebar footer action: `py-1.5` (~28px)
- Song-row cell: `px-4 py-3`
- Button (default): `h-10`; (sm): `h-8`; (lg): `h-11`; (icon): `h-9 w-9`
- IconBtn in rows: `h-7 w-7`
- Pill buttons in Mix header: `h-8 px-4`
- Primary Jam (inline): `h-[50px] px-[28px]`
- Float-zone Jam: `h-[48px] px-[22px]`; Float-zone Search: `h-[34px] px-[14px]`
- Input: `h-10 px-3.5 py-2`
- Dialog content padding: `p-6`
- Keyboard key (`.mix-kbd`): `h-[24px] px-[7px]`

### Stack & gap

Observed spacing values: `gap-0.5` (2px) for icon clusters, `gap-1` (4px) / `gap-1.5` (6px) for chip rows, `gap-2` (8px) / `gap-2.5` (10px) for button clusters, `gap-3` (12px) / `gap-3.5` (14px) for PlayerBar art-title groupings, `gap-4-8` for section separation.

### Rules

- **Use the shell grid** for any full-page view. Do not override the `240px 1fr` column split.
- **Pages sit inside `max-w-[1400px] mx-auto`.** Mix, All Songs, Playlist detail all do this.
- **Pills radius is `rounded-full` or `999px`.** Cards/containers use the `--radius` scale; chips/buttons-that-look-like-pills don't.
- **Never hard-code PlayerBar heights outside [PlayerBar.tsx](../frontend/src/components/layout/PlayerBar.tsx).** The 44/52/80px values are load-bearing for the float-zone's `bottom: 112px` ([index.css:838](../frontend/src/index.css#L838)).

---

## Elevation & glass

Aurora uses two parallel elevation systems — **solid OLED stack** and **glass-over-content** — and they should not be mixed on the same element.

### Solid OLED stack

For anything that sits above black and needs to feel like a lifted layer:

- Surface-0 `#000000` — page ground
- Surface-1 `#0a0a0c` — cards, drawers
- Surface-2 `#111114` — popovers, dropdowns (shadcn menus)
- Surface-3 `#17171b` — highest, reserved for stacked modals

### Glass recipes

Five distinct glass surfaces live in the codebase. Each has a specific role; do not swap them.

**1. PlayerBar** ([PlayerBar.tsx:40-43](../frontend/src/components/layout/PlayerBar.tsx#L40-L43)):
- Background: `rgba(6,7,9,0.80)` (obsidian at 80%)
- Blur: `blur(12px)`
- Top edge: `.aurora-keyline-top` — aurora-tinted hairline fade

**2. Sidebar** ([Sidebar.tsx:52](../frontend/src/components/layout/Sidebar.tsx#L52)):
- Background: `bg-[#050608]/60`
- Blur: `backdrop-blur-xl` (24px)
- Right edge: `.aurora-keyline-right` — aurora fade top, neutral rim below

**3. Dialog** ([dialog.tsx:59-66](../frontend/src/components/ui/dialog.tsx#L59-L66)):
- Background: `linear-gradient(180deg, rgba(14,17,22,0.82), rgba(8,10,13,0.88))`
- Blur: `blur(32px) saturate(120%)`
- Border: `inset 0 0 0 1px var(--aurora-rim)`
- Lift: `0 40px 80px -20px rgba(0,0,0,0.8)`
- Aurora halo: `0 0 48px -12px rgba(94,234,212,0.12)`
- Overlay: `bg-black/70` with `supports-backdrop-filter:backdrop-blur-md`

**4. Mix query bar** ([index.css:644-659](../frontend/src/index.css#L644-L659)):
- Background: `rgba(255,255,255,0.025)`
- Blur: `blur(12px)`
- Border: `inset 0 0 0 1px var(--aurora-rim)`
- Focus-within: rim brightens + dual-colour glow `0 0 20px -6px` in interactive and secondary

**5. Mix float-zone** ([index.css:836-855](../frontend/src/index.css#L836-L855)):
- Background: `rgba(15,15,18,0.9)`
- Blur: `blur(20px)`
- Border: `1px solid rgba(77,184,164,0.18)` + inset white 0.04 rim
- Lift: `0 12px 40px -8px rgba(0,0,0,0.75)` + aurora halo `0 0 28px -10px rgba(77,184,164,0.12)`

### Top scrim

A sticky scrim fades the very top of the scrollable main content area. Tokenized pattern.

**Token** — add to [index.css](../frontend/src/index.css) `:root`:
```css
--aurora-scrim-top: linear-gradient(
  to bottom,
  rgba(0, 0, 0, 0.85) 0%,
  rgba(0, 0, 0, 0.55) 40%,
  rgba(0, 0, 0, 0.20) 75%,
  rgba(0, 0, 0, 0.00) 100%
);
```

**Utility** — add to [index.css](../frontend/src/index.css):
```css
.aurora-scrim-top {
  pointer-events: none;
  position: sticky;
  top: 0;
  height: 24px;
  margin-bottom: -24px;
  z-index: 20;
  background: var(--aurora-scrim-top);
}
```

**Usage:** `<div className="aurora-scrim-top" aria-hidden="true" />` at the top of [AppShell.tsx](../frontend/src/components/layout/AppShell.tsx)'s scrollable content area, replacing the current inline block ([AppShell.tsx:70-77](../frontend/src/components/layout/AppShell.tsx#L70-L77)).

Height is fixed at 24px — matching the `sm:pt-6` content-top padding; a taller scrim would overlap real content. The curve is non-linear (4 stops) to avoid the faint banding a linear fade produces on OLED. No bottom scrim is needed — the PlayerBar is in the shell grid, not overlaid.

### Glow vocabulary

Three fixed glow sizes ([index.css:311-321](../frontend/src/index.css#L311-L321)) plus per-element primary/secondary halos:

| Class | Shadow |
|---|---|
| `.aurora-glow-sm` | `0 0 16px -4px rgba(94,234,212,0.25)` |
| `.aurora-glow` | `0 0 28px -6px rgba(94,234,212,0.35)` |
| `.aurora-glow-lg` | `0 0 48px -8px rgba(94,234,212,0.4)` |

Per-component halos use `--aurora-accent-interactive-glow` (teal) and `--aurora-secondary-glow` (violet) in pairs for focus-within / hover states (Input, Mix query bar, Jam buttons).

### Rules

- **Every lifted surface gets a rim keyline.** `inset 0 0 0 1px var(--aurora-rim)` at rest, `--aurora-rim-bright` on hover/focus.
- **Do not combine a glass background with a solid surface-N background** on the same element. Pick one system.
- **Album-art boxes use the `.aurora-rim` utility** for their border, plus an album-gradient-coloured outer glow on PlayerBar art ([PlayerBar.tsx:68, 182](../frontend/src/components/layout/PlayerBar.tsx#L68)).
- **Use the three `.aurora-glow*` sizes** for ambient decoration. Reserve custom `0 0 Xpx` shadows for paired interactive+secondary halos on the Mix/query surfaces.
- **Use `.aurora-scrim-top`** for any sticky-header fade. Do not write inline scrim gradients.

---

## Motion

### Vocabulary

| Name | Duration | Easing | Usage | Primitive |
|---|---|---|---|---|
| Hover — color/bg | 150ms | `ease` | All color or background-color hover changes | CSS |
| Press | 100ms | `ease` | `.aurora-btn-press` (scale 0.97) | CSS |
| Focus transition | 200ms | `ease` | Focus ring fade-in, Input glow appearance | CSS |
| Micro-reveal | 200ms | house curve | View-switch opacity, PlayerBar children fade | CSS |
| Row-in (staggered) | 220ms | house curve | Per-row fade+rise; stagger `index × 25ms`, cap at 16 rows | CSS |
| Layout shift | 300ms | house curve | PlayerBar height, mobile drawer slide | CSS |
| Page enter | 420ms | house curve | `.aurora-fade-in` on route/view mount | CSS |
| Ambient pulse | 3.0–3.5s loop | `ease-in-out` | `.aurora-pulse`, `.aurora-idle-shimmer`, `.aurora-eq-*` | CSS |
| Toast slide | 200ms in / 150ms out | `cubic-bezier(0.16, 1, 0.3, 1)` / `ease` | Sonner | CSS (in library) |

"House curve" = `cubic-bezier(0.2, 0.7, 0.2, 1)`.

### When to use CSS vs. `motion` library

CSS handles ~90% of Aurora's motion needs. The installed `motion` package (v12) is reserved for:

- **Orchestrated sequences** — e.g. a Queue drawer where children stagger independently of the drawer opening.
- **Layout animations** — shared-element-like transitions (album art scaling from row thumbnail to Now-Playing view).
- **Gestures** — swipe-to-dismiss drawers, drag-to-reorder playlist rows.
- **Spring physics** — only if a specific interaction calls for it. Springs easily conflict with T3 (cozy/chill aesthetic); use sparingly.

Default bias: **CSS-first.** Pull in `motion` when orchestration or gestures make CSS painful, not before.

### Durations (observed)

| Duration | Where |
|---|---|
| 100ms | `.aurora-btn-press` transform ([index.css:790](../frontend/src/index.css#L790)) |
| 150ms | Default UI colour/background transitions (nav hover, chip hover, icon-btn hover, tag-chip hover, keyboard-key hover) |
| 180ms | Range-track height + thumb opacity ([index.css:535, 552](../frontend/src/index.css#L535)) |
| 200ms | Default transition on Button, Input focus transition, toast slide-in, view-enter fade, `.aurora-view-enter`, float-zone opacity, playerbar-children opacity (with 80ms delay), Mix-query-bar box-shadow |
| 220ms | `.aurora-row-in` row fade-up ([index.css:919](../frontend/src/index.css#L919)) |
| 250ms | `.playerbar-children` opacity ([index.css:760](../frontend/src/index.css#L760)) |
| 300ms | Sidebar active-bar grow ([Sidebar.tsx:219](../frontend/src/components/layout/Sidebar.tsx#L219)), PlayerBar height transition ([index.css:744](../frontend/src/index.css#L744)), mobile drawer slide |
| 420ms | `.aurora-fade-in` page fade ([index.css:627](../frontend/src/index.css#L627)) |
| 150ms exit | Toast slide-out |

### Easings

| Easing | Use |
|---|---|
| `ease` / `ease-in-out` | Default for colour and background transitions (150ms) |
| `cubic-bezier(0.2, 0.7, 0.2, 1)` | The Aurora house curve — all layout-moving transitions: page fade-in, PlayerBar height, row entry |
| `cubic-bezier(0.16, 1, 0.3, 1)` | Toast entrance |
| `ease-in-out` | Equalizer bars, idle shimmer, pulse glow |
| Linear | Never. |

### Motion primitives

| Class / keyframe | What it does |
|---|---|
| `.aurora-fade-in` | 420ms fade + 6px rise, house curve. Used on SongTable root, global page mounts |
| `.aurora-view-enter` | 200ms pure opacity fade. Used for view-switch transitions (compact tag header, PlayerBar playing state) |
| `.aurora-row-in` | 220ms fade + 4px rise. Applied per-row with a 25ms stagger for the first 16 rows only ([SongRow.tsx:64](../frontend/src/components/songs/SongRow.tsx#L64)) |
| `.aurora-btn-press` | `active:scale(0.97)` over 100ms. Applied to every primary action button |
| `.aurora-btn-glow` | Adds a `--aurora-glow` halo on hover |
| `.aurora-pulse` | 3.2s ease-in-out infinite gentle breathing glow |
| `.aurora-idle-shimmer` | 3.5s ease-in-out infinite teal↔violet gradient shift — PlayerBar "Nothing playing" placeholder |
| `.aurora-eq-{1,2,3}` | 0.9s / 1.1s / 0.95s staggered bar heights for the equalizer |

### Rules

- **Use the house curve `cubic-bezier(0.2, 0.7, 0.2, 1)` for anything that moves in space** (translate, height, transform). Use plain `ease` for colour-only transitions.
- **Default transition duration is 150ms** for hover state changes, **200ms** for Button and Input focus, **300ms** for layout shifts.
- **Row entry uses `.aurora-row-in` with a 25ms × index stagger, capped at 16 rows.** Do not replicate this pattern inline.
- **Never animate opacity or transforms longer than 420ms** outside the specific ambient loops (shimmer, pulse, equalizer).
- **`will-change` is only declared on PlayerBar height** ([index.css:746](../frontend/src/index.css#L746)). Do not add it elsewhere without justification.
- **All ambient loops must respect `prefers-reduced-motion`.** See Accessibility below.

---

## Accessibility

### Reduced motion

**Non-negotiable.** Every ambient infinite loop must be disabled when the system preference is `prefers-reduced-motion: reduce`. Zero hits currently exist in `frontend/src` — this is a pre-existing gap that must be closed in the consolidation session.

Required block in [index.css](../frontend/src/index.css):

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable infinite ambient loops */
  .aurora-pulse,
  .aurora-idle-shimmer,
  .aurora-eq > span,
  .mix-jam-primary,
  .mix-btn-jam,
  .mix-float-jam {
    animation: none !important;
  }
  /* Collapse transitions to near-instant, preserving state feedback */
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Near-zero duration (`0.01ms`) rather than `none` prevents Howler-driven seek-bar fill snaps from reading as bugs. Currently-playing state remains legible via the row accent bar and gradient-text title — color-coded, not motion-coded.

Any new ambient motion class added in the future must be added to this list at the same time it is created.

---

## Interaction states

### Hover

Unified hover surface: `--aurora-surface-hover` (`rgba(255,255,255,0.065)`) on every surface that lifts on hover — nav items, song rows, footer actions, playlist items. Do not use `--aurora-surface-1` (solid) as a hover background.

Specific recipes:

- **Nav / sidebar items**: text-colour transition, 200ms; hover background `--aurora-surface-hover` fades in via an absolutely-positioned overlay.
- **Song rows** ([SongRow.tsx:97](../frontend/src/components/songs/SongRow.tsx#L97)): per-cell `group-hover:bg-[var(--aurora-surface-hover)]` overlay, 150ms. Action icons fade in at 200ms. Play button opacity swap on `.group:hover` over 150ms plus `hover:scale-105`.
- **Chips** (`.aurora-chip`): border brightens `--aurora-muted` → `rgba(255,255,255,0.22)`; background fills to `--aurora-surface`; 150ms.
- **Play button** (`.aurora-play-btn`): `--aurora-accent-muted` → `--aurora-accent-interactive`, 200ms.
- **Keyboard keys** (`.mix-kbd`): text brightens, surface hover fill, rim-bright border.

### Active / pressed

- **Primary buttons**: `active:scale-[0.97]` via `.aurora-btn-press` (100ms).
- **Keyboard keys**: `transform: translateY(1px)` + shadow removal.
- **Range thumb**: `scale(1.15)` on `:active`.

### Disabled

Three-tier system. Apply based on the element's visual weight.

| Tier | Opacity | When to apply | Components |
|---|---|---|---|
| 1 — fully unavailable | `0.25` | Text/icon-only controls that should nearly disappear until functional. Never apply to filled or outlined elements — 0.25 on a fill produces an ambiguous "almost gone" state. | PlayerBar skip/prev/next/play (text-color icons at rest) |
| 2 — default disabled | `0.40` | Every filled button, primary action, Input disabled, Range disabled | Button (already at 0.40 — no change), Range (migrate from 0.35), Input (migrate from 0.50) |
| 3 — readable-but-inactive | `0.55` | Secondary/tertiary pill controls waiting for user input; float-zone controls when query is empty | Mix Jam / float-Jam (migrate from 0.45), Mix Search/Shuffle pills (migrate from 0.50), float-search (migrate from 0.45) |

Cursor: disabled always uses `cursor-not-allowed` or `pointer-events: none`.

### Focus

**Canonical focus treatment** (`.aurora-focus` shared class):

```
focus-visible:ring-2
ring-[var(--aurora-accent-vivid)]/70
ring-offset-2
ring-offset-[var(--aurora-surface-0)]
```

Apply to: Button, IconBtn, nav items, chips, keyboard keys, range inputs, mobile hamburger, drawer close. Input's existing dual-glow inset shadow treatment remains as an *additive* container signal on top of the ring.

**WCAG rationale:** `--aurora-accent-vivid` (`#5eead4`) at `/70` opacity composited on OLED black measures ~5.2:1 — comfortably above the WCAG 2.2 §1.4.11 3:1 floor for UI components. `--aurora-accent-interactive` at `/60` measures ~3.0:1 — exactly at the floor. Always use vivid, not interactive, for focus rings.

**`ring-offset-2` note:** On OLED black the offset renders as `--aurora-void` (pure black) — identical to the page background. The offset functions as *spatial separation* (a 2px gap around the element), not *chromatic separation* (a contrasting band). This is correct; do not attempt to change the offset color to create contrast.

### Selection

`::selection` → `rgba(94,234,212,0.25)` background, `#ffffff` text ([index.css:612-615](../frontend/src/index.css#L612-L615)).

### Scrollbar

Ghost thin: transparent track, transparent thumb until parent:hover → `rgba(255,255,255,0.08)`; thumb-hover → `rgba(255,255,255,0.18)` ([index.css:585-606](../frontend/src/index.css#L585-L606)). `.aurora-chiprow` hides scrollbars entirely for the Mix chip row.

### Rules

- **Hover surface is always `--aurora-surface-hover`.** Never use `--aurora-surface-1` as a hover background.
- **Pressable primary actions** always get `.aurora-btn-press`. Secondary/ghost buttons don't need it.
- **Focus ring is always `.aurora-focus`** (vivid teal at `/70`). Do not introduce per-component focus-ring variations.
- **Disabled tier determines opacity.** Tier 1 (0.25) is for text/icon-only unfilled controls only. Default is tier 2 (0.40). Tier 3 (0.55) for secondary informational pills.
- **Pointer targets below 32×32** should include `title` + `aria-label` (see [SongRow.tsx:236-258](../frontend/src/components/songs/SongRow.tsx#L236-L258)).

---

## Iconography

### Library

Lucide React is the only icon library, imported in 17 files ([grep `lucide-react`](../frontend/src)).

### Sizes (observed)

| Size | Tailwind | Where |
|---|---|---|
| 12px | `h-3 w-3` | Pill-button leading icons (Search, Clear, Shuffle inside pill), chip X |
| 14px | `h-3.5 w-3.5` | Song-row action icons (Tag, Pencil, Trash), PlaylistDetail search icon, footer actions |
| 16px | `h-4 w-4` | Sidebar nav icons, PlayerBar volume/mute, small controls, row play button centre, row close |
| 17px | `h-[17px] w-[17px]` | Mix float Jam button |
| 18px | `h-[18px] w-[18px]` | PlayerBar skip/play icons (desktop), Mix inline Jam button, QueryBuilder Tag header |

### Stroke weight

- Default Lucide `strokeWidth={2}` in most places.
- `strokeWidth={2.5}` for emphasis on `Search` glyphs ([QueryBuilder.tsx:137](../frontend/src/components/filter/QueryBuilder.tsx#L137), [.tsx:322](../frontend/src/components/filter/QueryBuilder.tsx#L322)).
- `strokeWidth={0}` with `fill="currentColor"` for **Play, Pause, SkipBack, SkipForward** — all transport glyphs are rendered as solid shapes, not stroked. Applies in both PlayerBar and the row-hover play button.

### Colour

Icons inherit from their parent text colour in 95% of cases. The notable exceptions:

- Sidebar nav icon while active: coloured `--aurora-accent-interactive` ([Sidebar.tsx:245](../frontend/src/components/layout/Sidebar.tsx#L245)).
- Play/pause fill in PlayerBar: `#050608` on the gradient button.
- QueryBuilder Tag icon: `--aurora-accent-interactive` ([QueryBuilder.tsx:67](../frontend/src/components/filter/QueryBuilder.tsx#L67)).
- Row action IconBtn hovering danger: icon goes to `--aurora-danger`.
- Footer action icons: parent colour at `opacity-60` ([Sidebar.tsx:267](../frontend/src/components/layout/Sidebar.tsx#L267)).

### Placement

Icons paired with text generally use `gap-1.5` (6px) in pill buttons, `gap-2` (8px) in toolbar clusters, `gap-2.5-3` in primary Jam buttons.

### Rules

- **Use lucide-react only.** No other icon library, no custom SVG icons.
- **Transport glyphs (Play/Pause/Skip) are filled, not stroked.** Use `fill="currentColor"` (or the literal dark hex when on the gradient button) with `strokeWidth={0}`.
- **All other glyphs are stroked**, `strokeWidth={2}` by default, `2.5` for emphasis.
- **Pick the icon size from the observed scale.** `h-3.5 w-3.5` is the row-icon default; `h-4 w-4` is the nav default; `h-[18px]` is reserved for PlayerBar controls.
- **Inherit colour from text**; override only for active states or semantic signaling.

---

## Historical decisions — resolved

All items from the v1 "Unresolved / open questions" section. Kept for traceability.

1. **Two coexisting teal systems.** Resolved by C1: `--aurora-accent-interactive` (smoked `#4db8a4`) for hover destinations and fills; `--aurora-accent-vivid` (bright `#5eead4`) for gradient, focus ring, `::selection`, and rim-aurora fades. The distinction is real and semantic, not redundant.

2. **Stale comment about gradient usage.** Resolved: the gradient-as-voice rule is now locked Principle 2. The stale [index.css:85-86](../frontend/src/index.css#L85-L86) comment claiming "exactly 3 places" should be rewritten when code consolidation lands. The doc rule supersedes the comment.

3. **Text-token aliases duplicated.** Resolved by C4: canonical names are `--aurora-text-secondary` and `--aurora-text-tertiary`. Aliases `--aurora-text-dim` and `--aurora-text-muted` are deprecated; a component sweep will delete them.

4. **Shadcn theme variables vs Aurora variables coexist without boundaries.** Resolved by C6: the `:root` light theme is dead code (deleted). `.dark` is the only theme. All shadcn tokens bridge to Aurora tokens via `var(--aurora-*)` references. See Theme architecture above.

5. **Fraunces is referenced but not explicitly imported.** Resolved by C9: Fraunces loads correctly today via a Google Fonts `<link>` in [index.html:9](../frontend/index.html#L9). There is no bug. Planned migration to `@fontsource-variable/fraunces` is an improvement for privacy and offline support, not a fix.

6. **Focus rings are not unified.** Resolved by C2: canonical treatment is the `.aurora-focus` class — `ring-2 ring-[var(--aurora-accent-vivid)]/70 ring-offset-2 ring-offset-[var(--aurora-surface-0)]`. Applied uniformly; Input's inset-glow is additive.

7. **Disabled opacity ranges from 0.25 to 0.55.** Resolved by C3: three-tier system. See Interaction states → Disabled.

8. **Row hover uses two different hover surface systems.** Resolved by C7: unified to `--aurora-surface-hover` (`rgba(255,255,255,0.065)`) everywhere. The translucent hover is counterintuitively brighter than the former solid `--aurora-surface-1` on OLED black (gray 17 vs. gray 10) — unification does not lose legibility.

9. **`--aurora-tertiary`, `--aurora-warning`, `--aurora-text-disabled` declared but unused.** Resolved by C5: tertiary group deleted (no pending consumer). `--aurora-text-disabled` deleted (replaced by C3 tier system). `--aurora-warning` kept — reserved for the missing-file indicator feature (completeness audit priority #6). See also Implementation questions #1.

10. **Preset colours in CreatePlaylistDialog include colours outside the system.** Resolved per T5: the playlist-colour swatch UI is being reworked in a separate feature session. Out of scope for the design-system consolidation.

11. **"Aurora logo is gradient" isn't captured as a rule.** Resolved: now locked Principle 2. "Gradient marks a thing that is speaking." Previously inferred; now explicit.

12. **No documented dark-scrim / "top scrim" pattern.** Resolved by C8: tokenized as `--aurora-scrim-top` and `.aurora-scrim-top`. See Elevation & glass → Top scrim.

---

## Implementation questions for the user

1. **`--aurora-warning` — keep or delete?** The memo recommends keeping it if the missing-file indicator (completeness audit priority #6) is landing in the next 1–2 sessions; otherwise delete. This doc currently keeps it. Confirm timing before the code consolidation removes it.

2. **C9 — Confirm Fraunces self-hosting.** Plan is: `npm install @fontsource-variable/fraunces`, `@import` in `index.css`, remove the Google Fonts `<link>` from `index.html`. This removes the Google Fonts network dependency. Confirm before the migration session runs.

---

## Inferred vs. explicit

| Section | Explicit (read directly from code) | Inferred (pattern interpretation) |
|---|---|---|
| Principles | — | All five principles are inferred from consistent token/component behavior. P2 (gradient is meaning) and P3 (muted at rest) are **now locked and explicit** — previously inferred only. |
| Color palette | All hex values, all token names, all aliases. Renamed token table is **now explicit** (C1). | The semantic grouping ("rim lights," "accent colors," "surface stack") is stated in source comments. |
| Aurora gradient | Exact gradient definition; applied via `.aurora-gradient-text` / `.aurora-gradient-bg` | "Meaning-bearing only, not decoration" was inferred; it is now a **locked Principle** (P2). |
| Typography — utilities | `.font-display`, `.font-display-italic`, `.font-display-subtitle`, `.label-micro` recipes | Size and weight scale are extracted from component usage, not declared anywhere. |
| Spacing & layout | Shell grid, sidebar width, PlayerBar heights, radius scale, max-w-1400 | Gap scale and padding scale inferred from component-level Tailwind classes. |
| Elevation & glass | Every glass recipe is explicit. Top scrim pattern is **now explicit** (C8). | "Do not mix glass and solid-surface systems on the same element" is inferred. |
| Motion | Every duration, every easing, every keyframe declared in CSS. Motion vocabulary table and reduced-motion policy are **now explicit** (v2). | "Use the house curve for space-moving transitions only" was inferred; it is now stated in the vocabulary. |
| Interaction — hover | Unified `--aurora-surface-hover` rule is **now explicit** (C7). | The "muted at rest, bright on hover" grammar was inferred from pattern. |
| Interaction — active | `aurora-btn-press`, range thumb scale, kbd translate | — |
| Interaction — disabled | Three-tier system is **now explicit** (C3). Previous per-component values were observed drift. | |
| Interaction — focus | Canonical `.aurora-focus` treatment and WCAG rationale are **now explicit** (C2). | Previous per-component variation was observed as inconsistent. |
| Iconography | Lucide library, per-use sizes and strokeWidths | "Transport glyphs filled, everything else stroked" was inferred; confirmed robust across PlayerBar and SongRow. |
| Accessibility | `prefers-reduced-motion` requirement is **now explicit** (v2). | Previously absent from the doc entirely. |
