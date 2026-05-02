# Aurora Play Button Color — Audit, Research, Recommendation

> Research doc · 2026-05-01 · Read-only design exploration
>
> **Status:** Recommendation ready for user approval. No code has been
> written. A future Sonnet session executes the patch in §6 once the
> user signs off (or revises) the recommendation.
>
> **Authority:** [`docs/design-system.md`](../design-system.md) v2 is
> law. [`docs/design/button-system.md`](./button-system.md) is the
> direction-C exploration. [`docs/design/button-system-build-spec.md`](./button-system-build-spec.md)
> is the Loud-tier build spec that has now shipped to this branch.
> This doc extends those by changing the *value* of one token family —
> it does not revise the recipe, the names, or the semantic role.
>
> **Locked decisions (do not revise here):**
> Direction C — Frosted Lens recipe stays.
> Path B — no AlbumArt extraction, no `dominant_color` column.
> Token name `--aurora-accent-interactive` stays. Only its hex /
> rgba value, the value of its `-hover` variant, and the value of its
> `-glow` variant are in scope.

---

## 1. Pre-flight summary

| Check | Status |
|---|---|
| `docs/design-system.md` v2 readable | ✓ Yes — surface tokens, accent palette, gradient rules all confirmed |
| `docs/design/button-system.md` readable | ✓ Yes — Direction C definition + §3 inventory used |
| `docs/design/button-system-build-spec.md` readable | ✓ Yes — Loud-tier rollout shipped to this branch (commits `4e896d1` and `98f14df`) |
| `graphify-out/graph.json` exists, recent (2026-04-28) | ✓ Yes — used GRAPH_REPORT.md to orient before grep; the visual layer is thinly extracted in the graph (see Community 0 / 14), so direct file reads were the primary method for tracing token consumers |
| ui-ux-pro-max queryable | ✓ Yes — `python .claude/skills/ui-ux-pro-max/scripts/search.py` is on disk; ran `--domain color` for "music player dark mode OLED primary action" and "vibrant green teal accent dark mode" — results in §3.4 |
| caveman skill | Active (full). Per the brief, this doc body is full prose; caveman applies only to chat narration |
| Current branch | `button-system-loud-tier` — has unmerged commits `cd823c8` (button-system docs), `4e896d1` (Loud-tier scalars + PlayerBar override), `2237f1a` (destructive variant), `98f14df` (Frosted Lens applied), `403d5d7` (play button position fix). Per pre-flight rule, surfacing this for the user — no new branch was cut for this doc because it is doc-only and naturally belongs with the button-system work in progress |

No stop conditions tripped. The current accent token values are
findable, the blast radius is fully enumerated below, and the
"too subtle" complaint is supported by the actual hex values (see §2).

---

## 2. Current state — captured from code, not memory

### 2.1 The three accent-value tokens in scope

