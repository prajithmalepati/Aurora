# Aurora Quick-Wins — Build Spec

> Read-only audit · 2026-05-06
>
> **Scope.** Prescriptive build spec for the quick-win polish fixes
> identified in [`docs/design/aesthetic-audit.md`](./aesthetic-audit.md)
> §7 (and supporting findings in §5.2, §5.3, §5.4, §5.5, §5.6, §5.8,
> §5.9, §5.10). A future Sonnet session executes against this doc.
>
> **Authority.** [`docs/design-system.md`](../design-system.md) v2 stays
> law. [`docs/design/button-system.md`](./button-system.md) Direction C
> Frosted Lens is locked. [`docs/design/play-button-color.md`](./play-button-color.md)
> Aurora Pulse `#2DD4BF` accent is shipped.
>
> **Calibration.** No fix in this spec adds interaction-delay cost. All
> fixes are atmospheric/typographic/structural polish. No design-system
> revision is required.

---

## 1. Pre-flight status

| Check | Result |
|---|---|
| `docs/design/aesthetic-audit.md` readable | ✓ revision 2026-05-05 |
| `docs/design-system.md` v2 readable | ✓ revised 2026-04-23 |
| `docs/design/button-system.md` readable | ✓ Direction C Frosted Lens locked |
| `docs/design/play-button-color.md` readable | ✓ Aurora Pulse `#2DD4BF` shipped |
| `graphify-out/graph.json` recent | ⚠ Last update 2026-04-28 (pre Aurora-Pulse retune of 2026-05-01). Structural shape unchanged (`albumGradient`, `AlbumArt`, `PlayerBar`, `Sidebar`, `QueryBuilder` communities intact). Used for orientation only; consumer enumeration verified by direct grep. **Limitation:** if the future session re-runs `graphify update .` first, this caveat dissolves |
| ui-ux-pro-max queryable | ✓ |
| Current branch | `master` (loud-tier merged) ✓ |
| Working tree | Untracked: `docs/design/aesthetic-audit.md`, `docs/design/audit-screenshots/`. **No staged changes**. The Sonnet session must commit / stash these before starting (or treat them as input artefacts and not lose them) |

---

## 2. Locked context — workflow upgrade rationale

The C3 button-system build hit a regression because `.aurora-play-btn`
was a shared class across two contexts (the PlayerBar large play button
and the SongRow small row-hover play button). The fix prompt did not
audit blast radius — it built straight from spec, and the recipe
assumption broke the SongRow context.

This spec exists to prevent that pattern. Every fix below is preceded
by a consumer enumeration. Where a class/token/style is reused across
visually-divergent contexts, it is flagged. Where the fix's intent
applies cleanly to all consumers, that is stated explicitly. **No
finding in this spec required a class split** — see §6.

---

## 3. The seven quick-win fixes

The aesthetic audit's §7 names six quick wins and §6 names a seventh
"verification + maybe-fix" item (§5.5). After verification (§5 below),
that item drops out — leaving six fixes plus one drop-through verdict.

| Tag | Fix | Audit reference | Files |
|---|---|---|---|
| **A** | AlbumArt bleed alpha bump | §5.2, §5.6, §6, §7 | `frontend/src/lib/albumGradient.ts` |
| **B** | Empty-state italic-to-sans (status copy only) | §5.8, §6, §7 | `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/components/tags/TagEditor.tsx` |
| **C** | PlayerBar artist-row visual mass | §5.3, §6 | `frontend/src/components/layout/PlayerBar.tsx` |
| **D** | Sidebar wordmark hairline lift | §5.4 fix 1, §7 | `frontend/src/components/layout/Sidebar.tsx` |
| **E** | Tag-dot Aurora Pulse tint | §5.4 fix 2, §7 | `frontend/src/components/layout/Sidebar.tsx` |
| **F** | Smoked-teal → Aurora Pulse SVG color migration (3 deferred sites) | §5.9, §7, `play-button-color.md` §6.4 | `frontend/src/index.css`, `frontend/src/components/filter/QueryBuilder.tsx` |
| **G** | PlayerBar song-change cross-fade | §5.10, §7 | `frontend/src/components/layout/PlayerBar.tsx` |
| ~~§5.5~~ | Currently-playing-row indicator verification | §5.5, §6 priority 4 | **DROPPED — see §5 below.** Indicator code correct, no fix required |

---

## 4. Per-fix blast-radius enumeration

### Fix A — AlbumArt bleed alpha bump

**Spec from audit (§5.2 recommended fix).** Raise `art.glow` HSLA alpha
from `0.25` to **`0.30`** (audit's middle-of-range recommendation;
covers the "perceptually atmospheric without becoming loud" target).

