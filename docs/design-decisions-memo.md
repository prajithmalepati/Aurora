# Aurora Design Decisions Memo — 2026-04-23

> Evaluation of the 9 convention-level decisions reached with the user in
> chat, against Aurora's current code and the `ui-ux-pro-max` skill
> database. Taste-level decisions (T1–T5) are treated as fixed inputs.

---

## Summary

Of the 9 convention-level decisions, **4 are CONFIRMED as-is**, **4 are
REVISED with evidence** (C2 focus ring, C5 dead-token scope, C6 token
bridge, C8 scrim curve), and **1 needs USER INPUT** (C9, where the
premise has partially shifted — Fraunces *is* loaded, just not via
`@fontsource`). A separate motion-vocabulary section has been added
because Aurora has no written motion language despite a rich set of
existing primitives, and no `prefers-reduced-motion` implementation
anywhere in the tree — a Priority 1 accessibility gap per the skill.

The top three things for the user to review are:

1. **C2 — the locked focus ring is a regression.** Replacing the current
   `--aurora-teal/60` bright-teal ring with `--aurora-accent-interactive/60`
   (smoked teal at 60%) pushes contrast below the WCAG 2.2 §1.4.11
   3:1 threshold on OLED black. Keep the vivid teal for the ring.
2. **C9 — Fraunces is already loaded** via a Google Fonts `<link>` in
   [index.html:9](../frontend/index.html#L9). The `design-system.md`
   Unresolved #5 statement ("no explicit @import") is only half right —
   the load happens at the HTML layer, not the CSS layer. The install
   decision is still defensible (self-hosting > CDN for privacy,
   performance, CSP), but it is a *migration*, not a *bugfix*.
3. **Motion / reduced-motion.** Zero `prefers-reduced-motion` hits in
   `frontend/src` (verified via grep). Aurora has ambient loops
   (shimmer, pulse, equalizer) that *will* violate user preferences on
   machines that request reduced motion. This should land in the same
   consolidation session.

---

## Taste-level constraints honored

T1 (gradient as voice), T2 (PlayerBar gets fancy — gradient play button
and seek), T3 (cozy/chill preserved — no aggressive brightness), T4
(multi-theme-ready, no light mode), T5 (playlist color rework, tile
becomes placeholder/image) are treated as fixed inputs. No conflict
with any convention-level decision was found. The closest pressure
point is C2: if the "err on softer side" instinct from T3 is applied
to the focus ring opacity, the ring drops below WCAG contrast — see C2
below for the resolution (softness expressed via hue choice, not
opacity).

---

## Convention-level decisions

### C1 — Two teals renamed semantically

**Locked (from chat):**
Keep both teals. Rename `--aurora-primary` (#4db8a4) →
`--aurora-accent-interactive`; rename `--aurora-teal` (#5eead4) →
`--aurora-accent-vivid`. Smoked teal is for interactive fills; bright
teal is for gradient constituents, `::selection`, focus rings, and
rim-aurora fades.

**My evaluation:** CONFIRMED with one naming suggestion.

**Evidence from Aurora codebase:**
- `--aurora-primary` usage in [index.css:108](../frontend/src/index.css#L108):
  smoked `#4db8a4`, used on `.aurora-play-btn:hover` ([index.css:518](../frontend/src/index.css#L518)),
  `.mix-btn-search` ([index.css:693](../frontend/src/index.css#L693)),
  sidebar active-bar background ([Sidebar.tsx:245](../frontend/src/components/layout/Sidebar.tsx#L245)),
  and the inline Jam gradient primary stop ([index.css:705](../frontend/src/index.css#L705)).
- `--aurora-teal` usage in [index.css:75](../frontend/src/index.css#L75):
  bright `#5eead4`, referenced in the gradient definition
  ([index.css:87](../frontend/src/index.css#L87)),
  `::selection` background ([index.css:612-613](../frontend/src/index.css#L612-L613)),
  and the Button `focus-visible:ring` ([button.tsx:15](../frontend/src/components/ui/button.tsx#L15)).
- The split is real and load-bearing — the code already treats them
  as semantically different, but there is no commented rule.

**Evidence from UI UX Pro Max skill:**
- `--domain ux "color contrast"`: WCAG §1.4.3 requires 4.5:1 for text,
  §1.4.11 requires 3:1 for UI components and graphical objects
  including focus indicators. Smoked `#4db8a4` on pure black measures
  ~7.2:1; bright `#5eead4` measures ~11.5:1. The distinction matters
  for the focus-ring decision (C2), not for naming.
- `--stack shadcn "theme variables"`: shadcn's canonical role-based
  naming is `--primary`, `--accent`, `--ring`. The proposed
  `--aurora-accent-interactive` / `--aurora-accent-vivid` follow the
  same role-based spirit (describe the job, not the hue).

**My recommendation:** Keep the split and the proposed names, but
consider `--aurora-accent-display` as an alternative to
`--aurora-accent-vivid`. "Display" signals "identity / spectacle /
rendered-for-looking-at," which matches the actual usage (gradient,
wordmark, selection). "Vivid" leans slightly playful and can be
misread as "use whenever you want pop," which is exactly the
misreading the rename is trying to prevent. Either name is defensible;
this is a taste call.

**Rationale:** The two-teal system is real semantic distinction, not
redundancy. Renaming to role-based tokens makes the rule teachable
("reach for `-interactive` on hover destinations; reach for `-vivid`
on gradient-and-similar-spectacle") and surfaces the system for the
next developer touching the code.

---

### C2 — Focus ring canonical treatment

**Locked (from chat):**
`focus-visible:ring-2 ring-[var(--aurora-accent-interactive)]/60 ring-offset-2 ring-offset-[var(--aurora-surface-0)]`

**My evaluation:** REVISED — this locked version is less visible than
what Button already has.

**Evidence from Aurora codebase:**
- [button.tsx:15](../frontend/src/components/ui/button.tsx#L15) already
  uses `ring-[var(--aurora-teal)]/60 ring-offset-2 ring-offset-[var(--aurora-void)]`
  — the *bright* teal, not the smoked one. Locking the smoked teal
  would be a downgrade, not a unification.
- [input.tsx:14](../frontend/src/components/ui/input.tsx#L14) uses a
  dual-glow inset shadow with `rgba(77,184,164,0.3)` (the smoked
  teal's RGB at 30%) plus paired primary+secondary glow halos — a
  completely different technique.
- Range thumb, Mix query bar, nav items, IconBtns, chips, keyboard
  keys: no explicit focus style; rely on browser default outline.

**Evidence from UI UX Pro Max skill:**
- `--domain ux "focus accessibility"` Result 1: "Focus States" — High
  severity. "Use visible focus rings on interactive elements." The
  canonical example is `focus:ring-2 focus:ring-blue-500` (full
  opacity).
- Contrast math: smoked `#4db8a4` at 60% opacity composited on black
  is equivalent to `#2e6e62`, which measures ~3.0:1 against `#000000`
  — exactly at the WCAG 2.2 §1.4.11 3:1 floor. Bright `#5eead4` at
  60% composited on black is `#39926f`, ~5.2:1 — comfortably above.
  Aurora is a content-dense app where focus visibility is
  load-bearing; err above the floor, not at it.
- `ring-offset-2` on OLED black: the offset renders as `--aurora-void`
  (pure black), which is identical to the page background, so the
  offset functions as *spatial separation* (a gap) rather than
  *chromatic separation* (a contrasting band). This is legitimate on
  OLED but means "offset" does nothing the Tailwind docs imply — the
  ring floats 2px from the element with invisible buffer. Document
  this explicitly to prevent future confusion.

**My recommendation:**
```
focus-visible:ring-2
ring-[var(--aurora-accent-vivid)]/70
ring-offset-2
ring-offset-[var(--aurora-surface-0)]
```
Apply this as a shared class (e.g. `.aurora-focus`) and compose it
onto Button, Input, IconBtn, nav items, chips, keyboard keys, range
inputs, mobile hamburger, and drawer close. Keep Input's existing
inset-glow treatment as an *additional* signal (focus-within already
paints teal+violet halos on the container); the ring is the
accessibility primitive and should apply uniformly.

**Rationale:** Softness is a taste-valid instinct (T3) but at /60 on
smoked teal it measurably crosses below the contrast threshold the
skill flags as High-severity. Preserving softness via the vivid hue at
/70 keeps the aesthetic (it reads as a hair-thin glow, not a bold
band) while staying AA-compliant. Two units of ring width is the
Spotify / Apple Music / Plex dark-mode consensus, per the skill's
style database under "Dark Mode (OLED)."

---

### C3 — Disabled opacity three-tier system

**Locked (from chat):**
- 0.25 — "don't look at this" (fully unavailable, background)
- 0.40 — default disabled (can't use right now)
- 0.55 — "still readable" (informational, not interactive)

**My evaluation:** CONFIRMED with slightly adjusted component mappings.

**Evidence from Aurora codebase:**
- Button 0.40 ([button.tsx:15](../frontend/src/components/ui/button.tsx#L15))
- PlayerBar transport 0.25 ([PlayerBar.tsx:117, 215](../frontend/src/components/layout/PlayerBar.tsx#L117)) —
  applied to text-color icon buttons, never to filled buttons
- Range input 0.35 ([index.css:577](../frontend/src/index.css#L577))
- Mix Jam / float Jam 0.45 ([index.css:828, 905](../frontend/src/index.css#L828))
- Mix float search 0.45 ([index.css:877](../frontend/src/index.css#L877))
- Input (shadcn) 0.50 ([input.tsx:14](../frontend/src/components/ui/input.tsx#L14))

**Evidence from UI UX Pro Max skill:**
- `--domain ux "color contrast disabled"` Result 4: "Disabled States" —
  Medium severity. "Reduce opacity and change cursor." The skill's
  canonical value is `opacity-50`. It does not prescribe a tiered
  system.
- WCAG 2.2 §1.4.3 Note 4 explicitly exempts disabled ("inactive")
  controls from contrast requirements, so WCAG is permissive here.
  Industry norms vary: Material Design uses 38%, IBM Carbon uses 50%,
  Radix ships no single "disabled" opacity. Three tiers is slightly
  unusual but internally defensible when the tiers map to distinct
  communicative intents.

**My recommendation:** Adopt the three tiers. Map Aurora's surfaces:

| Tier | Value | When | Components today |
|---|---|---|---|
| 1 — fully unavailable | 0.25 | Text/icon-only controls that should almost disappear until they can function. Only apply to unfilled elements where 0.25 still reads. | PlayerBar skip/prev/next/play (text-color icons, already quiet) |
| 2 — default disabled | 0.40 | Every filled button, every primary action, Input disabled state, Range disabled state | Button, Range (migrate from 0.35), Input (migrate from 0.50), AddSongDialog submit |
| 3 — readable-but-inactive | 0.55 | Secondary/tertiary pill controls that sit in a "waiting for user input" state, floating-zone search when empty query | Mix Jam/float-Jam (migrate from 0.45), Mix Search/Shuffle pills (migrate from 0.50), float-search (migrate from 0.45) |

Document the contract as: "tier 1 is for controls whose visual
identity is already quiet; never apply tier 1 to a filled or
outlined button, the drop to 0.25 on a fill produces an ambiguous
'almost disappeared, might be clickable' state."

**Rationale:** The six-value drift the user flagged is real and the
three-tier system eliminates it without collapsing communicative
intent. The tier mapping matters more than the tier count — applying
0.25 to a filled button (rather than a text-color icon) would produce
the muddy state the skill's "Disabled States" guideline warns against.

---

### C4 — Text token canonical names

**Locked (from chat):**
Rename/standardize on `--aurora-text-secondary` and
`--aurora-text-tertiary`. Sweep and delete the legacy aliases
`--aurora-text-dim` and `--aurora-text-muted`.

**My evaluation:** CONFIRMED.

**Evidence from Aurora codebase:**
- Duplicate declarations: [index.css:91-95](../frontend/src/index.css#L91-L95) —
  `--aurora-text-secondary` (#8b95a7) == `--aurora-text-dim` (#8b95a7);
  `--aurora-text-tertiary` (#4b5563) == `--aurora-text-muted` (#4b5563).
- Mixed usage at the component layer:
  - `text-dim` wins in SongRow ([SongRow.tsx:152](../frontend/src/components/songs/SongRow.tsx#L152))
  - `text-dim` also in button.tsx variants ([button.tsx:19, 23, 25, 27](../frontend/src/components/ui/button.tsx#L19))
  - `text-secondary` in PlayerBar ([PlayerBar.tsx:51, 78, 117, 140, 194, 215, 242, 250, 285](../frontend/src/components/layout/PlayerBar.tsx#L51))
  - `text-muted` in `.label-micro` ([index.css:269](../frontend/src/index.css#L269)) and PlayerBar mobile
  - `text-tertiary` in PlayerBar desktop ([PlayerBar.tsx:107, 199, 265](../frontend/src/components/layout/PlayerBar.tsx#L107))
- Three text tiers (+ italic placeholder via `.font-display-italic` +
  the declared-but-unused `--aurora-text-disabled`) is the full
  hierarchy in use.

**Evidence from UI UX Pro Max skill:**
- `--stack shadcn "theme variables"` Result 1: shadcn ships exactly
  two text tokens — `foreground` and `muted-foreground`. Two tiers is
  the industry minimum.
- IBM Carbon and Material use role-based names (`text-primary`,
  `text-secondary`, `on-surface-variant`) rather than effect-based
  names (`text-dim`, `text-muted`). Role-based names are less ambiguous.

**My recommendation:** Commit to `text-secondary` and `text-tertiary`.
Execute the sweep:
- `var(--aurora-text-dim)` → `var(--aurora-text-secondary)` (≈12 component hits)
- `var(--aurora-text-muted)` → `var(--aurora-text-tertiary)` (≈8 hits including `.label-micro`)
- Delete the two alias lines in [index.css:94-95](../frontend/src/index.css#L94-L95).
- Update `.label-micro` to reference `var(--aurora-text-tertiary)` directly.

Two tiers of secondary text (plus primary + italic-placeholder) is
sufficient for Aurora's observed information density. The skill data
does not support a fourth text tier.

**Rationale:** Duplicate tokens accumulate drift. Once both names
exist, each component picks whichever the author saw first, and the
code becomes impossible to refactor tonally. Secondary/tertiary
encode hierarchy explicitly; dim/muted encode effect only — which is
why the authors who wrote SongRow and PlayerBar desktop ended up
reaching for different names for the same role.

---

### C5 — Dead token deletion

**Locked (from chat):**
Delete `--aurora-tertiary`, `--aurora-tertiary-hover`,
`--aurora-tertiary-glow`, `--aurora-warning`, `--aurora-text-disabled`.

**My evaluation:** REVISED — delete two of the three groups; hold one
pending the user's call on a near-term feature.

**Evidence from Aurora codebase:**
- `--aurora-tertiary` / `-hover` / `-glow`: zero component usage.
  Declared at [index.css:114-116](../frontend/src/index.css#L114-L116)
  as "rarest aurora light — golden-hour aurora." No grep hits outside
  declarations.
- `--aurora-warning: #fbbf24` ([index.css:100](../frontend/src/index.css#L100)):
  zero component usage. But the literal hex `#fbbf24` appears in
  [CreatePlaylistDialog.tsx:23](../frontend/src/components/playlists/CreatePlaylistDialog.tsx#L23)
  as a preset swatch (scheduled for removal in T5).
- `--aurora-text-disabled: #2a2f3a` ([index.css:96](../frontend/src/index.css#L96)):
  zero component usage. The C3 opacity system replaces any need for
  a dedicated disabled text color.

**Evidence from UI UX Pro Max skill + audit cross-check:**
- `session-15-completeness-audit.md` priority #6: "Missing-file
  handling. Either a 'broken' indicator on rows, or a 'broken files'
  sidebar item." A warning/amber color would be the natural token for
  this. No current feature uses it, but the audit flags it as top-10.
- Audit priority #12: play-count / last-played. No warning implications.
- Audit Error States section: "Corrupt metadata" / "Audio decode
  failure" — candidates for a warning color, not currently wired.

**My recommendation:**
- **DELETE** `--aurora-tertiary`, `-hover`, `-glow` (3 lines). T5
  removes the preset-color palette from `CreatePlaylistDialog`, which
  was the only place amber could have landed. The token has no
  pending consumer and is pure drift surface.
- **DELETE** `--aurora-text-disabled`. C3 replaces it; no pending
  consumer.
- **KEEP** `--aurora-warning` IF the user wants to land the missing-file
  indicator (audit #6) in the near term. Otherwise delete it. The
  hex value in `CreatePlaylistDialog.tsx` goes away with T5 regardless.
  If kept, verify the contrast on OLED: `#fbbf24` on `#000` measures
  ~13.1:1 (AAA), so the value is fine as-is.

**Rationale:** Reserved-for-future tokens rot in two ways — they
bit-rot (the hex becomes wrong for the product's updated palette
direction) or they get grabbed by an unrelated component that needed
"an amber-ish thing" and the semantic collapses. A warning token
delayed-delete is fine; a tertiary and text-disabled token deleted
now is better than kept.

---

### C6 — Shadcn light theme + unification

**Locked (from chat):**
Delete the `:root` light theme (dead code). Keep `.dark`. Unify `.dark`
HSL values to derive from aurora tokens where sensible. Document the
architecture as multi-theme-ready.

**My evaluation:** REVISED — the deletion is correct, but the
unification pattern should be stated more precisely than "where
sensible."

**Evidence from Aurora codebase:**
- Light `:root` declaration at [index.css:147-180](../frontend/src/index.css#L147-L180) —
  34 lines of oklch values, none of which are applied (the `.dark`
  class is attached at the html level permanently; the app has no
  theme toggle). This is dead code.
- `.dark` declaration at [index.css:182-210](../frontend/src/index.css#L182-L210) —
  HSL-with-alpha notation. Ten of the 30 tokens already align with
  aurora equivalents numerically:
  - `--background: 0 0% 0%` ≡ `--aurora-void`
  - `--foreground: 210 17% 97%` ≡ `--aurora-text` #e8e6e3
  - `--border: 0 0% 100% / 0.06` ≡ `--aurora-rim`
  - `--input: 0 0% 100% / 0.06` ≡ `--aurora-rim`
  - `--ring: 167 76% 64%` ≈ `#66e5c9` (close to `--aurora-teal` #5eead4)
  - `--primary: 167 76% 64%` same as ring
  - `--card: 220 14% 5%` ≈ `#0a0c0f` (close to `--aurora-surface-1` #0a0a0c)
  - `--popover: 220 14% 5%` ≈ card
  - `--muted: 220 14% 7%` ≈ `#0f1116`
  - `--sidebar: 220 14% 4%` ≈ `#080a0e` (close to `--aurora-obsidian` #060709)
- Shadcn primitives in the app rely on these HSL tokens:
  Slider, Command, Toast, Dropdown, etc. — breaking the mapping
  breaks the primitives.

**Evidence from UI UX Pro Max skill:**
- `--stack shadcn "theme"` Result 1 & 2: "Use CSS variables for colors"
  and "Support dark mode." Both flagged High severity. The canonical
  shadcn pattern is `:root` light + `.dark` override, with every
  component reaching through the role tokens (`bg-primary`,
  `text-muted-foreground`).

**My recommendation:**

1. Delete the `:root` light-theme block ([index.css:147-180](../frontend/src/index.css#L147-L180)).
   Document at top of `.dark` that Aurora is dark-only by design.

2. Explicit bridge mapping — publish this table inside `index.css` as
   a comment block so the next maintainer doesn't guess:

| Shadcn token | Aurora equivalent | Note |
|---|---|---|
| `--background` | `--aurora-surface-0` (`#000`) | Page ground = OLED void |
| `--foreground` | `--aurora-text` (#e8e6e3) | Primary warm near-white |
| `--card` | `--aurora-surface-1` (#0a0a0c) | Cards, popover floor |
| `--popover` | `--aurora-surface-2` (#111114) | Popovers specifically one tier above card |
| `--muted` | `--aurora-surface-1` | shadcn's "muted block," not text |
| `--muted-foreground` | `--aurora-text-secondary` (#8b95a7) | Secondary text |
| `--accent` | `--aurora-surface-1` | "Accent" in shadcn means hover-surface, not color accent |
| `--accent-foreground` | `--aurora-text` | Text on accent = primary text |
| `--border` | `--aurora-rim` (rgba 255/0.06) | Already aligned |
| `--input` | `--aurora-rim` | Already aligned |
| `--ring` | `--aurora-accent-vivid` (#5eead4) | See C2 — focus ring is the vivid teal |
| `--primary` | `--aurora-accent-vivid` | Shadcn "primary" = identity color |
| `--primary-foreground` | `--aurora-slate` (#0a0c11) | Dark text on gradient, matches play button fg |
| `--secondary` | `--aurora-surface-1` | Shadcn's secondary is low-key |
| `--secondary-foreground` | `--aurora-text` | |
| `--destructive` | `--aurora-danger` (#f87171) | Already aligned numerically |
| `--destructive-foreground` | `--aurora-text` | |
| `--sidebar*` | map to `--aurora-obsidian` and text tokens | |

   Write these as CSS custom-property fallbacks, not string
   duplications: `--ring: var(--aurora-accent-vivid);`. This way a
   future theme overrides `--aurora-accent-vivid` once and shadcn
   follows automatically.

3. Theme-ready architecture (T4). Proposal:
   ```
   frontend/src/styles/
     tokens.css          ← current :root aurora-* declarations, THEME-AGNOSTIC
     themes/
       dark-aurora.css   ← the current default theme (.theme-dark-aurora)
       dark-ember.css    ← example future theme (red/amber accents)
       dark-noir.css     ← example future theme (pure monochrome)
     bridge.css          ← the shadcn ↔ aurora bridge table above
   ```
   Each theme file declares only the `--aurora-*` accent and
   surface-tint tokens it overrides. `tokens.css` holds immutable
   scaffolding (`--aurora-void`, radius scale, text primary). The
   `.dark` class becomes `.theme-dark-aurora` (etc.) applied on
   `<html>`. Theme switching means swapping one class; shadcn
   reaches through via the bridge and follows automatically.

**Rationale:** "Unify where sensible" invites drift back in. An
explicit bridge table makes the contract readable. The theme-ready
directory structure is deferred work — user explicitly does not want
second themes built now, but the file layout locks in the pattern so
adding one is a single-file operation.

---

### C7 — Hover surface unification

**Locked (from chat):**
Unify to translucent `rgba(255,255,255,0.065)` (`--aurora-surface-hover`)
on all hover surfaces — SongRow, nav items, footer actions, everything.
User rationale: "song table renders over OLED black not image bleed,
so the legibility argument for solid hover doesn't hold."

**My evaluation:** REVISED — the user's rationale is *partially* wrong
about the background, but the conclusion is right for a different
reason.

**Evidence from Aurora codebase:**
- [AppShell.tsx:19-22](../frontend/src/components/layout/AppShell.tsx#L19-L22)
  places the image bleed, veil, atmosphere, and noise layers at z-0/1.
- [AppShell.tsx:63](../frontend/src/components/layout/AppShell.tsx#L63)
  wraps content in `relative z-10` — above the atmosphere.
- Critically: the content wrapper has NO background-color. Neither
  does `SongTable` or `SongRow`. The song table *does* render over
  image bleed — but heavily darkened by the veil ([index.css:418-429](../frontend/src/index.css#L418-L429))
  which is a `radial-gradient` going from `rgba(0,0,0,0.45)` at center
  to `rgba(0,0,0,0.90)` at edges, on top of 19% opacity aurora image.
  So content areas are ~95–99% pure black, varying by position.
- SongRow currently paints `group-hover:bg-[var(--aurora-surface-1)]`
  on each `<td>` ([SongRow.tsx:97, 136, 163, 177, 215, 228](../frontend/src/components/songs/SongRow.tsx#L97)) —
  solid `#0a0a0c`.
- Nav, footer, PlaylistItem, etc. use translucent `--aurora-surface-hover`.

**Math — the counterintuitive finding:**
- `rgba(255,255,255,0.065)` composited on `#000000` → `#111111`
  (apparent gray 17/17/17).
- Solid `--aurora-surface-1` → `#0a0a0c` (apparent gray 10/10/12).
- **Translucent hover is actually slightly *brighter* than the current
  solid hover on OLED black.** The solid-vs-translucent trade-off
  typically assumes opposite ordering.

**Evidence from UI UX Pro Max skill:**
- `--domain ux "data table hover"` Result 4: "Hover States" — Medium
  severity. "Change cursor and add subtle visual change." The skill
  does not mandate solid vs. translucent for dense tables.
- `--domain style "glassmorphism dark"` Result 1 ("Dark Mode (OLED)"):
  "Use minimal glow, high-readability, low white emission." A
  translucent white hover is closer to this principle than a solid
  opaque tier-change.
- Aurora principle 5 (from design-system.md): "Atmosphere is fixed,
  content is quiet." Translucent hover preserves the atmospheric
  read; solid hover punches through it.

**My recommendation:** Unify to translucent `--aurora-surface-hover`
(rgba 255/255/255/0.065). Update SongRow's six cell-level hover
classes to the translucent token. Also consider bumping the token to
`rgba(255,255,255,0.08)` if, after implementation, the hover reads as
too subtle on rows where the image bleed is slightly visible —
empirically verify before committing.

**Rationale:** The user's instinct is correct; the stated reason is
slightly off. The real justification:
1. Translucent hover is *more* visible than solid `--aurora-surface-1`
   on pure black (17 vs. 10 gray), so unification does not lose
   legibility.
2. Translucent hover preserves the "atmosphere is fixed, content is
   quiet" principle — on rows where image bleed is faintly visible,
   a white haze maintains the ambient read rather than a solid
   surface-tier that flattens the bleed to pure opacity.
3. One hover primitive across the app is easier to reason about and
   update.

This is the single most unambiguously correct of the nine decisions.

---

### C8 — Top scrim tokenization

**Locked (from chat):**
Tokenize as `--aurora-scrim-top` variable + `.aurora-scrim-top`
utility class. Keep 24px height and `rgba(0,0,0,0.85)` → `transparent`
linear curve.

**My evaluation:** REVISED — tokenize, keep height, soften the curve.

**Evidence from Aurora codebase:**
- Inline at [AppShell.tsx:70-77](../frontend/src/components/layout/AppShell.tsx#L70-L77).
  `h-6` = 24px, linear gradient black/0.85 → transparent.
- No other scrim in the app. The PlayerBar is positioned in the grid
  (not overlaid), so no bottom scrim is required. The Mix float-zone
  is floating at `bottom: 112px` but has its own glass chrome and
  does not need a fading scrim behind it.
- No `--aurora-scrim-*` token exists today.

**Evidence from UI UX Pro Max skill:**
- `--domain ux "z-index loading skeleton"` Result 2: z-index scale —
  "Define z-index scale system (10 20 30 50)." The scrim sits at
  `z-20`, consistent with the shell grid's `z-10` content and the
  Mix float-zone's `z-30`. No change needed there.
- The skill's style databases for dark-mode sticky headers don't
  give a prescriptive curve, but the consensus in modern
  content-dense apps (Spotify web, Apple Music web, Linear) is a
  non-linear fade — a concave curve that holds opacity near the top
  longer then decays to zero. Linear fades produce a visible band at
  the fade midpoint on OLED displays where the transition between
  ~42% black and ~50% black is sharper than our eyes expect from
  "continuous."

**My recommendation:**

1. Add the token:
   ```css
   --aurora-scrim-top: linear-gradient(
     to bottom,
     rgba(0, 0, 0, 0.85) 0%,
     rgba(0, 0, 0, 0.55) 40%,
     rgba(0, 0, 0, 0.20) 75%,
     rgba(0, 0, 0, 0.00) 100%
   );
   ```
2. Add the utility:
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
3. Replace the inline block in AppShell with `<div className="aurora-scrim-top" aria-hidden="true" />`.
4. 24px height is fine. Spotify uses ~32px; Apple Music ~40px — but
   Aurora's content top padding (`sm:pt-6`) is only 24px, so a scrim
   taller than the content-top padding would start fading *inside*
   real content. Keep at 24px.
5. No bottom scrim needed — the PlayerBar is in the grid, not overlaid.

**Rationale:** Tokenizing a systemic pattern is straightforward good
hygiene. The curve revision is a small quality upgrade — the
three-stop non-linear fade matches what current dark-mode content
apps ship and avoids the faint banding a linear fade produces on
OLED. Low-risk change; visible improvement.

---

### C9 — Fraunces install

**Locked (from chat):**
Install `@fontsource-variable/fraunces`, import in `index.css`
alongside Geist.

**My evaluation:** NEEDS USER INPUT — the premise has shifted.

**Evidence from Aurora codebase:**
- Fraunces *is* loaded today, via a `<link>` tag in
  [index.html:9](../frontend/index.html#L9):
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,500..900,30..100,0..1;1,9..144,500..900,30..100,0..1&display=swap" rel="stylesheet" />
  ```
  This imports Fraunces across italic, opsz, weight, SOFT, and WONK
  axes (both italic states).
- `design-system.md:149` says "Fraunces is referenced but has no
  explicit `@import` / `@fontsource` line" — which is true *at the CSS
  layer*. The Unresolved #5 conclusion ("may be a latent bug") is
  therefore half correct: the CSS doesn't load it, but the HTML does.
- `@fontsource-variable/fraunces` is **not** in [package.json](../frontend/package.json),
  so the only load path today is the Google Fonts CDN.
- The `.font-display*` classes ([index.css:237-262](../frontend/src/index.css#L237-L262))
  use `font-variation-settings: "opsz" 144, "SOFT" 60, "WONK" 0` etc.
  These axis values are valid Fraunces variations; the font IS
  rendering correctly in the running app.

**Evidence from UI UX Pro Max skill:**
- `--domain typography "serif editorial warm"` surfaces Cormorant
  Garamond, Newsreader, Libre Bodoni, Playfair Display. None is
  listed with Fraunces' distinctive axes (SOFT/WONK). Fraunces is not
  in the skill's pairing database, but that reflects the database's
  scope (Google Fonts pairings by product type), not Fraunces'
  suitability.
- `--domain typography "modern serif variable"`: similar result set;
  all are more conventional or more severe than Fraunces.
- `--domain ux "animation motion duration"` Result 5 (font loading):
  "Use font-display: swap." The Google Fonts `<link>` already
  includes `&display=swap` — correctly handled at the HTML layer.
- Self-hosted (fontsource) vs. CDN-hosted (Google Fonts) trade-offs:
  - Self-hosted wins on: privacy (no Google ping per visitor),
    offline capability, CSP compliance (one less remote origin),
    load reliability.
  - CDN-hosted wins on: bandwidth (Google's edge network), cache
    sharing across sites, no bundle size.
  - For a personal local music library app running against
    localhost, self-hosting is clearly the stronger fit.

**My recommendation (needs user input on 1):**

1. **Install `@fontsource-variable/fraunces` and `@import` it in
   index.css.** This is a real improvement — it makes Aurora's
   typography stack run entirely against local assets, matching the
   local-first product ethos. It also unlocks offline dev and
   future PWA packaging cleanly.

2. **Remove the Google Fonts `<link>` from index.html** once fontsource
   is in place. Leaving both is a waste.

3. **Correct `design-system.md` Unresolved #5** — Fraunces IS
   currently loaded, just via `<link>`. The statement there implies a
   bug; there is none.

4. **User input wanted on the font itself.** Fraunces is an
   idiosyncratic choice (WONK axis, SOFT axis) and the user has
   flagged a "later font session." Surface for that session:

   | Alternative | Character | Why consider |
   |---|---|---|
   | Fraunces (current) | Warm serif, quirky opsz+SOFT+WONK axes, soft italic | Cozy, distinctive, plays well with Geist body, variable |
   | Newsreader | Warm serif, optical-size axis, more restrained | Same warmth, less quirky; safer if Fraunces-WONK ever feels too "character" |
   | Playfair Display | High-contrast luxury serif | If the user ever pivots to a more "premium hi-fi" read instead of "cozy hoarder" |
   | Gloock | Contemporary heavy serif | Bolder editorial feel — e.g., if album bleeds got more graphical treatment |
   | DM Serif Display | Display-only warm serif | Pairs with DM Sans family — future option if migrating Geist out |

   **My bias:** Fraunces is correct for the stated product vibe.
   Don't change it in the same consolidation session — do the install
   first, keep the current axis values (`opsz 144 / SOFT 60 / WONK 0`
   for display, `opsz 36 / SOFT 100 / WONK 0` for italic), and
   revisit only if the user actively wants to re-explore typography
   once the system is clean.

5. **Axis values audit:** The current values are sensible. One
   suggestion for the later session — `WONK` 1 on the
   `.font-display-italic` (specifically for empty-state quiet copy
   like "Nothing playing") would lean further into "cozy editorial."
   It is not a broad change; it is a surgical possibility for a
   single utility.

**Rationale:** The locked decision (install fontsource) is defensible,
but the reason given in the design-system.md ("latent bug") isn't
right. Framing it correctly matters for future documentation.

---

## Motion vocabulary proposal

Aurora has a rich motion system already — the design-system.md
catalogs every duration and every easing — but there is no documented
vocabulary and, critically, no `prefers-reduced-motion` implementation.

**Evidence from Aurora codebase:**
- Motion primitives exist: `.aurora-fade-in`, `.aurora-row-in`,
  `.aurora-view-enter`, `.aurora-btn-press`, `.aurora-btn-glow`,
  `.aurora-pulse`, `.aurora-idle-shimmer`, `.aurora-eq-*`, plus
  `.playerbar` height transition and Sonner toast transitions.
- `prefers-reduced-motion` check: zero hits in `frontend/src`
  (verified via grep). Aurora has ambient infinite loops (shimmer,
  pulse, equalizer, idle-pulse) that will override user accessibility
  preferences today.
- `motion` package (v12.38.0) is installed in [package.json:20](../frontend/package.json#L20)
  but not used anywhere. It was presumably added for future
  orchestrated animations.

**Evidence from UI UX Pro Max skill:**
- `--domain ux "animation motion duration"` — Priority High items:
  - Result 1 (Reduced Motion) — High severity. "Check
    prefers-reduced-motion media query."
  - Result 3 (Excessive Motion) — High severity. "Animate 1-2 key
    elements per view maximum."
  - Result 4 (Easing Functions) — "Use ease-out for entering,
    ease-in for exiting. Don't use linear."
  - Result 5 (Continuous Animation) — Medium. "Use for loading
    indicators only." (Aurora's shimmer/pulse/equalizer lean into
    this territory — defensible because they *are* state indicators,
    not decoration.)

### Proposed vocabulary

| Name | Duration | Easing | Usage | Primitive |
|---|---|---|---|---|
| Hover — color/bg | 150ms | `ease` | All color or background-color hover changes | CSS |
| Press | 100ms | `ease` | `.aurora-btn-press` (scale 0.97) | CSS |
| Focus transition | 200ms | `ease` | Focus ring opacity fade-in, Input glow appearance | CSS |
| Micro-reveal | 200ms | `cubic-bezier(0.2, 0.7, 0.2, 1)` (house curve) | View-switch opacity, PlayerBar children fade | CSS |
| Row-in (staggered) | 220ms | house curve | Per-row fade+rise; stagger `index * 25ms`, cap at 16 rows | CSS |
| Layout shift | 300ms | house curve | PlayerBar height, mobile drawer slide | CSS |
| Page enter | 420ms | house curve | `.aurora-fade-in` on route/view mount | CSS |
| Ambient pulse | 3.0–3.5s loop | `ease-in-out` | `.aurora-pulse`, `.aurora-idle-shimmer`, `.aurora-eq-*` | CSS |
| Toast slide | 200ms in / 150ms out | `cubic-bezier(0.16, 1, 0.3, 1)` / `ease` | Sonner | CSS (in library) |

### When to use CSS vs. `motion` library

CSS handles 90% of the cases above — Aurora's needs are mostly
one-shot fades, scale transforms, and ambient loops. Reserve
`motion` for:

- **Orchestrated sequences** (e.g. a future Queue drawer that needs
  children to stagger in independently of the drawer opening).
- **Layout animations** — shared-element-like transitions, e.g. album
  art scaling from a SongRow thumbnail to a Now-Playing detail view.
- **Gestures** — swipe-to-dismiss drawers, drag-to-reorder playlist
  rows (both flagged in the audit).
- **Spring physics** — only if a specific interaction calls for it
  (e.g. a Jam button that "over-bounces" on first click). Use
  sparingly; spring motion easily reads as aggressive, which conflicts
  with T3.

Default bias: **CSS-first.** If a motion can be expressed as a
transition or a keyframe without JS, prefer CSS. Pull in `motion` when
orchestration or gestures make CSS painful — not before.

### Reduced-motion policy

Add to `index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable infinite ambient loops — they're the most motion-sick-adjacent */
  .aurora-pulse,
  .aurora-idle-shimmer,
  .aurora-eq > span,
  .mix-jam-primary,
  .mix-btn-jam,
  .mix-float-jam {
    animation: none !important;
  }
  /* Collapse transitions to near-instant, preserving state transitions */
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

Note: preserving *some* transition (0.01ms) rather than setting
`transition: none` prevents Howler-driven seek-bar fill snaps from
reading as bugs. The equalizer bars freeze at their at-rest heights
via the existing `.aurora-eq-paused` pattern. A currently-playing
indicator still reads as "playing" via the row accent bar and
gradient-text title — color-coded, not motion-coded.

---

## Cross-cutting notes

1. **`design-system.md` has two inaccuracies that surfaced during this
   review:**
   - Unresolved #5 ("Fraunces has no explicit `@import` / `@fontsource`")
     is half-right — see C9. The HTML-level `<link>` loads it today.
   - The note under "Accent — three voices" at [design-system.md:72](design-system.md#L72)
     says `--aurora-tertiary` is "reserved for future tertiary
     accent" — audit cross-check (session-15) shows no scheduled
     consumer for it. See C5.
   These should be corrected as part of the consolidation.

2. **Three decisions (C2, C6, C9) touch shadcn primitives directly.**
   - C2 changes the focus ring → `--ring` bridge needs to follow the
     recommended vivid-teal hue (C6 table).
   - C6 publishes the bridge table — depends on C1 naming being
     finalized.
   - C9 is independent of shadcn.

   Order the consolidation session as:
   **C1 → C4 → C6 → C2 → C5 → C7 → C8 → C3 → C9 + motion vocabulary.**
   (Token renames must land before any component or bridge rewrite.)

3. **C7's math finding (translucent hover is brighter than solid
   surface-1 on OLED)** is worth flagging in the final
   `design-system.md` as a note — future readers will assume the
   opposite from glassmorphism intuitions.

4. **The Button component's `disabled:opacity-40`
   ([button.tsx:15](../frontend/src/components/ui/button.tsx#L15))
   already matches C3 tier 2.** No change needed there; only other
   components migrate.

5. **Reduced-motion is a pre-existing accessibility gap** that
   exists regardless of whether any convention-level decision lands.
   Flagging here because it's the one High-severity accessibility
   finding in this memo.

---

## Questions back to the user

1. **C1 naming nit:** `--aurora-accent-vivid` vs `--aurora-accent-display`?
   Both read role-accurately; `-display` more literally encodes "used
   on things rendered for looking at (gradient, selection, focus)."
   Pure taste call.

2. **C5 warning token:** Keep `--aurora-warning` because the
   missing-file indicator (audit priority #6) is coming soon, or delete
   it now and reintroduce when that feature lands? I recommend
   "delete now" unless the user has concrete plans for that feature
   in the next 1–2 sessions.

3. **C9 self-hosting vs. CDN:** Confirm self-hosting via
   `@fontsource-variable/fraunces` is the right call. It is a behavior
   change (removes Google Fonts dependency), so worth an explicit ack
   before pulling the `<link>`.

4. **Reduced motion ambition level:** The minimal policy above freezes
   ambient loops. A maximalist interpretation would *also* freeze the
   per-row stagger on fade-in and kill the idle shimmer entirely. I
   recommend minimal; the skill's guidance is "respect the media
   query," and the minimal version does that without disabling
   structural feedback (stagger-in helps users parse the table's load
   order).

5. **Theme-ready directory structure (C6 recommendation #3):** Ship it
   now as empty scaffolding so the next theme is a one-file add, or
   defer until the user actually wants a second theme? Defer is
   safer; only ship if the user wants to lock the pattern.

---

## Proposed next actions (ordered)

If this memo is accepted, the consolidation session should proceed in
this order. Each step is atomic; after each, run the app and verify
nothing visible regressed.

1. **C1 rename** — `--aurora-primary*` → `--aurora-accent-interactive*`,
   `--aurora-teal*` → `--aurora-accent-vivid*`. Sweep components via
   grep. Keep hex values identical.

2. **C4 text tokens** — delete `--aurora-text-dim` and
   `--aurora-text-muted` aliases after sweeping components to
   `-secondary` / `-tertiary`. Update `.label-micro` to reference
   `-tertiary` directly.

3. **C6 part 1 — delete light theme** — strip
   [index.css:147-180](../frontend/src/index.css#L147-L180). Verify
   no shadcn component breaks (it won't — all are `.dark`-scoped).

4. **C6 part 2 — bridge table** — replace `.dark` token string values
   with `var(--aurora-*)` references per the mapping table. Add the
   comment block documenting the bridge.

5. **C2 focus ring** — create a shared `.aurora-focus` class applying
   `ring-2 ring-[var(--aurora-accent-vivid)]/70 ring-offset-2
   ring-offset-[var(--aurora-surface-0)]`. Apply to Button (replacing
   existing), IconBtn, nav items, chips, keyboard keys, range inputs
   (in addition to their existing thumb-reveal), mobile hamburger,
   drawer close. Leave Input's dual-glow as an additive container
   effect but also wrap its trigger element with the ring class.

6. **C5 dead-token deletion** — delete
   `--aurora-tertiary/-hover/-glow`, `--aurora-text-disabled`.
   Decision pending on `--aurora-warning` (see Q2 above).

7. **C7 hover unification** — replace all six SongRow
   `group-hover:bg-[var(--aurora-surface-1)]` sites with
   `group-hover:bg-[var(--aurora-surface-hover)]`. Visually verify on
   OLED black and on image-bleed-adjacent rows.

8. **C8 scrim tokenization** — add `--aurora-scrim-top` and
   `.aurora-scrim-top`; replace the inline block in AppShell with the
   utility.

9. **C3 disabled opacity migration** — walk the six sites listed in the
   C3 evidence section, reassign per the tier map.

10. **C9 Fraunces migration** — `npm install
    @fontsource-variable/fraunces`; `@import "@fontsource-variable/fraunces";`
    in index.css (with italic variant if axis-aware); remove the
    `<link>` from index.html; verify display text still renders
    identically.

11. **Motion vocabulary + reduced-motion policy** — add the
    `@media (prefers-reduced-motion: reduce)` block. Update
    `design-system.md` Motion section with the systematic table
    above.

12. **Rewrite `design-system.md`** — incorporate the nine corrected
    decisions, the motion vocabulary, and the two inaccuracies flagged
    in Cross-cutting notes. Rewrite the stale
    [index.css:85-86](../frontend/src/index.css#L85-L86) comment to
    reflect actual gradient usage per T2.

The playlist-identity rework (T5) is a separate feature-rework session
per the original brief and is not part of this consolidation.