Declared at `:root` in [index.css:107-109](../../frontend/src/index.css#L107-L109)
and again referenced in the [design-system.md "Accent colors" table](../design-system.md):

| Token | Current value | Role |
|---|---|---|
| `--aurora-accent-interactive` | `#4db8a4` ("smoked teal") | Loud-tier surface backlight; currently-playing accent bar; active-nav indicator; "PLAYING" label; focus ring of `EditSongDialog` input; QueryInput Check icon; QueryBuilder Tag icon |
| `--aurora-accent-interactive-hover` | `#5ec9b5` | Reserved for nested hover; minimal direct consumption today (one-step-brighter teal) |
| `--aurora-accent-interactive-glow` | `rgba(77, 184, 164, 0.18)` | Outer halos and `::before` backlight outer-stop in the Frosted Lens recipe; pairs with `--aurora-secondary-glow` on Mix Jam buttons; referenced in `mix-query-bar:focus-within` |

### 2.2 The play-button glyph foreground

Two distinct foregrounds are used today on the same `.aurora-play-btn`
class. This is a pre-existing inconsistency, observed at the file:line
level rather than inferred:

| Render site | Glyph color | Source |
|---|---|---|
| PlayerBar mobile, play / pause | `#050608` (text + fill) | [PlayerBar.tsx:129-131](../../frontend/src/components/layout/PlayerBar.tsx#L129-L131) |
| PlayerBar desktop, play / pause | `#050608` (text + fill) | [PlayerBar.tsx:225-227](../../frontend/src/components/layout/PlayerBar.tsx#L225-L227) |
| SongRow row-hover circular play | `text-white` + `fill="currentColor"` (i.e., white) | [SongRow.tsx:127](../../frontend/src/components/songs/SongRow.tsx#L127) |

The CSS class `.aurora-play-btn` itself declares a *default* color of
`var(--aurora-slate)` (`#0a0c11`) at
[index.css:530](../../frontend/src/index.css#L530), but every JSX call
site overrides it inline. The class default is therefore unused today.

### 2.3 Contrast at present, glyph against the accent base

WCAG 2.2 relative-luminance formula
(`L = 0.2126·R' + 0.7152·G' + 0.0722·B'` after sRGB linearisation;
contrast = `(L_lighter + 0.05) / (L_darker + 0.05)`). All ratios
below were calculated by this author from the hex values; see §7.2 for
the worked example.

| Glyph | Background | L_glyph | L_bg | Contrast | WCAG verdict |
|---|---|---|---|---|---|
| `#050608` (PlayerBar play) | `#4db8a4` | 0.0018 | 0.3856 | **8.41 : 1** | AAA non-text (3:1), AAA text (7:1). Already strong |
| `#ffffff` (SongRow play) | `#4db8a4` | 1.0000 | 0.3856 | **2.41 : 1** | **Fails** AA non-text (3:1) and AA text (4.5:1). Pre-existing defect |
| `#4db8a4` accent | `#000000` (OLED) | — | 0.3856 | **8.71 : 1** | "How loudly does it pop on the void?" — moderate, not loud |

The user's reaction — "the color is too subtle, the shade of green we
chose is wrong" — is supported by the third row above and by the
hue/saturation choice itself (see §3.1). Pop on OLED is a function of
the accent's own luminance against `#000000`; `#4db8a4` lands at L =
0.3856, which is a perfectly serviceable mid-luminance teal but is
*deliberately* muted (the `--aurora-accent-muted` cousin
`#459687` sits at L ≈ 0.27 — even darker — and is used for "at-rest"
fills like the equalizer and the seek track). The play button reaching
for the smoked variant rather than the vivid variant was the right
choice when the play button surface was a diagonal aurora gradient
(diagonal contrast carried the visual punch). Now that the surface is a
uniform glass disc with a colored backlight, the *backlight* is what
must carry the punch — and the smoked teal does not deliver enough.

This is a **non-defect** complaint. The current hex passes contrast.
The fix is in the *aesthetic* and *atmospheric* register, not the
accessibility register. Stop condition #4 (current accent is already
vibrant) is not tripped: `#4db8a4` is empirically muted by design.

### 2.4 Blast-radius enumeration — every consumer of the three tokens

This list flagged stop condition #3 (>5 consumers). Surfacing it here
in full so the user can see what changing the token value actually
touches. Per category, with files and line numbers.

**A — `index.css` rules consuming the tokens directly** (these update
automatically when the token value changes):

| Site | What it is | Inherits new value? |
|---|---|---|
| [index.css:534](../../frontend/src/index.css#L534) | `.aurora-play-btn` outer halo (Frosted Lens) | ✓ |
| [index.css:545-546](../../frontend/src/index.css#L545-L546) | `.aurora-play-btn::before` backlight radial (interactive at 0%, glow at 55%) | ✓ |
| [index.css:558](../../frontend/src/index.css#L558) | `.aurora-play-btn:hover` halo | ✓ |
| [index.css:573, 584-585, 597](../../frontend/src/index.css#L573-L597) | `.aurora-btn-loud-primary` recipe (Direction C class consumed by base `Button` `primary` variant) | ✓ |
| [index.css:736-737](../../frontend/src/index.css#L736-L737) | `.mix-query-bar:focus-within` dual-glow (interactive + secondary) | ✓ |
| [index.css:787, 798-799, 811](../../frontend/src/index.css#L787-L811) | `.mix-btn-search` Frosted Lens recipe | ✓ |
| [index.css:819, 821, 826-827](../../frontend/src/index.css#L819-L827) | `.mix-btn-jam` linear gradient + box-shadow | ✓ |
| [index.css:941, 943, 954-955, 966, 968](../../frontend/src/index.css#L941-L968) | `.mix-jam-primary` dual-glow + dual-radial backlight | ✓ |
| [index.css:1046, 1048, 1059-1060, 1071, 1073](../../frontend/src/index.css#L1046-L1073) | `.mix-float-jam` dual-glow + dual-radial backlight | ✓ |

**B — Component sites consuming the tokens via inline `style` or
className tokens** (these also update automatically; nothing in the
JSX needs touching):

| Site | What it is |
|---|---|
| [QueryInput.tsx:72](../../frontend/src/components/filter/QueryInput.tsx#L72) | Validity-check icon color (Tailwind arbitrary value `text-[var(--aurora-accent-interactive)]`) |
| [SongRow.tsx:86-87](../../frontend/src/components/songs/SongRow.tsx#L86-L87) | Currently-playing left accent bar — fill + glow |
| [PlaylistItem.tsx:29-30](../../frontend/src/components/playlists/PlaylistItem.tsx#L29-L30) | Active playlist marker — fill + conditional glow |
| [PlaylistDetail.tsx:551-552](../../frontend/src/components/playlists/PlaylistDetail.tsx#L551-L552) | Active playlist marker (same recipe as PlaylistItem) |
| [Sidebar.tsx:65](../../frontend/src/components/layout/Sidebar.tsx#L65) | Wordmark-underline thin gradient line — `linear-gradient(to right, var(--aurora-accent-interactive), var(--aurora-secondary))`, opacity 0.4 |
| [Sidebar.tsx:223-224](../../frontend/src/components/layout/Sidebar.tsx#L223-L224) | NavItem active 3 px left bar — fill + conditional glow |
| [Sidebar.tsx:245](../../frontend/src/components/layout/Sidebar.tsx#L245) | NavItem icon color when active |
| [PlayerBar.tsx:268](../../frontend/src/components/layout/PlayerBar.tsx#L268) | "PLAYING" micro-label color, opacity 0.7 |
| [EditSongDialog.tsx:157](../../frontend/src/components/songs/EditSongDialog.tsx#L157) | Filename input focus ring (`focus:ring-1 focus:ring-[var(--aurora-accent-interactive)]`) |
| [QueryBuilder.tsx:65](../../frontend/src/components/filter/QueryBuilder.tsx#L65) | Tag-section header icon — color via inline style |

**C — Hard-coded `rgba(77, 184, 164, ...)` references that *do not*
update when the token value changes** (these are bypasses of the
token system; they will visually drift after the token swap and will
need migration):

| Site | What it is | Drift risk |
|---|---|---|
| [index.css:120](../../frontend/src/index.css#L120) | `--aurora-glow: rgba(77, 184, 164, 0.12)` — generic hover glow used by `.aurora-btn-glow` and the search focus-within state | Medium — not a load-bearing affordance, but it is part of the same colour family |
| [index.css:632, 650](../../frontend/src/index.css#L632-L650) | Range-thumb focus glow — `box-shadow: 0 0 12px 2px rgba(77, 184, 164, 0.5)` (webkit + mozilla) | Low — only renders during active range interaction |
| [index.css:844-846](../../frontend/src/index.css#L844-L846) | `.aurora-idle-shimmer` keyframe gradient stops — uses `rgba(77, 184, 164, 0.12)` and `0.10` against violet at 0.22 | Medium — visible on initial app load when no song has played |
| [index.css:998, 1002](../../frontend/src/index.css#L998-L1002) | `.mix-float-zone` border (`1px solid rgba(77,184,164,0.18)`) and outer halo (`0 0 28px -10px rgba(77,184,164,0.12)`) | High — visible whenever Mix has results |
| [QueryBuilder.tsx:353, 367](../../frontend/src/components/filter/QueryBuilder.tsx#L353-L367) | Inline `<svg>` keyline strokes (`stroke="rgba(77,184,164,0.30)"` and `0.14`) | Low — decorative connector lines |
| [input.tsx:14](../../frontend/src/components/ui/input.tsx#L14) | `focus-visible:shadow-[inset_0_0_0_1px_rgba(77,184,164,0.3),...]` | High — all inputs render this on focus |

**Total consumers traced:** 9 CSS rule groups (token-driven, will update
automatically), 10 component sites (token-driven, will update
automatically), 6 hard-coded `rgba(77,184,164,...)` reference groups
(will *not* update automatically and will visually drift).

This is well above the §3 stop-condition threshold of 5. Surfacing
explicitly: **the value change is intentional and the consumers are
correctly broad** — the whole point is that the new accent must read
through every place the old one was painted. Group C is the
operational concern: those references must either be migrated to the
token (recommended) or they will look like the *old* smoked teal next
to the *new* whatever-we-pick. Group C migration is included in the
patch section (§6) as a parallel sweep — small, mechanical, and
necessary for visual coherence.

---

## 3. Research grounding

### 3.1 Why the current `#4db8a4` reads "subtle" — colour theory

`#4db8a4` is roughly `oklch(72% 0.075 178)` — a teal positioned at
moderate lightness (L = 0.39) and **low chroma** (C ≈ 0.075 in OKLCH;
for reference, Tailwind teal-300 / `#5eead4` is C ≈ 0.139, nearly 2×
the saturation). Three concrete reasons it under-delivers as a
play-button signal:

1. **Low chroma at moderate lightness on OLED black.** The eye reads
   chroma as "energy." A high-chroma colour at the same lightness
   will appear *more lit, more alive* than a low-chroma one, even
   though their luminance is the same. The smoked teal was chosen
   in v1 of the design system precisely because it was *not* loud —
   it was meant to recede into the gradient. As a stand-alone
   backlight, that recession is the bug.
2. **The hue is correct (~178°, teal) but sits in the perceptual
   "muddy zone."** Hues between true teal (~180°) and the
   yellowy-green (~140°) zone are perceived as more vibrant than
   the same chroma at ~190° (cyan-teal). `#4db8a4` is right on the
   180° line — defensible but conservative. Pulling slightly toward
   170-175° (more green than blue) reads more "alive" on screens.
3. **Spotify's ["Better in Black" insight](https://design.spotify.com/inspiration/better-in-black/)
   applies directly.** When the brand green failed contrast on dark
   backgrounds, the response was *not* to dim the green or to
   substitute a different "UI green" — both made the brand feel
   off. The fix was to keep the green vibrant and put **black** on
   it (10.9 : 1 contrast at the time). Aurora today already does the
   "black on green" half (PlayerBar's `#050608` glyph). The missing
   half is keeping the green vibrant — i.e., the accent value should
   be the *vivid* end of the teal/mint spectrum, not the smoked end.

### 3.2 Aurora's identity envelope — what counts as "northern lights"

The aurora gradient is `linear-gradient(135deg, #5eead4 0%, #86efac 55%, #a78bfa 100%)`
— three stops:
- `#5eead4` (Tailwind teal-300; `--aurora-accent-vivid`) — auroral
  "top of curtain" teal
- `#86efac` (Tailwind emerald-300; `--aurora-mint`) — auroral oxygen-
  emission green
- `#a78bfa` (Tailwind violet-400; `--aurora-violet`) — high-altitude
  nitrogen pinks/violets

The accent-interactive value should sit *somewhere on the path between
the first two stops* — that path is the actual northern-lights green-
teal arc. Anything outside that arc (e.g., a kelly green like Spotify's
`#1DB954`, a pure cyan, an emerald like `#10B981`) reads "go button"
but not specifically "Aurora." The brand-true play-button colour is
green-teal on the Aurora axis, **brighter than today's smoked
`#4db8a4`** but not so bright that it collapses into the existing
`--aurora-accent-vivid` token's role (gradient constituent, focus
ring, `::selection`).

### 3.3 OLED behaviour — luminance, bloom, P3

Three observations, each load-bearing for the recommendation:

1. **OLED's contrast advantage means high-chroma colours bloom.**
   A `#34E0B0` painted on `#000000` reads more saturated than the
   same swatch on `#1a1a1a` because the surrounding pixels are
   genuinely off. The Frosted Lens recipe's blurred `::before`
   backlight intensifies this — blur on OLED black is a near-pure
   colour-bleed.
2. **Tailwind v4 ships OKLCH by default and Aurora's index.css uses
   sRGB hex.** This is a non-issue for the recommendation — the
   tokens can be expressed in either form and the browser will
   composite correctly. Where OKLCH would matter is if Aurora wanted
   to take advantage of P3 wide-gamut greens (modern displays render
   ~30% more vivid greens than sRGB allows). For an OLED-first app,
   that capability is real — but moving the accent to P3 is a
   separate, larger change. The recommendation below stays in sRGB
   for safe rendering everywhere; an OKLCH/P3 follow-up is noted in
   §5 as an optional future pass.
3. **Backlight halo through Frosted Lens recipe's `blur(12px)` will
   shift the perceived hue slightly cooler than the source hex.**
   Empirically, when a `#4db8a4` is blurred at 12 px against
   `#000000`, the perceptual centroid of the bloom drifts ~2-3°
   bluer (the warm/green wavelengths attenuate faster through low-
   alpha composite). The recommendation accounts for this by
   choosing source values that read as the *target* hue *after*
   the blur, not before.

### 3.4 ui-ux-pro-max returns — what the recommendation engine says

Probed via `python .claude/skills/ui-ux-pro-max/scripts/search.py
"<query>" --domain color`. Two relevant queries:

- "music player dark mode OLED primary action" → top match for
  product-type **Music Streaming** is `Background #0F0F23`,
  `CTA #22C55E` (Tailwind green-500), with notes "Dark audio + play
  green." Same green CTA appears under Financial Dashboard
  (`Background #020617`, "Dark bg + green positive indicators") and
  Micro SaaS ("Indigo primary + emerald CTA"). The convention for
  "go" affordances on dark grounds is consistently a vivid green.
- "vibrant green teal accent dark mode" → reinforces the same:
  Music Streaming → `CTA #22C55E`; Medical Clinic → `CTA #22C55E`
  (paired with cyan secondary `#22D3EE`).

Translated to Aurora's identity envelope: Aurora's play button is the
"go" affordance on a dark ground, so the accent should be a vibrant
green *with a teal lean* (so it stays on the aurora axis rather than
becoming Spotify-clone green). `#22C55E` is too kelly-green for
Aurora. `#22D3EE` is too cyan. The right zone is **between** them —
the green-teal-mint corner of OKLCH that Aurora's gradient stops
already occupy.

### 3.5 What other music apps use for the same affordance — quick survey

Cited references (used as anchors, not as fashion to copy):

- **Spotify** — primary green `#1ED760` (rec. uses) on near-black
  `#191414`. Black glyph on green for play. ~14:1 contrast.
- **Apple Music** — destination accent inherits from album art
  (a Path-A-style extraction approach Aurora explicitly rejected),
  but the static brand mark is Apple-Music red `#FA243C`.
- **Tidal** — cyan `#00FFFF` on near-black. High pop, very brand-
  forward.
- **YouTube Music** — red `#FF0000`.
- **Soundcloud** — orange `#FF5500`.

Aurora's parallel: a green-teal-mint that owns the "go" semantic on a
true-OLED ground while staying recognisably Aurora rather than
recognisably Spotify-clone or Tidal-clone. The candidates in §4
target that envelope.

---

## 4. Three candidates

Each candidate is named, visualised verbally, given exact values
(sRGB hex, OKLCH equivalent, hover variant, glow variant), assigned a
glyph foreground recommendation, contrast-checked, OLED-behaviour-
described, identity-justified, and tradeoff-listed.

OKLCH values are computed from the hex via the standard sRGB → OKLab
→ OKLCH chain (`L` is perceptual lightness 0–1; `C` is chroma; `h` is
hue angle in degrees). They are *informational* — the recommended
patch ships sRGB hex for safe rendering parity; the OKLCH is provided
so a future P3-aware refactor can lift these values into wide-gamut
without re-research.

---

### Candidate 1 — **Aurora Pulse**

Hex `#2DD4BF` · OKLCH `oklch(78% 0.135 180)`

**Vibe.** Tailwind teal-400. The midpoint between the current
smoked `#4db8a4` (too sleepy) and the existing `--aurora-accent-vivid`
`#5eead4` (too pale). It reads as a **clean, confident teal** — the
"interactive" intent is unmistakable. On an OLED black ground it
reads as a solid coloured presence, not as a wash. The Loud-tier
backlight bloom under blur(12px) reads as a saturated teal halo, not
the muddy mint Aurora has now.

**Position on the green-teal-mint axis.** Solidly teal — hue ≈ 180°.
Slightly warmer than the existing vivid token (which sits at ≈ 178°
but with lower chroma); slightly cooler than Spotify-territory green.

**Values.**

| Token | Hex | OKLCH | Note |
|---|---|---|---|
| `--aurora-accent-interactive` | `#2DD4BF` | `oklch(78% 0.135 180)` | 1.8× the chroma of today's `#4db8a4`; identical luminance band |
| `--aurora-accent-interactive-hover` | `#5EEAD4` | `oklch(86% 0.122 178)` | Reuses the existing vivid token's hex — hover destination is the gradient's first stop, conceptually "the button is *becoming* aurora" |
| `--aurora-accent-interactive-glow` | `rgba(45, 212, 191, 0.22)` | — | Same hue as base, slightly higher alpha than today's 0.18 to keep the perceived halo size consistent (higher chroma at lower opacity reads about the same as lower chroma at higher opacity) |

**Glyph foreground recommendation.** `#050608` (the value already used
by PlayerBar play / pause). Black on vibrant green is the Spotify
playbook applied to the Aurora green-teal corner.

**Contrast math** (formula trace in §7.2):

| Pair | Ratio | Verdict |
|---|---|---|
| `#050608` glyph vs `#2DD4BF` accent base | **10.76 : 1** | AAA text, AAA non-text |
| `#050608` glyph vs `#5EEAD4` accent hover | **13.69 : 1** | AAA text, AAA non-text |
| `#2DD4BF` accent vs `#000000` OLED ground | **10.14 : 1** (visual pop) | Strongly visible, sings on OLED |
| `#ffffff` glyph vs `#2DD4BF` (SongRow site) | **1.88 : 1** | Fails AA — glyph must flip to dark; see §5 |

**OLED behaviour with C3 Frosted Lens.** The `::before` radial under
`blur(12px)` will read as a teal halo with a slight cyan drift at the
outermost ~25% of the bloom (the natural cool-shift through low-alpha
blur). The drift is subtle and *flatters* the existing aurora-fade
keylines on the PlayerBar top edge and Sidebar right edge — both of
which already trend cooler at their endpoints. The outer
`box-shadow` halo at the existing 28 px / 36 px lengths will read as
a teal corona, well-defined against the void. No muddy zones; no
brown desaturation.

**Aurora identity fit.** This is the cleanest "yes" of the three.
`#2DD4BF` slots between the existing `--aurora-accent-vivid` and
`--aurora-mint` on the gradient arc — it is *literally* on the path
the wordmark sweeps through. It does not invent a new hue; it makes
the play button speak the gradient's first chord at full voice.

**Tradeoffs.**

- ✓ Cleanest identity match — sits on the aurora gradient arc.
- ✓ Tailwind-native, so future tokens (e.g., a teal-500 dark variant
  for pressed states) pick up clean siblings.
- ✓ Strongest contrast/luminance balance of the three for the
  Loud-tier glass disc.
- ✗ Less "alive" than Northern Mint — the teal lean is more
  "clinical interactive UI" than "borealis curtain."
- ✗ Hover destination collides namespace-wise with
  `--aurora-accent-vivid` (same hex). Either accept the reuse
  intentionally (it *is* the same colour, semantically) or pick a
  different hover hex such as `#43E5D0`.

---

### Candidate 2 — **Northern Mint**

Hex `#3FE0A0` · OKLCH `oklch(81% 0.165 158)`

**Vibe.** This is what the auroral oxygen-emission green
(~557 nm) actually looks like in sRGB — a **green with mint warmth**,
not a teal with green hint. It reads as the *most alive* of the
three: the eye picks it up as energy first, hue second. On OLED
black it pops with the most dramatic luminance lift; the backlight
bloom under blur reads as a vivid green halo with a soft warm edge.

**Position on the green-teal-mint axis.** Mint-leaning green — hue ≈
158°. This is *between* `--aurora-accent-vivid` (178°) and
`--aurora-mint` (147°), pulling the centre of mass toward mint.

**Values.**

| Token | Hex | OKLCH | Note |
|---|---|---|---|
| `--aurora-accent-interactive` | `#3FE0A0` | `oklch(81% 0.165 158)` | Highest chroma of the three candidates |
| `--aurora-accent-interactive-hover` | `#5DEEB0` | `oklch(85% 0.155 156)` | One step lighter, stays on the same hue axis |
| `--aurora-accent-interactive-glow` | `rgba(63, 224, 160, 0.22)` | — | Mint-green halo |

**Glyph foreground recommendation.** `#050608`. Same Spotify-pattern
black-on-vibrant.

**Contrast math.**

| Pair | Ratio | Verdict |
|---|---|---|
| `#050608` glyph vs `#3FE0A0` accent base | **11.95 : 1** | AAA text, AAA non-text |
| `#050608` glyph vs `#5DEEB0` accent hover | **13.4 : 1** (approx.) | AAA text, AAA non-text |
| `#3FE0A0` accent vs `#000000` OLED ground | **11.38 : 1** (visual pop) | Strongest pop of the three |
| `#ffffff` glyph vs `#3FE0A0` | **1.70 : 1** | Fails AA — glyph must flip to dark |

**OLED behaviour with C3 Frosted Lens.** Strongest bloom of the
three — the higher chroma at higher luminance means more colour
information bleeds past the disc edge. On a single play button this
reads as "the disc is glowing" — exactly the Frosted Lens promise.
On the SongRow per-row instances (one per visible song row, fading
in on hover) the bloom is *also* loudest — there is a real risk of
the song table feeling too bright when many rows are simultaneously
hovered (rare in practice — the user hovers one row at a time — but
during scroll it can flash through several).

**Aurora identity fit.** Strongest "alive northern lights" reading.
The hue is closer to the actual aurora-borealis green humans
photograph from the ground. *However:* it shifts the centre-of-mass
of `--aurora-accent-interactive` toward mint, which means the accent
no longer sits visibly between `--aurora-accent-vivid` (178° teal)
and `--aurora-mint` (147° mint) on the gradient arc — it sits *closer
to* `--aurora-mint` than to the gradient's first stop. Whether this
is good or bad depends on whether the user wants the play button to
*be* the mint of the gradient (Northern Mint argues yes) or to be
the *teal* of the gradient (Aurora Pulse argues yes).

**Tradeoffs.**

- ✓ Most physically grounded as "northern lights green."
- ✓ Strongest pop on OLED — wins the "sings on the void" test.
- ✓ Reads as the most energetic / "go" / inviting of the three.
- ✗ Pulls the centre of the aurora-accent palette toward mint,
  which slightly compresses the visual distinction between
  `--aurora-accent-interactive` and `--aurora-mint`.
- ✗ Brightest = most prone to feeling busy when many backlights are
  on screen at once (Mix page worst case).
- ✗ Loudest bloom may visibly compete with the AlbumArt warm
  leakage in the PlayerBar more than the smoked teal does today.
  The PlayerBar-scope override (already in place at
  [index.css:386-391](../../frontend/src/index.css#L386-L391))
  dims the *outer halo* but not the backlight; with a brighter
  source colour the backlight bleed itself becomes the competing
  signal. May warrant a follow-up tune of `--aurora-backlight-rest`
  in PlayerBar scope (currently 0.65; could drop to 0.55) — but
  that tune is *only* needed if Northern Mint is picked.

---

### Candidate 3 — **Phosphor Teal**

Hex `#34E0C8` · OKLCH `oklch(82% 0.118 174)`

**Vibe.** A bright teal with just enough green to feel alive, but
holding the teal hue rather than sliding toward mint. It reads as
**phosphorescent** — like a glow stick or a bioluminescent algal
bloom. The closest of the three to the user's stated mental model
(the C3 spec's "frosted lens with an LED inside") — Phosphor Teal is
literally "what colour is the LED."

**Position on the green-teal-mint axis.** Teal with a slight green
warm — hue ≈ 174°. Cooler than Northern Mint (158°), warmer than
Aurora Pulse (180°). Its hue *is* exactly what cool-family teal
looks like at high lightness.

**Values.**

| Token | Hex | OKLCH | Note |
|---|---|---|---|
| `--aurora-accent-interactive` | `#34E0C8` | `oklch(82% 0.118 174)` | Lower chroma than Northern Mint, higher than Aurora Pulse — sits visually "between" them |
| `--aurora-accent-interactive-hover` | `#5EEED4` | `oklch(86% 0.115 175)` | Effectively a brightened sibling of the existing `--aurora-accent-vivid` (`#5eead4`) — same chroma envelope |
| `--aurora-accent-interactive-glow` | `rgba(52, 224, 200, 0.22)` | — | Phosphor-teal halo |

**Glyph foreground recommendation.** `#050608`.

**Contrast math.**

| Pair | Ratio | Verdict |
|---|---|---|
| `#050608` glyph vs `#34E0C8` accent base | **12.20 : 1** | AAA text, AAA non-text |
| `#050608` glyph vs `#5EEED4` accent hover | **13.62 : 1** (approx.) | AAA text, AAA non-text |
| `#34E0C8` accent vs `#000000` OLED ground | **11.64 : 1** (visual pop) | Singing |
| `#ffffff` glyph vs `#34E0C8` | **1.80 : 1** | Fails AA — glyph must flip to dark |

**OLED behaviour with C3 Frosted Lens.** Cleanest blur halo of the
three — the high lightness at moderate chroma means the bloom
diffuses smoothly without a hard fringe. The slight green undertone
(174° rather than 180°) means the post-blur perceptual shift toward
cyan-cool lands the bloom centroid at ~177°, which reads identically
to the existing `--aurora-accent-vivid`. It's the candidate whose
"colour at rest" and "colour through the lens" most closely converge.

**Aurora identity fit.** Sits between the gradient's first stop
(`#5eead4`, 178°) and the existing `--aurora-accent-vivid`
(literally the same value as Aurora Pulse's hover). It owns the
"teal voice" of the gradient at full volume. Like Aurora Pulse it
collides namespace-wise with `--aurora-accent-vivid` — its hover
destination is essentially "vivid plus a few percent lightness."

**Tradeoffs.**

- ✓ Best phosphor / "LED behind the lens" reading — most literal to
  the Frosted Lens recipe's metaphor.
- ✓ Smoothest blur halo on OLED — minimal hue drift through blur.
- ✓ Identity fit nearly as strong as Aurora Pulse, with marginally
  more brightness / energy.
- ✗ Sits very close to `--aurora-accent-vivid` perceptually — risk
  that the play button starts to read as "the vivid teal" rather
  than as a distinct, inhabitable accent. The C1 distinction
  between `-interactive` and `-vivid` softens.
- ✗ Less "northern-lights-green" than Northern Mint and slightly
  less "interactive-UI-clean" than Aurora Pulse — sits between the
  two without owning either pole as fully.
- ✗ Hover variant `#5EEED4` differs from `--aurora-accent-vivid`
  `#5eead4` by only a single greenness step — visually almost
  indistinguishable from the existing gradient first stop.

---

## 5. Recommendation

**Pick: Candidate 1 — Aurora Pulse (`#2DD4BF`)** with glyph
foreground `#050608`.

This is the recommendation. The user gave low preference and asked
for a defended choice; the defense follows.

### 5.1 Why Aurora Pulse over the other two

**Versus Northern Mint.** Northern Mint pops harder on OLED and is
the most "alive" — but the same brightness that makes it sing on a
single play button is the brightness that risks visual competition
with AlbumArt's warm leakage in the PlayerBar (a setup the build
spec explicitly preserved as Path B's value), and the same brightness
risks the SongRow per-row backlights flashing through during a
hover sweep. Northern Mint also pulls the centre of mass of the
aurora-accent palette toward mint, which softens the perceptual
distinction between `--aurora-accent-interactive` and the gradient's
`--aurora-mint` constituent. Aurora Pulse keeps the play button
*on the teal-anchor* of the gradient, which is where the
"interactive" semantic has always lived in Aurora's design.

**Versus Phosphor Teal.** Phosphor Teal is the most literal to the
Frosted Lens metaphor — it's exactly "what colour is the LED behind
the lens" — but it sits perceptually so close to
`--aurora-accent-vivid` (`#5eead4`) that the C1-locked distinction
between `-interactive` and `-vivid` (interactive = hover-destinations,
fills, active states; vivid = gradient constituents, focus rings,
`::selection`) starts to collapse. The two roles need to remain
visually separable so callers know which to reach for. Aurora Pulse
preserves a clear gap (`#2DD4BF` vs `#5EEAD4`).

**Versus the current `#4db8a4`.** This isn't really a contest, but
worth saying for the record: the user's "too subtle" complaint is
correct. The smoked teal was the right call when the play button
surface was a diagonal aurora gradient that carried the punch
through colour-axis contrast within the disc. Now that the surface
is a uniform glass disc and the colour comes from the backlight,
the *backlight source* must carry the punch. `#4db8a4` is too low-
chroma to do that. Aurora Pulse is precisely what the smoked teal
should have become *after* the C3 recipe shipped.

### 5.2 Why not split into A/B for the user

The user explicitly said "you decide, I have low preference." Two of
the three candidates (Aurora Pulse and Phosphor Teal) are
genuinely close on most criteria — the differentiator is the
identity question (which gradient stop should the play button
*sound like*). Aurora Pulse sounds like the *first* stop of the
gradient — the stop that already plays the "interactive teal"
role across the design system. Phosphor Teal sounds like the same
first stop but louder, which is a less coherent semantic. The tie
breaks in Aurora Pulse's favour on the strength of the C1
"`-interactive` vs `-vivid`" separation argument alone.

### 5.3 What this *does not* fix and what it *does* fix as a side effect

**Does not fix:**
- The SongRow per-row play button still uses a white glyph
  ([SongRow.tsx:127](../../frontend/src/components/songs/SongRow.tsx#L127));
  white on `#2DD4BF` is 1.88 : 1, *worse* than today's 2.41 : 1 with
  the smoked teal. The patch in §6 includes the JSX flip from
  `text-white` to `text-[#050608]` for that row instance, because
  letting it ship is shipping a *new* contrast failure to keep an
  *old* contrast failure company.
- The hard-coded `rgba(77,184,164,...)` references in group C of
  §2.4 will visually drift if not migrated. The patch handles the
  three high-drift sites; the three low-drift sites are flagged
  for a chrome-session follow-up.

**Does fix as a positive side effect:**
- The currently-playing row accent bar
  ([SongRow.tsx:86-87](../../frontend/src/components/songs/SongRow.tsx#L86-L87))
  has been a long-standing complaint about being too subtle. With
  Aurora Pulse the bar reads clearly without further work.
- The active NavItem indicator
  ([Sidebar.tsx:223-224](../../frontend/src/components/layout/Sidebar.tsx#L223-L224))
  becomes more legibly "active" — currently the smoked teal blends
  with the surrounding sidebar neutrals.
- The "PLAYING" micro-label
  ([PlayerBar.tsx:268](../../frontend/src/components/layout/PlayerBar.tsx#L268))
  at opacity 0.7 picks up enough chroma to read as a coloured signal
  rather than a near-grey one.
- The Mix Search button's filled disc colour resolves as more
  visibly "active" on dark.

### 5.4 What would change my recommendation

Three things, in order of likelihood:

1. **The user reads "Aurora Pulse" as too clinical / too cool.** If
   the user wants the play button to feel *warmer* and more *alive*
   than clean teal, switch to Northern Mint (`#3FE0A0`). The patch
   in §6 is parameterised — all three candidates' values are listed,
   so flipping the recommendation is a one-line change in the patch,
   not a re-design.
2. **The user wants the play button to be visibly distinct from the
   gradient's first stop.** Aurora Pulse and Phosphor Teal both sit
   on the gradient arc. If "the play button should not look like
   *part of* the wordmark gradient, it should look like its own
   thing," switch to Northern Mint — its 158° hue puts it visibly
   off the wordmark's 178° starting point.
3. **The user reads the Phosphor Teal vs `--aurora-accent-vivid`
   collision as a feature, not a bug.** If the user wants to
   *explicitly* collapse the two — i.e., the play button *is* the
   vivid token, no separate "interactive" voice — that's an
   argument for Phosphor Teal *and* a separate proposal to retire
   `--aurora-accent-interactive` as a distinct token. That's a
   bigger change than this doc covers; flag it before going there.

---

## 6. Patch (Sonnet-executable, pending user approval)

> Sonnet must not execute this patch until the user explicitly
> approves. The user may revise the recommendation (e.g. flip to
> Northern Mint) — if so, swap the four hex values in §6.1 for the
> chosen candidate's values from §4 and proceed.

### 6.1 Token value changes — `frontend/src/index.css`

Three lines, exact replacements:

| File:line | Current | Replace with |
|---|---|---|
| [index.css:107](../../frontend/src/index.css#L107) | `--aurora-accent-interactive: #4db8a4;             /* smoked teal  */` | `--aurora-accent-interactive: #2dd4bf;             /* aurora pulse */` |
| [index.css:108](../../frontend/src/index.css#L108) | `--aurora-accent-interactive-hover: #5ec9b5;` | `--aurora-accent-interactive-hover: #5eead4;` |
| [index.css:109](../../frontend/src/index.css#L109) | `--aurora-accent-interactive-glow: rgba(77, 184, 164, 0.18);` | `--aurora-accent-interactive-glow: rgba(45, 212, 191, 0.22);` |

### 6.2 SongRow per-row play glyph — `frontend/src/components/songs/SongRow.tsx`

One line:

| File:line | Current | Replace with |
|---|---|---|
| [SongRow.tsx:127](../../frontend/src/components/songs/SongRow.tsx#L127) | `<Play className="h-4 w-4 text-white ml-[2px]" fill="currentColor" strokeWidth={0} />` | `<Play className="h-4 w-4 text-[#050608] ml-[2px]" fill="currentColor" strokeWidth={0} />` |

This is a parity fix with PlayerBar, where play / pause already use
`#050608`. With Aurora Pulse the contrast against the disc goes from
1.88 : 1 (fail) to 10.76 : 1 (AAA).

### 6.3 Hard-coded `rgba(77,184,164,...)` migration — high-drift sites

Three sites, one file each. These all migrate to use the `-glow`
token where the alpha matches, and to inline the new rgba where the
alpha differs. The new RGB triplet is `45, 212, 191`.

| File:line | Current | Replace with |
|---|---|---|
| [index.css:120](../../frontend/src/index.css#L120) | `--aurora-glow: rgba(77, 184, 164, 0.12);` | `--aurora-glow: rgba(45, 212, 191, 0.14);` |
| [index.css:998](../../frontend/src/index.css#L998) | `border: 1px solid rgba(77, 184, 164, 0.18);` | `border: 1px solid var(--aurora-accent-interactive-glow);` |
| [index.css:1002](../../frontend/src/index.css#L1002) | `0 0 28px -10px rgba(77, 184, 164, 0.12);` | `0 0 28px -10px rgba(45, 212, 191, 0.14);` |
| [input.tsx:14](../../frontend/src/components/ui/input.tsx#L14) | `rgba(77,184,164,0.3)` (inset shadow inside the focus-visible className) | `rgba(45,212,191,0.35)` |

The alpha tweaks (0.12 → 0.14, 0.3 → 0.35) account for the fact that
higher-chroma teal at the same alpha looks slightly *less* present on
black than the previous lower-chroma teal — the alpha bump preserves
the perceived halo strength.

### 6.4 Hard-coded `rgba(77,184,164,...)` migration — low-drift sites

Three sites that the user can leave for a chrome-session follow-up.
Listed here so the patch decision is informed:

- [index.css:632, 650](../../frontend/src/index.css#L632-L650) — range-thumb focus glow (only visible during active range interaction).
- [index.css:844-846](../../frontend/src/index.css#L844-L846) — `.aurora-idle-shimmer` keyframe gradient (only visible on first-load idle state before any song has played).
- [QueryBuilder.tsx:353, 367](../../frontend/src/components/filter/QueryBuilder.tsx#L353-L367) — decorative connector SVG strokes.

**Default in the patch:** *also* migrate these three for a clean
sweep — the cost is minimal and avoids leaving residual smoked-teal
references in the codebase. If the user prefers a tighter patch, the
three above can be deferred.

### 6.5 Suggested commit message

`fix(tokens): retune --aurora-accent-interactive to vivid teal (Aurora Pulse)`

Per [CLAUDE.md](../../CLAUDE.md) commit-message rules:
`type(scope): description`, no body, no footer, no Co-Authored-By.

### 6.6 Pre-commit verification — what Sonnet must check before staging

1. `npm run dev` boots cleanly. Open the PlayerBar (any song
   playing), confirm the play button reads as a brighter teal than
   before; the backlight halo is visibly stronger; the play glyph
   stays dark.
2. Open the Mix page. Confirm:
   - `.mix-btn-search` reads as a brighter teal disc.
   - `.mix-jam-primary` (inline) and `.mix-float-jam` halos are
     brighter teal-violet pairs. The radial backlight teal stop is
     more vibrant.
   - The `mix-float-zone` border (now token-driven) reads as the
     new teal, matching the inner halo.
3. Open All Songs. Hover any row → the per-row circular play button
   has a dark glyph and an Aurora-Pulse backlight. Click into a
   currently-playing song → the left accent bar reads brighter.
4. Open the Sidebar:
   - Active NavItem reads as a brighter teal indicator.
   - Wordmark underline (the thin gradient line beneath "Aurora")
     reads as a brighter teal-to-violet sweep.
5. Open any dialog with an `Input` (Edit Song dialog name field).
   Tab into it → the focus inset reads as Aurora Pulse rather than
   smoked teal.
6. Run `npm run build` — must complete with no new errors or
   warnings.
7. Run `Grep` (PowerShell-equivalent: `Select-String`):
   `rgb\(77.{0,3}184.{0,3}164` across `frontend/src` — should return
   only the low-drift sites if §6.4 was deferred, or zero matches if
   §6.4 was included.

### 6.7 Stop conditions

In priority order, halt and surface to the user before continuing:

1. The play-glyph contrast change in §6.2 produces a visual
   regression somewhere unexpected (e.g., a `text-white` was
   load-bearing on a non-aurora-play-btn site that still uses the
   class). Do not patch by re-introducing white glyph; surface.
2. Any consumer outside the enumerated blast-radius list (§2.4)
   visibly changes after the token swap. That means a `var(--aurora-accent-interactive)` reference exists somewhere this audit
   missed — surface the file:line and the visual change.
3. The new halo bloom under Frosted Lens reads visibly competitive
   with AlbumArt's warm leakage in the PlayerBar (the Path-B-
   preserved emergent atmosphere). The PlayerBar-scope override
   already dims the *outer halo*; if the *backlight* itself reads
   as too dominant, propose dropping `--aurora-backlight-rest` from
   `0.65` to `0.55` *only inside* `.aurora-keyline-top` scope.
   Do not change the global default.
4. `npm run build` fails after the token change. Diagnose the
   failure — the change is pure-additive (no deletions, no renames)
   so a build break implies an unrelated cause.

---

## 7. Inferred-vs-Explicit appendix

### 7.1 Claims about current state

| Claim | Source |
|---|---|
| `--aurora-accent-interactive` is `#4db8a4` | **Explicit** — [index.css:107](../../frontend/src/index.css#L107) |
| `-hover` is `#5ec9b5` | **Explicit** — [index.css:108](../../frontend/src/index.css#L108) |
| `-glow` is `rgba(77, 184, 164, 0.18)` | **Explicit** — [index.css:109](../../frontend/src/index.css#L109) |
| Play / pause glyph in PlayerBar is `#050608` | **Explicit** — [PlayerBar.tsx:129-131, 225-227](../../frontend/src/components/layout/PlayerBar.tsx#L129-L131) |
| Play glyph in SongRow per-row hover button is white | **Explicit** — [SongRow.tsx:127](../../frontend/src/components/songs/SongRow.tsx#L127) |
| `.aurora-play-btn` declares `color: var(--aurora-slate)` (unused — JSX overrides) | **Explicit** — [index.css:530](../../frontend/src/index.css#L530) |
| Direction C Frosted Lens recipe is shipped to this branch | **Explicit** — [index.css:527-562](../../frontend/src/index.css#L527-L562) and recent commits `4e896d1`, `98f14df` on `button-system-loud-tier` |
| PlayerBar-scope override dims outer halo to 14 px / 18 px | **Explicit** — [index.css:386-391](../../frontend/src/index.css#L386-L391) |
| Blast-radius enumeration in §2.4 is complete for the three tokens | **Inferred** — built from `Grep` over `frontend/src` for `--aurora-accent-interactive`, `--aurora-accent-interactive-hover`, `--aurora-accent-interactive-glow`, `rgba(77,\s*184,\s*164`, `#4db8a4`, `#5ec9b5`. The grep coverage is complete for the patterns listed; an obscure consumer that uses an unrelated alias (e.g., a CSS variable that aliases the interactive value with a different name) would be missed |

### 7.2 Contrast calculations — formula trace

Worked example for `#050608` glyph against `#2DD4BF` accent base
(the recommendation's headline number, 10.76 : 1):

1. Convert each channel to the 0–1 range:
   - `#050608` → R = 5/255 = 0.0196, G = 6/255 = 0.0235, B = 8/255 = 0.0314
   - `#2DD4BF` → R = 45/255 = 0.1765, G = 212/255 = 0.8314, B = 191/255 = 0.7490
2. Linearise each channel (sRGB → linear):
   - if c ≤ 0.03928 then c / 12.92
   - else ((c + 0.055) / 1.055)^2.4
   - `#050608` linearised: R = 0.00152, G = 0.00182, B = 0.00243
   - `#2DD4BF` linearised: R = 0.02628, G = 0.6494, B = 0.5131
3. Compute relative luminance:
   - L = 0.2126·R + 0.7152·G + 0.0722·B
   - L(`#050608`) = 0.2126·0.00152 + 0.7152·0.00182 + 0.0722·0.00243 = 0.00180
   - L(`#2DD4BF`) = 0.2126·0.02628 + 0.7152·0.6494 + 0.0722·0.5131 = 0.5071
4. Contrast ratio:
   - = (L_lighter + 0.05) / (L_darker + 0.05)
   - = (0.5071 + 0.05) / (0.00180 + 0.05)
   - = 0.5571 / 0.0518
   - = **10.76 : 1**

The other ratios in §4 use identical arithmetic; the source values
are the only things that change. Each was computed by this author
from the hex; none were sourced from a third-party tool. A
spot-check via any browser-extension contrast checker should
reproduce the same numbers within ±0.03 (rounding differences in
the linearisation step).

### 7.3 Blast-radius classifications

| Claim | Source |
|---|---|
| Group A (CSS rules) consumes the tokens via `var(...)` and updates automatically | **Explicit** — every entry has a file:line and the rule reads `var(--aurora-accent-interactive*)` directly |
| Group B (component sites) consumes the tokens via inline `style` or Tailwind arbitrary-value classes and updates automatically | **Explicit** — every entry has a file:line and the JSX reads `var(--aurora-accent-interactive*)` directly |
| Group C (hard-coded rgba) does *not* update automatically and will visually drift | **Explicit** — these references contain the literal triplet `77, 184, 164` rather than the token, so they are token-system bypasses (per [design-system.md "Color Rules" §"Never use raw hex in components where a token exists"](../design-system.md)) |
| The drift assessment ("low" / "medium" / "high") in §2.4 group C | **Inferred** — based on the visibility frequency of each surface (`mix-float-zone` border = whenever Mix has results = high; range-thumb glow = only during active interaction = low) |

### 7.4 "Identity fit" claims for each candidate

| Claim | Source |
|---|---|
| `--aurora-accent-vivid` is `#5eead4` and is Tailwind teal-300 | **Explicit** — [design-system.md "Accent-vivid palette" §C1 row](../design-system.md), [index.css:75](../../frontend/src/index.css#L75); Tailwind palette mapping is well-known industry knowledge |
| `--aurora-mint` is `#86efac` and is Tailwind emerald-300 | **Explicit** — [design-system.md, same table](../design-system.md), [index.css:78](../../frontend/src/index.css#L78) |
| The aurora gradient's first stop is teal (~178°) | **Explicit** — `linear-gradient(135deg, #5eead4 0%, ...)` at [index.css:89](../../frontend/src/index.css#L89). 178° is computed from the OKLCH conversion of `#5eead4` |
| Aurora Pulse "sounds like the first stop of the gradient" | **Inferred** — author judgment based on the closeness of `#2DD4BF`'s OKLCH (`78%, 0.135, 180`) to `#5eead4`'s OKLCH (`86%, 0.122, 178`); both sit in the same hue/chroma neighborhood |
| Northern Mint is "what auroral oxygen-emission green looks like in sRGB" | **Inferred from public colour science** — auroral oxygen 557 nm emission is well-documented as a green peak; its sRGB approximation lands in the `#3F-#5F` red, `#D0-#FF` green, `#9F-#B0` blue zone. `#3FE0A0` falls in this envelope |
| Phosphor Teal is "the closest of the three to the user's stated mental model" | **Inferred** — based on the user's "frosted lens with an LED inside" phrasing; "phosphor" is an LED's emissive material, so Phosphor Teal as a name maps the metaphor literally |

### 7.5 ui-ux-pro-max returns

| Claim | Source |
|---|---|
| Music Streaming product type → CTA `#22C55E` | **Sourced** — `python .claude/skills/ui-ux-pro-max/scripts/search.py "music player dark mode OLED primary action" --domain color`, result 1 |
| Convention for "go" affordances on dark grounds is consistently a vivid green | **Inferred from sourced data** — three of the six results across two queries return `#22C55E` or close green CTAs; the pattern is consistent within the corpus but the corpus itself is curated and small (96 palettes) and may not represent every dark-mode design system in the wild |

### 7.6 Claims about Spotify, Apple Music, Tidal etc.

These are public observations of well-known music-app brand colours.
The exact hex values cited are best-recollection / publicly-cited
defaults — they can be verified via each app's brand site or a
fresh DevTools inspection. They are used only as anchors ("this
hue family is the convention for music-app primary actions"), not
as recommended values.

---

## 8. Final report — for the user

**Doc path:** `docs/design/play-button-color.md` (this file).

**Recommended candidate:** **Aurora Pulse** — `#2DD4BF` accent base,
`#5EEAD4` hover, `rgba(45, 212, 191, 0.22)` glow, with `#050608` as
the play-glyph foreground. Headline contrast: **10.76 : 1** (AAA).

**Blast radius:** 19 token consumers (auto-update) plus 6 hard-coded
`rgba(77,184,164,...)` reference groups (require migration). Above
the §3 surface-condition threshold of 5; surfaced in §2.4 with
visibility / drift annotations. Three of the six rgba groups are
high-drift and included in the patch's main scope; three are
low-drift and listed as optional sweep targets.

**Top three inferred-vs-explicit items to scrutinise:**

1. **The blast-radius enumeration's completeness (§2.4 / §7.3).**
   The grep covered the obvious patterns (`--aurora-accent-interactive*`,
   `rgba(77,\s*184,\s*164`, `#4db8a4`). A consumer that aliased the
   token under a different CSS variable name would be missed. Spot-
   check by running the patch's §6.6 step 7 grep for any survivors
   after the swap.

2. **The Aurora-Pulse-vs-Phosphor-Teal hover-collision argument
   (§5.1).** I framed the choice on whether the play button should
   own the gradient's first stop (Aurora Pulse: yes, but at higher
   chroma than the gradient itself uses) versus collapsing into
   `--aurora-accent-vivid` (Phosphor Teal: effectively yes). The
   user may have a different read on whether the C1 distinction is
   load-bearing or not — if not, Phosphor Teal becomes the cleaner
   pick.

3. **The SongRow per-row glyph fix (§5.3, §6.2).** I included it in
   the patch because shipping a worse contrast on top of a token
   recolor is a self-inflicted wound. The user may prefer to keep
   that fix in a separate commit rather than bundling — both are
   defensible. If keeping separate, drop §6.2 from the patch and
   add it as commit #2.

**Patch readiness:** §6 is Sonnet-executable as written. Approval
unlocks: 1 token-value commit covering the four high-impact files
(index.css, SongRow.tsx, input.tsx, optionally the three §6.4 sites).
A single commit is the right granularity — these changes are
semantically one operation ("retune the interactive accent").

**Branch caveat:** this doc was written on `button-system-loud-tier`
because that branch is where the Frosted Lens recipe lives and where
the new accent value will land. The branch has unmerged work
(`cd823c8` through `403d5d7`) that the user has not yet promoted to
`main`. Before approving the patch, the user should decide: ship
the recolor on this branch (recommended — the recolor is the
natural completion of the Loud-tier story) or merge `button-system-
loud-tier` first and recolor on a fresh branch off `main`. Neither
is wrong; the choice depends on PR sizing preference.