**Exact change.** Single line edit at
[`albumGradient.ts:60`](../../frontend/src/lib/albumGradient.ts#L60):

```ts
// Before
const glow = `hsla(${a.h}, ${a.s}%, ${a.l}%, 0.25)`
// After
const glow = `hsla(${a.h}, ${a.s}%, ${a.l}%, 0.30)`
```

**Audit caveat applied.** §5.2 also offers an alternative (raise blur
24px → 32px) and a smaller dual-knob (alpha 0.30 + blur 28px). The
build picks the alpha-only variant at 0.30 because (a) single-line
diff, (b) leaves the geometry untouched so the play-button-vs-bleed
non-collision math from `button-system.md` §7.1 stays valid, (c) the
audit's §10.6 item 1 explicitly asks the user to preview before
committing — alpha-only is the most reversible knob.

**Consumer enumeration of `albumGradient(...)` and the `.glow`
property:**

| Caller | File:line | Use of `.glow` | Intent applies cleanly? |
|---|---|---|---|
| `AlbumArt` component (interior gradient) | [`AlbumArt.tsx:24, 36`](../../frontend/src/components/songs/AlbumArt.tsx#L20-L37) | **Does NOT consume `.glow`** — uses `.background` only for the inner radial gradient | N/A — change does not propagate |
| PlayerBar mobile bar | [`PlayerBar.tsx:67-68`](../../frontend/src/components/layout/PlayerBar.tsx#L63-L70) | `boxShadow: '0 0 16px -4px ${art.glow}'` | ✓ Yes — bleed perceptibility is the intent |
| PlayerBar desktop bar | [`PlayerBar.tsx:177-181`](../../frontend/src/components/layout/PlayerBar.tsx#L174-L182) | `boxShadow: '0 0 24px -6px ${art.glow}'` | ✓ Yes — primary target of §5.2 |
| PlaylistDetail hero background halo | [`PlaylistDetail.tsx:261-266`](../../frontend/src/components/playlists/PlaylistDetail.tsx#L261-L266) | `radial-gradient(... ${heroArt.glow} 0%, transparent 65%)` | ✓ Yes — primary target of §5.6 |
| PlaylistDetail hero tile boxShadow | [`PlaylistDetail.tsx:272-275`](../../frontend/src/components/playlists/PlaylistDetail.tsx#L270-L276) | `boxShadow: '0 20px 60px -20px ${heroArt.glow}, ...'` | ✓ Yes — primary target of §5.6 |

**Cross-context risk.** None. Every consumer benefits identically from
a perceptibility lift. The audit explicitly observes (§5.6) that the
bump "propagates automatically because PlaylistDetail uses the same
component" — this is the desired behaviour, not a regression risk.

**Verdict.** **NO SPLIT REQUIRED.** Single-line edit. Affects four
visible surfaces with convergent intent.

**Acceptance criteria.**
- PlayerBar bottom-left AlbumArt thumbnail shows a perceptible cool
  halo against OLED black (across at least 3 different `currentSong`
  values, ideally including a teal-family hue index 0/1/2/7 and a
  violet-family 4/5).
- PlaylistDetail hero shows the radial halo at top-left more visibly.
- The play-button outer halo (currently dimmed to 14/18px by the
  PlayerBar-scope override) does not visually merge with the AlbumArt
  bleed when the album hue is teal (HUE indices 0, 1, 2, 7). If they
  read as one continuous glow, **STOP** — the alpha is too high.
- No regression on other surfaces using `albumGradient` (none exist —
  the SongRow uses `AlbumArt` but does not apply a boxShadow halo).

---

### Fix B — Empty-state italic-to-sans (status copy only)

**Spec from audit (§5.8 recommended fix).** Migrate `.font-display-italic`
**status-report empty-state lines** to plain Geist sans at
`text-[var(--aurora-text-tertiary)]`. **Preserve italic on:** PlayerBar
idle ("Nothing playing"), MixEmptyState ("No songs match this query"),
input placeholders, error reporting, editorial subtitles.

**Selection rule (extracted from audit).** Italic stays for *editorial
or ambient* copy. Italic migrates for *factual status reports* embedded
in chrome (dialog/sidebar lines that report an absence between two
label-micros).

**Inventory of every `.font-display-italic` usage and the per-site
verdict:**

| File:line | Surface | Content | Verdict |
|---|---|---|---|
| [`App.tsx:166`](../../frontend/src/App.tsx#L166) | Top-bar search input placeholder | `placeholder:font-display-italic` | **KEEP** — placeholder is editorial-quiet |
| [`PlayerBar.tsx:51`](../../frontend/src/components/layout/PlayerBar.tsx#L51) | Mobile idle "Nothing playing" | Status-but-ambient (audit §5.8 explicitly preserves) | **KEEP** |
| [`PlayerBar.tsx:83`](../../frontend/src/components/layout/PlayerBar.tsx#L83) | Mobile playing-but-no-file fallback "Nothing playing" | Status-but-ambient | **KEEP** |
| [`PlayerBar.tsx:160`](../../frontend/src/components/layout/PlayerBar.tsx#L160) | Desktop idle "Nothing playing" | Status-but-ambient (audit's canonical "this one stays italic") | **KEEP** |
| [`PlayerBar.tsx:196`](../../frontend/src/components/layout/PlayerBar.tsx#L196) | Desktop playing-but-no-file fallback "Nothing playing" | Status-but-ambient | **KEEP** |
| [`Sidebar.tsx:112`](../../frontend/src/components/layout/Sidebar.tsx#L112) | Sidebar Playlists empty "No playlists yet" | Status report between label-micros | **MIGRATE** |
| [`Sidebar.tsx:150`](../../frontend/src/components/layout/Sidebar.tsx#L150) | Sidebar Tags empty "No tags yet" | Status report between label-micros | **MIGRATE** |
| [`QueryInput.tsx:66`](../../frontend/src/components/filter/QueryInput.tsx#L66) | Query input placeholder | Placeholder | **KEEP** |
| [`QueryBuilder.tsx:111`](../../frontend/src/components/filter/QueryBuilder.tsx#L111) | Quick-tag-view error display | Error reporting in danger color | **KEEP** (errors stay italic; the audit's italic-misapplied rule is for *neutral* status, not errors) |
| [`QueryBuilder.tsx:280`](../../frontend/src/components/filter/QueryBuilder.tsx#L280) | Mix empty / loading copy (verify in code) | Read context before changing — see Sonnet step | **VERIFY** — if it is "build a query to start" placeholder copy in an empty Mix view, KEEP (editorial). If it is a status report in chrome, MIGRATE |
| [`QueryBuilder.tsx:289`](../../frontend/src/components/filter/QueryBuilder.tsx#L289) | Error display in danger color | Error reporting | **KEEP** |
| [`QueryBuilder.tsx:375`](../../frontend/src/components/filter/QueryBuilder.tsx#L375) | `MixEmptyState` "No songs match this query" | Audit §5.9 explicitly endorses this italic ("italic register is correctly applied here") | **KEEP** |
| [`PlaylistDetail.tsx:242`](../../frontend/src/components/playlists/PlaylistDetail.tsx#L242) | "Playlist not found" error fallback | Hard error fallback | **KEEP** (treat as error register; if the user prefers MIGRATE here, surface — single-line change) |
| [`PlaylistDetail.tsx:355`](../../frontend/src/components/playlists/PlaylistDetail.tsx#L355) | Playlist search input placeholder | Placeholder | **KEEP** |
| [`PlaylistDetail.tsx:362`](../../frontend/src/components/playlists/PlaylistDetail.tsx#L362) | Empty playlist primary line | **VERIFY** in code — if it is a "this playlist is empty, drag songs here" empty-state-with-illustration line, KEEP; if it is a bare status report in chrome, MIGRATE |
| [`PlaylistDetail.tsx:368`](../../frontend/src/components/playlists/PlaylistDetail.tsx#L368) | Empty playlist secondary line | Same VERIFY as 362 |
| [`SongTable.tsx:83`](../../frontend/src/components/songs/SongTable.tsx#L83) | Empty SongTable primary line | Same VERIFY pattern as MixEmptyState — if there is an SVG illustration above it, KEEP; if it is bare status text, MIGRATE |
| [`TagEditor.tsx:74`](../../frontend/src/components/tags/TagEditor.tsx#L74) | Edit Tags dialog song subtitle ("After Dark") | Editorial subtitle (audit §5.8: "'Edit tags' Fraunces title + 'After Dark' italic subtitle is a clean two-line header" — endorses) | **KEEP** |
| [`TagEditor.tsx:84`](../../frontend/src/components/tags/TagEditor.tsx#L84) | "No tags yet" empty state (audit §5.8 headline finding) | Status report between label-micros | **MIGRATE** |
| [`TagEditor.tsx:148`](../../frontend/src/components/tags/TagEditor.tsx#L148) | Tag suggestion empty / status copy | **VERIFY** — if it is a status line akin to 84, MIGRATE; if it is editorial (e.g. "type to search"), KEEP |
| [`input.tsx:14`](../../frontend/src/components/ui/input.tsx#L14) | Default `<Input>` placeholder style | Placeholder | **KEEP** |

**Confirmed migrate set (3 sites unconditional):**
- `Sidebar.tsx:112` — "No playlists yet"
- `Sidebar.tsx:150` — "No tags yet"
- `TagEditor.tsx:84` — "No tags yet"

**Conditional migrate set (4 sites — Sonnet must read context first):**
`QueryBuilder.tsx:280`, `PlaylistDetail.tsx:362`, `PlaylistDetail.tsx:368`,
`SongTable.tsx:83`, `TagEditor.tsx:148`. The decision rule is the
selection rule above. **If the call is ambiguous, KEEP italic (do not
migrate by default — the audit's rule is conservative).**

**Migration recipe.** For each migrate site, replace the className
fragment as follows. Preserve color and size tokens already on the
element.

```tsx
// Pattern — confirmed sites
// Before
<p className="font-display-italic text-[13px] text-[var(--aurora-text-tertiary)]">
  No playlists yet
</p>
// After
<p className="text-[12.5px] text-[var(--aurora-text-tertiary)]">
  No playlists yet
</p>
```

The `text-[13px]` → `text-[12.5px]` step is the audit's recommendation
in §5.8 ("Change … to `text-[12.5px] text-[var(--aurora-text-tertiary)]`
plain Geist sans"). For TagEditor:84 the existing size is `text-[12px]`
— preserve that, do not promote to 12.5.

**Cross-context risk.** None. Each migrate site is decided per-call.
The class itself stays in `index.css:239` and continues to serve the
keep-set.

**Verdict.** **NO SPLIT REQUIRED.** Per-site selective migration.

**Acceptance criteria.**
- Three confirmed migrate sites visually swap from italic Fraunces to
  upright Geist sans-tertiary; size and color match the audit's recipe.
- All keep-set sites remain italic Fraunces — verify by inspection of
  diff: italic should *only* disappear at the migrated sites.
- For each conditional site, Sonnet documents the decision (KEEP or
  MIGRATE) in the commit message with a one-line reason.

---

### Fix C — PlayerBar artist-row visual mass

**Spec from audit (§5.3 Option A).** Bump the artist row from
`text-[var(--aurora-text-secondary)]` (= `#8b95a7`) toward primary —
audit's recipe: `text-[var(--aurora-text)]` at `opacity-70`. Net
effective tone climbs from `#8b95a7 @ 100%` to roughly `#e8e6e3 @ 70%`,
which composites brighter and warmer against OLED.

**Exact change.** Two-class edit at
[`PlayerBar.tsx:191`](../../frontend/src/components/layout/PlayerBar.tsx#L191)
(desktop) and a mirror edit at
[`PlayerBar.tsx:78`](../../frontend/src/components/layout/PlayerBar.tsx#L78)
(mobile, for parity — audit does not explicitly cover mobile but the
diagnosis applies symmetrically).

```tsx
// Desktop — line 191
// Before
<span className="text-[11px] text-[var(--aurora-text-secondary)] truncate mt-0.5 tracking-wide">
// After
<span className="text-[11px] text-[var(--aurora-text)] opacity-70 truncate mt-0.5 tracking-wide">

// Mobile — line 78 (mirror)
// Before
<span className="text-[10px] text-[var(--aurora-text-secondary)] truncate">
// After
<span className="text-[10px] text-[var(--aurora-text)] opacity-70 truncate">
```

**Mobile parity is a judgement call.** The audit only specifies desktop.
If the future session prefers tightest possible scope (desktop only),
that is acceptable — surface the mobile-or-not decision in the commit
message.

**Consumer enumeration of `--aurora-text-secondary`.** This token has
**16 consumer files** (per `Grep` over `frontend/src`). The fix does
**not** touch the token — only two specific call-sites. Token
consumers stay on `--aurora-text-secondary` unchanged.

**Cross-context risk.** None — the change is inline at two call-sites,
not at the token.

**Verdict.** **NO SPLIT REQUIRED.** Two-line edit (one if mobile is
omitted).

**Acceptance criteria.**
- PlayerBar desktop "Yui" / artist line reads as a more visible
  counterweight to the 56px AlbumArt; the cluster's perceived mass
  centre shifts right.
- Title vs artist contrast still reads as hierarchical (the title is
  brighter than the artist; do not let opacity-70 close the gap such
  that the two lines tie).
- No regression to title weight, gap, or layout.

---

### Fix D — Sidebar wordmark hairline lift

**Spec from audit (§5.4 fix 1).** Lift gradient hairline opacity from
`0.4` to `0.7`; widen from `w-12` (48px) to `w-20` (80px).

**Exact change.** Two-attribute edit at
[`Sidebar.tsx:62-68`](../../frontend/src/components/layout/Sidebar.tsx#L62-L68):

```tsx
// Before
<div
  className="mt-3 h-[1px] w-12"
  style={{
    background: "linear-gradient(to right, var(--aurora-accent-interactive), var(--aurora-secondary))",
    opacity: 0.4,
  }}
/>
// After
<div
  className="mt-3 h-[1px] w-20"
  style={{
    background: "linear-gradient(to right, var(--aurora-accent-interactive), var(--aurora-secondary))",
    opacity: 0.7,
  }}
/>
```

**Consumer enumeration.** This element is **unique** to the sidebar
header — no shared class, no shared inline style consumed elsewhere.
The gradient direction (`var(--aurora-accent-interactive)` →
`var(--aurora-secondary)`) is also used in other Aurora-gradient
surfaces (wordmark text clip, currently-playing title, Mix Jam button)
but those are independent declarations.

**Cross-context risk.** None.

**Verdict.** **NO SPLIT REQUIRED.**

**Acceptance criteria.**
- Hairline reads as a deliberate underline of the wordmark, not a
  faint stub.
- Hairline width does not exceed the wordmark's text width
  (visually it should sit under the wordmark, not extend past).

---

### Fix E — Tag-dot Aurora Pulse tint

**Spec from audit (§5.4 fix 2).** Replace `var(--aurora-muted)` with a
faint Aurora Pulse tint at the TagSidebarItem dot only.

**Exact change.** Inline-style edit at
[`Sidebar.tsx:290-296`](../../frontend/src/components/layout/Sidebar.tsx#L290-L296):

```tsx
// Before
<span
  className="relative z-10 w-[4px] h-[4px] rounded-full flex-shrink-0"
  style={{
    background: "var(--aurora-muted)",
  }}
  aria-hidden="true"
/>
// After
<span
  className="relative z-10 w-[4px] h-[4px] rounded-full flex-shrink-0"
  style={{
    background: "rgba(45, 212, 191, 0.35)",
  }}
  aria-hidden="true"
/>
```

The literal `rgba(45, 212, 191, 0.35)` is a desaturated Aurora Pulse
(`#2DD4BF` at 35% alpha). The audit's exact specified value.

**Consumer enumeration of `var(--aurora-muted)`.**

| File:line | Surface | Token use | Affected? |
|---|---|---|---|
| [`index.css:128`](../../frontend/src/index.css#L128) | Token declaration | Definition | NO — token unchanged |
| [`index.css:286`](../../frontend/src/index.css#L286) | `.aurora-chip` border | Border on chip | NO — token unchanged |
| [`App.tsx:201`](../../frontend/src/App.tsx#L201) | Top-bar search input border | Border | NO — token unchanged |
| [`Sidebar.tsx:293`](../../frontend/src/components/layout/Sidebar.tsx#L293) | TagSidebarItem dot | Background | **YES — target of fix** |
| [`EditSongDialog.tsx:157`](../../frontend/src/components/songs/EditSongDialog.tsx#L157) | Edit Song input border | Border | NO — token unchanged |

**Cross-context risk.** Zero. The token `--aurora-muted` continues to
serve the four other consumers. The Sidebar-tag-dot site replaces the
token reference with an inline literal — the token's other consumers
are untouched.

**Verdict.** **NO SPLIT REQUIRED.** Inline literal replaces token at a
single call-site.

**Important guard.** Do **not** redefine `--aurora-muted` at
`index.css:128` — that would silently re-tint the search-input border
and chip-default border. The fix is **inline-literal-at-call-site**.

**Acceptance criteria.**
- Tag rows in the sidebar show a faint teal dot (Aurora Pulse-tinted)
  instead of grey.
- Tag dots remain dimmer than playlist dots (which use per-playlist
  `playlist.color` at full alpha).
- Search-input border, chip border, and EditSong input border are
  unchanged (visually identical to before).

---

### Fix F — Smoked-teal → Aurora Pulse SVG color migration

**Spec from audit (§5.9 + `play-button-color.md` §6.4).** Three deferred
sites still use the pre-Aurora-Pulse rgba `(77, 184, 164, ...)`. Migrate
to `(45, 212, 191, ...)` — Aurora Pulse `#2DD4BF`.

**The three sites:**

#### F.1 — `MixEmptyState` SVG strokes

[`QueryBuilder.tsx:351-371`](../../frontend/src/components/filter/QueryBuilder.tsx#L351-L371)

```tsx
// Path 1, line 353
stroke="rgba(77,184,164,0.30)"  →  stroke="rgba(45,212,191,0.30)"

// Path 3, line 367
stroke="rgba(77,184,164,0.14)"  →  stroke="rgba(45,212,191,0.14)"
```

**The middle path (line 360) uses violet `rgba(138,117,200,0.22)` and
must NOT be changed.** It is the violet companion stroke; Aurora's
gradient axis is teal + violet, so the violet stays.

#### F.2 — `aurora-range::-webkit-slider-thumb` and `::-moz-range-thumb` box-shadow

[`index.css:632`](../../frontend/src/index.css#L632) and
[`index.css:650`](../../frontend/src/index.css#L650)

```css
/* Both lines */
box-shadow: 0 0 12px 2px rgba(77, 184, 164, 0.5);
/* Migrate to */
box-shadow: 0 0 12px 2px rgba(45, 212, 191, 0.5);
```

#### F.3 — `.aurora-idle-shimmer` linear-gradient stops

[`index.css:844-846`](../../frontend/src/index.css#L841-L851)

```css
/* Before */
background: linear-gradient(
  135deg,
  rgba(77, 184, 164, 0.12) 0%,
  rgba(138, 117, 200, 0.22) 50%,
  rgba(77, 184, 164, 0.10) 100%
);
/* After */
background: linear-gradient(
  135deg,
  rgba(45, 212, 191, 0.12) 0%,
  rgba(138, 117, 200, 0.22) 50%,
  rgba(45, 212, 191, 0.10) 100%
);
```

**The middle stop (138, 117, 200) is violet — KEEP.**

**Consumer enumeration.** The `(77, 184, 164, ...)` triplet is the
smoked-teal pre-Aurora-Pulse hex `#4DB8A4`. This hex *is also* the
literal value of `--aurora-accent-interactive` per design-system.md
v2 §Color → Accent colors. The token `--aurora-accent-interactive` is
**not** being changed; only the three rgba **literal-value sites** are
being migrated.

**Conflict watch.** Per design-system.md v2 the *interactive* token
(`#4db8a4`) is distinct from the *vivid* token (`#5eead4`) and from the
Aurora Pulse accent (`#2DD4BF`, used in the play button per
play-button-color.md §3.1). The three sites being migrated are sites
where the audit explicitly determines that Aurora Pulse — not smoked
teal — is the intended voice (idle shimmer, range-thumb glow, empty-
state illustration). This is a *site-by-site recolor*, not a token
update. The smoked-teal hex `#4db8a4` continues to live in the token
declaration and elsewhere unchanged.

**Audit-vs-design-system reconciliation.** This migration was deferred
from the play-button-color recolor patch (per `play-button-color.md`
§6.4 explicitly listing these three sites as low-drift). The audit
revives them and asks they be closed. Design-system.md is not modified.

**Cross-context risk.** Zero. Each rgba literal is at a single
call-site. The token `--aurora-accent-interactive` is the only place
the smoked-teal `#4db8a4` value lives systemically; that token is
untouched.

**Verdict.** **NO SPLIT REQUIRED.** Five literal-value edits across
two files (QueryBuilder.tsx ×2, index.css ×3 — the idle-shimmer
gradient counts as two literal edits at lines 844 and 846).

**Acceptance criteria.**
- MixEmptyState SVG (visible on the Mix view when a query returns zero
  results) renders the two teal strokes in Aurora Pulse rather than
  smoked teal. Visually higher saturation/brightness without becoming
  loud.
- Range-thumb glow (visible on the seek and volume sliders on hover)
  reads as Aurora Pulse-cyan, matching the play button.
- Idle shimmer (visible on first load before any song plays) cycles
  between Aurora Pulse and twilight violet, not smoked teal.
- The middle violet stops in F.1 path 2 and F.3 are unchanged.

---

### Fix G — PlayerBar song-change cross-fade

**Spec from audit (§5.10 recommended fix).** Add a 150ms opacity cross-
fade on the PlayerBar title and AlbumArt when `currentSong.id` changes.
Use a key-based React re-mount so an existing animation primitive
fires.

**Exact change strategy.**

The audit recommends "Use a key-based React re-mount on the title
element so `aurora-view-enter` fires automatically." There is a wrinkle
the audit does not fully resolve: `.aurora-view-enter` is currently
applied to the entire desktop control row at
[`PlayerBar.tsx:170`](../../frontend/src/components/layout/PlayerBar.tsx#L170),
which does *not* re-mount on song change because the row's identity is
stable. The animation runs once on bar-open (idle → playing).

The cleanest implementation: re-key only the elements that should fade
on song change (title span and AlbumArt wrapper) and apply a 150ms
opacity-fade class to those two re-keyed elements.

**Recipe.**

1. **Add a CSS keyframe + class** to `index.css` near the existing
   `.aurora-fade-in` and `.aurora-view-enter` declarations (audit §5.10
   permits adding one new primitive at 150ms — this stays under the
   200ms view-enter and respects the speed calibration):

   ```css
   /* Song-change cross-fade — 150ms opacity ease, fires on key remount */
   @keyframes aurora-song-fade {
     from { opacity: 0; }
     to   { opacity: 1; }
   }
   .aurora-song-fade {
     animation: aurora-song-fade 150ms cubic-bezier(0.2, 0.7, 0.2, 1);
   }
   ```

   Place near `.aurora-fade-in` (locate via grep) for code locality.
   Respect the existing `prefers-reduced-motion` block — if such a
   block exists at the bottom of the motion section, ensure the new
   class also gets `animation: none` there (audit §5.10 mentions the
   motion-reduction policy is mandated even if some implementation
   gaps exist; do not ship a new motion primitive without honouring
   the policy).

2. **Apply at desktop title** —
   [`PlayerBar.tsx:188-190`](../../frontend/src/components/layout/PlayerBar.tsx#L188-L190):

   ```tsx
   // Before
   <span className="font-display text-[18px] leading-tight text-[var(--aurora-text)] truncate">
     {currentSong.title}
   </span>
   // After
   <span
     key={currentSong.id}
     className="font-display text-[18px] leading-tight text-[var(--aurora-text)] truncate aurora-song-fade"
   >
     {currentSong.title}
   </span>
   ```

3. **Apply at desktop AlbumArt wrapper** —
   [`PlayerBar.tsx:173-183`](../../frontend/src/components/layout/PlayerBar.tsx#L173-L183).
   The `<AlbumArt>` element's outer `<div className="relative
   flex-shrink-0">` is the cleanest re-key target:

   ```tsx
   <div key={currentSong.id} className="relative flex-shrink-0 aurora-song-fade">
     <AlbumArt ... />
   </div>
   ```

4. **Mobile parity (optional but recommended).** Mirror at
   [`PlayerBar.tsx:75-77`](../../frontend/src/components/layout/PlayerBar.tsx#L75-L77)
   (title span) and the AlbumArt at
   [`PlayerBar.tsx:63-71`](../../frontend/src/components/layout/PlayerBar.tsx#L63-L71)
   if the future session decides to extend.

**Why a new class instead of reusing `.aurora-fade-in`?** Locate
`.aurora-fade-in` in index.css before deciding. If `.aurora-fade-in`
is already 150-200ms opacity and reused safely, re-using it is fine —
no new keyframe needed. The new class is a fallback if `.aurora-fade-in`
has different semantics (e.g. a translateY or longer duration). Sonnet
must read the existing class definition before choosing.

**Important — re-render semantics.** The PlayerBar reads
`currentSong` from the Zustand store. When the user clicks a new song,
the store updates `currentSong` synchronously and React re-renders the
PlayerBar. Without a `key`, React diffs in place and the title text
just swaps (no fade). With `key={currentSong.id}`, React unmounts the
old span and mounts a new one, firing the CSS animation. **Verify the
re-mount cost is negligible** — a single span and a single AlbumArt
re-mount per song change is trivial.

**Audio-side impact.** None. Audio playback is owned by the
`useAudioPlayer` hook and is not coupled to the title/AlbumArt DOM
identity. Re-keying these visual elements does not interrupt audio.

**Consumer enumeration.** The new `.aurora-song-fade` class is brand-
new; no consumers exist before this fix. The `<AlbumArt>` and title
`<span>` re-key sites are local to PlayerBar.

**Cross-context risk.** Zero. New class is namespaced; key change is
inline.

**Verdict.** **NO SPLIT REQUIRED.** New keyframe + class + two re-key
applications.

**Acceptance criteria.**
- Click a different song while the PlayerBar shows the current one;
  title fades from old to new in ~150ms (visible but quick).
- AlbumArt thumbnail also fades in the same window.
- Audio starts on click *immediately* (no perceptible delay vs current
  behaviour) — the fade is purely visual.
- `prefers-reduced-motion` users see an instant swap (no fade) — the
  new class is wrapped in / respects the existing reduce-motion query.
- Switching between idle ↔ playing still fires `aurora-view-enter` (do
  not break the existing entrance choreography).

---

## 5. §5.5 — currently-playing-row indicator verification

**Audit's contingent finding.** §5.5 finding 1: in screenshot 202, no
row in the visible scroll position shows the playing-row treatment
(3px accent bar + gradient title clip + Equalizer in the # column +
linear-gradient row tint). The audit could not tell from the
thumbnail-resolution screenshot whether the indicator regressed or
whether it was hidden by the user's scroll position.

**Verification.**

Code at [`SongRow.tsx`](../../frontend/src/components/songs/SongRow.tsx)
shows the indicator is wired correctly:

| Check | File:line | Status |
|---|---|---|
| `isCurrentSong` derivation | [`SongRow.tsx:60`](../../frontend/src/components/songs/SongRow.tsx#L60) `const isCurrentSong = currentSong?.id === song.id` | ✓ correct |
| 3px accent bar (gated by `isCurrentSong`) | [`SongRow.tsx:82-91`](../../frontend/src/components/songs/SongRow.tsx#L82-L91) | ✓ correct, uses `--aurora-accent-interactive` + glow |
| Linear-gradient row tint when playing | [`SongRow.tsx:99-106`](../../frontend/src/components/songs/SongRow.tsx#L99-L106) `linear-gradient(to right, rgba(94,234,212,0.06) 0%, transparent 60%)` | ✓ correct |
| Equalizer in # column | [`SongRow.tsx:111-117`](../../frontend/src/components/songs/SongRow.tsx#L111-L117) renders `<Equalizer playing={isPlaying} />` when `isCurrentSong` | ✓ correct |
| Gradient title clip | [`SongRow.tsx:144-148`](../../frontend/src/components/songs/SongRow.tsx#L144-L148) `aurora-gradient-text` when `isCurrentSong` | ✓ correct |

**Visual inspection of screenshot 202.** "Again" by Yui appears at
table row 6. At the screenshot's resolution, it is difficult to confirm
the 3px accent bar (only 3 pixels wide on screen — well below
thumbnail-rendering legibility). The text in row 6 does appear to read
slightly differently from neighbouring rows (consistent with the
`aurora-gradient-text` clip being applied), and the # column for that
row is visually distinct from neighbouring rows that show plain
numbers (consistent with the Equalizer being rendered). **The
indicator appears to fire**; what made it look "missing" in the audit
was the screenshot's small scale.

**Verdict.** **NO REGRESSION. NO FIX REQUIRED.** §5.5 finding 1 is
dropped from the build.

**If the user later disagrees** (e.g. inspects at full resolution and
sees a real defect), the build re-opens — but as of this spec, the
indicator code is correct and observed to render. The audit's
"contingent CRITICAL" downgrades to a "verified-clean MEDIUM polish
note" — the *table-rhythm* concern (§5.5 findings 2-4) is real but
out of quick-win scope.

---

## 6. Atomic commit sequence

The audit's working hypothesis was 5 commits. After verification,
§5.5 drops out and the remaining six fixes group into **five atomic
commits** — same count as the hypothesis but with §5.5 removed and
Fix C standing alone in the C3 slot. **No commit needs to ship in two
parts** (no token splits required).

Order is chosen so that each commit's visual change can be assessed
before moving on, and so that any commit can be reverted independently
if the user dislikes the result.

---

### Commit C1 — `feat(atmosphere): perceptible AlbumArt bleed + song-change cross-fade`

**Concern.** Atmospheric polish — the two motion/perception tweaks
that make existing atmosphere visible.

**Files.**
- `frontend/src/lib/albumGradient.ts` (Fix A)
- `frontend/src/components/layout/PlayerBar.tsx` (Fix G — title + AlbumArt re-key)
- `frontend/src/index.css` (Fix G — new `.aurora-song-fade` class)

**Changes per file.**
- `albumGradient.ts:60` — alpha `0.25` → `0.30`
- `PlayerBar.tsx:188-190` (desktop title) — add `key={currentSong.id}`
  and `aurora-song-fade` class
- `PlayerBar.tsx:173-183` (desktop AlbumArt wrapper) — wrap with
  `key={currentSong.id}` and `aurora-song-fade` class
- `PlayerBar.tsx:75-77, 63-71` (mobile mirror) — optional, document
  decision in commit message
- `index.css` — add `@keyframes aurora-song-fade` and
  `.aurora-song-fade` class near existing motion primitives;
  ensure `prefers-reduced-motion` policy applied if a media-query
  block exists

**Rationale for grouping.** Both fixes target "atmospheric beats that
are currently inaudible" — the bleed is invisible at 0.25 alpha; the
song-change moment is silent without the fade. Both are PlayerBar/
AlbumArt-adjacent and ship as a single perceptual upgrade.

**Acceptance.** See Fix A and Fix G acceptance criteria above. The
combined acceptance is: PlayerBar feels more alive — visible bleed
when looking at the AlbumArt thumbnail and a smooth title swap on song
change — without any audio-interaction delay.

**Stop condition.** If the bleed at 0.30 alpha visually merges with
the play-button outer halo (see Fix A acceptance), STOP and surface to
the user — alpha may need to drop back to 0.27 or 0.28. Do **not**
unilaterally commit a value the audit did not specify.

---

### Commit C2 — `feat(typography): migrate status-copy italic to plain sans`

**Concern.** Typography register fix — italic Fraunces is editorial;
status reports go upright.

**Files.**
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/tags/TagEditor.tsx`
- (conditional, decided per §4 Fix B inventory)
  `frontend/src/components/filter/QueryBuilder.tsx`,
  `frontend/src/components/playlists/PlaylistDetail.tsx`,
  `frontend/src/components/songs/SongTable.tsx`

**Changes per file.** Apply migration recipe from §4 Fix B.
**Confirmed migrate set:**
- `Sidebar.tsx:112` — "No playlists yet"
- `Sidebar.tsx:150` — "No tags yet"
- `TagEditor.tsx:84` — "No tags yet"

For the conditional set, decide per the selection rule and document
each decision in the commit message.

**Rationale for grouping.** All sites share a single typographic
recipe and a single decision rule. Grouping keeps the diff coherent
and avoids per-site PR churn.

**Acceptance.** See Fix B acceptance.

**Stop condition.** If during execution Sonnet finds an italic site
**not** listed in §4 Fix B's inventory (the inventory was current as
of 2026-05-06), STOP and surface — that means a new italic site has
landed since the audit and needs decision. Do not silently migrate or
skip.

---

### Commit C3 — `fix(playerbar): bump artist-row visual mass to balance AlbumArt`

**Concern.** Visual mass redistribution in the PlayerBar left cluster
without changing AlbumArt size.

**Files.**
- `frontend/src/components/layout/PlayerBar.tsx`

**Changes per file.**
- `PlayerBar.tsx:191` (desktop) — color/opacity per Fix C recipe
- `PlayerBar.tsx:78` (mobile mirror, optional) — same recipe

**Rationale for grouping.** This is a single-concern visual-mass fix
isolated from atmosphere (C1) and from typography (C2). Independent
commit so it can be reverted if the user prefers the lighter artist
line.

**Acceptance.** See Fix C acceptance.

**Stop condition.** If the artist line composites brighter than the
title (i.e. the hierarchy inverts), STOP — opacity-70 against
`--aurora-text` is too bright. Audit recipe specifies opacity-70; do
not ship a value below 0.6 unilaterally.

---

### Commit C4 — `chore(tokens): migrate deferred smoked-teal SVG sites to Aurora Pulse`

**Concern.** Close the deferred-recolor loop from
`play-button-color.md` §6.4. Three sites; one cohesive migration.

**Files.**
- `frontend/src/components/filter/QueryBuilder.tsx`
- `frontend/src/index.css`

**Changes per file.** Apply Fix F recipe — five literal edits total.

**Rationale for grouping.** All three sites share the same migration
intent (smoked-teal `#4db8a4` → Aurora Pulse `#2DD4BF`) and were
explicitly deferred together by `play-button-color.md` §6.4. The
commit closes the loop in one move.

**Acceptance.** See Fix F acceptance.

**Stop condition.** If grep reveals a fourth site using
`rgba(77, 184, 164, ...)` or `rgba(77,184,164,...)` (no spaces) that
is *not* `--aurora-accent-interactive` token-derived, STOP and surface
— that means the audit's enumeration was incomplete. Do not migrate
unaudited sites.

**Verification command (PowerShell-friendly).**

```powershell
# Run before commit — confirm no other smoked-teal literals exist outside the migrated three
# (uses Grep tool in practice; rg shown for reference)
rg "rgba\(77,?\s*184,?\s*164" frontend/src
```

After the commit, only the violet-companion stops should remain
(`rgba(138, 117, 200, ...)`).

---

### Commit C5 — `feat(sidebar): lift wordmark hairline + tint tag dots`

**Concern.** Two cheap sidebar polish moves that bring identity below
the wordmark.

**Files.**
- `frontend/src/components/layout/Sidebar.tsx`

**Changes per file.**
- `Sidebar.tsx:62-68` — Fix D recipe (opacity 0.4 → 0.7, w-12 → w-20)
- `Sidebar.tsx:290-296` — Fix E recipe (`var(--aurora-muted)` →
  `rgba(45, 212, 191, 0.35)`)

**Rationale for grouping.** Same file, both polish moves, both about
"identity in the sidebar's top + tag column." Coherent atomic commit.

**Acceptance.** See Fix D + Fix E acceptance.

**Stop condition.** **Do not redefine `--aurora-muted` at
`index.css:128`.** That would silently retint the search input border,
chip border, and EditSong input border. The fix is **inline at
`Sidebar.tsx:293`** only — verify the diff does not touch index.css.

---

### Commit count summary

| Commit | Fixes | Files | Concern |
|---|---|---|---|
| C1 | A + G | 3 | atmosphere/motion |
| C2 | B | 2-5 (conditional) | typography register |
| C3 | C | 1 | playerbar density |
| C4 | F | 2 | token migration |
| C5 | D + E | 1 | sidebar polish |

**Five commits** — same as the audit's working hypothesis. §5.5
dropped after verification (§5 above); Fix C now lives alone in the
C3 slot.

---

## 7. Stop conditions for the future Sonnet session

In priority order:

1. **Working tree dirty before starting.** STOP. The build assumes a
   clean tree. The two known untracked items (`docs/design/aesthetic-audit.md`,
   `docs/design/audit-screenshots/`) must be committed or stashed
   first — but **do not lose them**. They are the audit input.

2. **Blast-radius surprise.** If during execution, a class/token/style
   being changed has more consumers than this spec lists, STOP and
   surface. The most likely offenders:
   - `albumGradient.ts:60` `glow` — spec lists 4 consumers (mobile
     PlayerBar boxShadow, desktop PlayerBar boxShadow, PlaylistDetail
     hero radial, PlaylistDetail hero boxShadow). If a fifth appears,
     verify intent before proceeding.
   - `--aurora-muted` — spec lists 5 consumers; if a sixth appears,
     verify the inline-replace plan for Fix E still avoids cross-
     context regression.
   - `.font-display-italic` (`index.css:239`) — spec lists 21 call-
     sites; if a 22nd appears, decide per the Fix B selection rule.
   - `rgba(77, 184, 164, ...)` literals — spec migrates 5 occurrences;
     if a 6th appears, surface (do not silently migrate).

3. **Visual regression on a non-target surface.** STOP and surface.
   The eight surfaces that **must not** regress are:
   - SongRow row hover (the C3 button-system regression precedent —
     `.aurora-play-btn` reuse). This spec does not touch
     `.aurora-play-btn` but verify after C1 + C3 that SongRow rows
     still hover and play-on-row-hover still works.
   - All Songs table currently-playing indicator (verified clean in
     §5; do not regress).
   - Mix Jam button (Loud-tier gradient identity moment — must not be
     altered).
   - Search button on Mix page (Loud-tier solid Aurora Pulse — must
     not be altered; the audit's tier-rationalisation is **out of
     this spec's scope**, see §8).
   - Edit Tags dialog song subtitle "After Dark" italic — keep italic
     (audit endorses).
   - Mix `MixEmptyState` "No songs match this query" italic — keep
     italic (audit endorses).
   - Top-bar / QueryInput / Input default placeholder italics — keep.
   - PlayerBar idle "Nothing playing" italics (mobile + desktop, both
     idle and not-yet-loaded states) — keep italic.

4. **Forbidden "while I'm here" instinct.** Same rule as the C3
   button-system precedent. Sonnet does **not**:
   - Touch `.aurora-play-btn` (out of scope; recently retuned).
   - Migrate `IconBtn` JS-hover handlers or `FooterAction` JS-hover
     handlers (deferred per `button-system.md` §3.6 — separate
     session).
   - Tier-rationalise the Mix page Search vs Jam buttons (audit §5.7;
     this is a HIGH severity finding but **not** a quick win — needs
     user decision per audit §10.6 item 2).
   - Bump the Mix h1 size (audit §5.7 fix 2; same — not a quick win,
     needs scope alignment with the tier-rationalisation).
   - Add breathing room (`mt-4` → `mt-6/7`) under the Jam button (same
     reason — bundled with tier-rationalisation in audit §5.7).
   - Touch the alternating-row treatment (§5.5 findings 2-4 are
     out of quick-win scope).
   - Modify any token in `index.css :root` declarations.
   - Modify `docs/design-system.md`, `docs/design/button-system.md`,
     `docs/design/play-button-color.md`, or
     `docs/design/aesthetic-audit.md`.

5. **Acceptance criteria failure.** If any commit's acceptance
   criteria fail visual verification, STOP before staging. Verify in
   browser (the user runs `cd frontend && npm run dev` per
   CLAUDE.md). For each commit:
   - Open the affected surface(s).
   - Compare to the pre-commit state (git diff or screenshot).
   - Confirm acceptance line-by-line.
   - Only then `git add` + commit.

6. **Conventional commit format.** Per CLAUDE.md:
   `type(scope): description` only. No Co-Authored-By, no body, no
   footer. The C1-C5 titles in §6 are written in this format.

---

## 8. What is explicitly NOT in this spec

The audit's HIGH severity findings that this spec does **not**
address:

- **§5.7 Mix page tier-rationalisation + h1 size + Jam breathing room.**
  HIGH severity, audit's #1 priority, but **not a quick win** — needs
  user decision per §10.6 item 2 (Search-vs-Jam mental model). Spawn
  a separate brainstorming session with the user before building.

- **§5.5 findings 2-4 (table rhythm, alternating-row, title weight).**
  MEDIUM polish, separate session.

- **§9 systemic concerns** (Geist body voice, smoked-obsidian glass,
  pure-black ground). User decisions per §10.6 item 3 — not audit-
  recommended changes.

- **`button-system.md` deferred items** — IconBtn JS-hover,
  FooterAction JS-hover. Already documented as separate-session work.

If the future session finds itself wanting to "while I'm here" any of
the above, it must STOP and surface (see §7 rule 4).

---

## 9. Inferred-vs-explicit appendix

Every blast-radius enumeration, grouping decision, and call-by-call
verdict in this spec — sourced.

### 9.1 Blast-radius enumerations — graphify vs grep vs judgement

| Enumeration | Method | Confidence |
|---|---|---|
| `albumGradient(...)` callers | Grep over `frontend/src` ([albumGradient grep](#)). 4 callers found: `AlbumArt.tsx:24`, `PlayerBar.tsx:32`, `PlaylistDetail.tsx:76`, plus the export site itself. Graphify Community 14 ("Album Art & Gradient") confirms the same 3 nodes (AlbumArt, albumGradient, hashString) | **High** — both methods agree |
| `<AlbumArt>` JSX usages | Grep. 4 usages: `PlayerBar.tsx` (×2), `PlaylistDetail.tsx` (×2 — hero grid + `addSong` row at 597), `SongRow.tsx:141` | **High** — direct grep |
| `.font-display-italic` call-sites | Grep over `frontend/src`. 21 distinct usages found across 12 files | **High** — direct grep; verdict-per-site is **judgement** applied via the audit's selection rule (§5.8) |
| `--aurora-muted` consumers | Grep. 5 sites (1 declaration + 4 usages) | **High** — direct grep |
| `--aurora-text-secondary` consumers | Grep — 16 files | **High** — counted; but Fix C only changes 2 specific call-sites, not the token, so consumer count is informational only |
| `rgba(77, 184, 164, ...)` literals | Grep. 5 occurrences across 2 files (QueryBuilder.tsx ×2, index.css ×3 in the idle-shimmer + range-thumb sites). Audit names exactly these | **High** — direct grep |
| Currently-playing-row indicator code path | Read [`SongRow.tsx`](../../frontend/src/components/songs/SongRow.tsx) directly | **High** — code-level confirmation |
| PlaylistDetail hero applies `boxShadow` halo | Read [`PlaylistDetail.tsx:272-275`](../../frontend/src/components/playlists/PlaylistDetail.tsx#L270-L276) directly | **High** — confirmed; audit's §5.6 hypothesis ("if PlaylistDetail does NOT apply the boxShadow halo, add it") is moot — it does, and the alpha bump propagates |

### 9.2 Grouping decisions — structural vs preference

| Grouping | Reason |
|---|---|
| C1 = bleed alpha + cross-fade together | **Structural** — both are atmospheric/perceptual additions to the PlayerBar/AlbumArt experience. Both touch the same mental model ("make existing atmosphere readable"). Independent enough that either can revert without the other |
| C2 = italic-to-sans (all sites in one commit) | **Structural** — single typographic recipe, single decision rule. Splitting per file would multiply commit churn without adding reviewability |
| C3 = artist weight standalone | **Structural** — a different concern (visual mass) from atmosphere (C1) and from type register (C2). Standalone keeps the revertibility window for each fix tight |
| C4 = SVG color migration in one commit | **Structural** — single migration intent, three sites, all explicitly grouped by `play-button-color.md` §6.4 |
| C5 = wordmark hairline + tag-dot tint together | **Structural** — same file, both about sidebar identity. Could split but would add a second commit to the same file for marginal diff-readability gain |
| C1 ordered first | **Preference** — bleed bump is the user's most visible deferred concern (HIGH severity, first item in audit §6). Shipping first lets the user evaluate the most-impactful change before committing the smaller polish items |
| C5 ordered last | **Preference** — sidebar wordmark is a low-risk polish surface; safest to ship after the higher-impact items have been verified |

### 9.3 Audit-doc spec — exact vs interpreted

| Recommendation | Treatment |
|---|---|
| Bleed alpha 0.25 → 0.30-0.35 range | **Interpreted to 0.30** — middle of audit's range, smallest perceptible step that respects §10.6 item 1 ("preview before commit"). The user can rerun at 0.32 or 0.35 if the C1 commit looks too quiet |
| Cross-fade 100-150ms (audit §5.10 says "150ms") | **Treated as exact** — `aurora-song-fade` keyframe set at 150ms |
| Cross-fade animation primitive | **Interpreted** — audit says "use `aurora-view-enter`" but that primitive is on the wrapper which doesn't re-mount on song change. Spec adds a new `.aurora-song-fade` (with fallback: reuse `.aurora-fade-in` if its semantics fit). Sonnet must read the existing class first |
| Artist-row tone (`opacity-70` against `--aurora-text`) | **Treated as exact** — audit explicitly specifies this recipe in §5.3 Option A |
| Italic-to-sans size for migrate sites (`text-[12.5px]`) | **Treated as exact** for sidebar (`Sidebar.tsx:112,150`); preserved `text-[12px]` for `TagEditor.tsx:84` because the existing size is 12px and the audit's "12.5px" is a recommendation, not an override |
| Sidebar hairline opacity 0.4 → 0.7, w-12 → w-20 | **Treated as exact** — both numbers explicit in audit §5.4 fix 1 |
| Tag-dot color `rgba(45, 212, 191, 0.35)` | **Treated as exact** — audit §5.4 fix 2 |
| SVG color migration `(77,184,164)` → `(45,212,191)` | **Treated as exact** — audit §5.9 + `play-button-color.md` §6.4 |
| §5.5 indicator regression status | **Verified** — code inspection plus screenshot review concluded no regression. Audit's "verify before fix" was followed; verdict is "no fix" |

### 9.4 "This consumer is fine" vs "REQUIRES SPLIT" calls

**No fix in this spec triggered REQUIRES SPLIT.** The C3 button-system
precedent involved `.aurora-play-btn` — a *class* shared across two
visual contexts. None of the seven fixes in this spec touch a
`.aurora-*` shared class:

| Fix | Vector | Why no split |
|---|---|---|
| A | `albumGradient.ts:60` literal | Single source-of-truth field; all 4 consumers want the same lift |
| B | Per-call className edit | Per-site, no class-level change |
| C | Per-call className edit at 1-2 PlayerBar sites | Token `--aurora-text-secondary` keeps its 16 other consumers |
| D | Inline style at one Sidebar element | Element is unique |
| E | Inline-literal replaces token reference at 1 Sidebar dot | Token `--aurora-muted` keeps its 4 other consumers |
| F | rgba literals at 5 explicit sites | No token modified; deferred-recolor explicitly scoped by `play-button-color.md` §6.4 |
| G | New `.aurora-song-fade` class + key prop | New class has zero consumers before this fix |

**Evidence of cleanliness** for each — see §9.1 enumeration table.

### 9.5 §5.5 verification — evidence

- **Code path** ([`SongRow.tsx:60, 82-91, 99-106, 111-117, 144-148`](../../frontend/src/components/songs/SongRow.tsx#L60))
  shows the indicator is wired correctly and gated on
  `currentSong?.id === song.id`. No conditional gates the indicator
  on a queue context, route, or scroll state.
- **Screenshot 202**: at thumbnail resolution the 3px accent bar is
  below visual legibility (3 px wide). The Equalizer in the # column
  is dimly visible at row 6 — different glyph density vs neighbouring
  numbered rows. The gradient title clip is also faintly visible (a
  hue shift on the row 6 title vs neighbours).
- **Conclusion** is "indicator firing; visually quiet at the
  screenshot scale." The audit's CRITICAL contingent does not trigger.

If the user inspects at full resolution and disagrees, the fix is a
re-open of §5.5 — outside this build's scope.

---

## 10. Final report fields (for the build session to populate)

When the future Sonnet session completes the build, it should report
back with:

- Five commits proposed (per §6); per-commit acceptance verified.
- Any commit where Fix B's conditional set was decided differently
  from the spec's default (`KEEP` if ambiguous) — surface the
  reasoning.
- Whether mobile PlayerBar parity (Fix C and Fix G) was applied or
  deferred.
- Whether `.aurora-fade-in` was reused or `.aurora-song-fade` was
  added (Fix G).
- Browser-verification log per acceptance line.
- Any blast-radius surprise encountered (none expected per §9.1).

---

*End of build spec. No application code modified by this audit. All
findings traceable in §9.*
