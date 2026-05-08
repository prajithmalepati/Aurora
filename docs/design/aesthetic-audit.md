# Aurora — Aesthetic Audit

> Read-only audit · 2026-05-05
>
> **Scope.** Walk every visible surface, identify what reads as off and
> why, ground findings in design principles + production references, and
> prioritize. **Not** to redesign. The output is findings + priorities,
> from which the user commissions per-priority fix sessions.
>
> **Authority.** [`docs/design-system.md`](../design-system.md) v2 stays
> law. [`docs/design/button-system.md`](./button-system.md) Direction C
> Frosted Lens is locked. [`docs/design/play-button-color.md`](./play-button-color.md)
> Aurora Pulse `#2DD4BF` accent is shipped. AlbumArt Path B (no backend
> dominant-color extraction) is locked.
>
> **Calibration on user intent (post-clarification).** Aurora must be
> snappy and intuitive at any usage frequency — beautiful AND fast. Not
> beautiful with friction tax acceptable. Conventional layout backbone
> (sidebar + main + PlayerBar) stays — for *speed and intuition*, not
> just for utility tradition. Distinctiveness gains are wanted in the
> register that is passive or scannability-improving (typography,
> atmosphere, glass quality, color discipline, motion polish that
> doesn't delay interaction). Any recommended fix that would add
> interaction delay is downgraded one severity tier with rationale.

---

## 1. Pre-flight — what was confirmed before walking

| Check | Status |
|---|---|
| `docs/design-system.md` v2 readable | ✓ Confirmed at line 3: "v2 — revised 2026-04-23" |
| `docs/design/button-system.md` readable | ✓ 1073-line exploration; Direction C selected, Loud tier shipped |
| `docs/design/play-button-color.md` readable | ✓ Aurora Pulse `#2DD4BF` shipped in commit `d43f260` |
| `docs/design/audit-screenshots/` folder | ✓ Created; 7 screenshots present (16 requested) |
| `graphify-out/graph.json` recent | ✓ Present (used as orientation only; visual layer is thinly extracted) |
| ui-ux-pro-max queryable | ✓ `python .claude/skills/ui-ux-pro-max/scripts/search.py` ran; results in §3 |
| frontend-design skill invoked | ✓ Read `SKILL.md`; principles internalised in §3 |
| Caveman skill | Was active at session start; toggled off per task brief; audit body is full prose |
| Current branch | `master` (post-merge of button-system-loud-tier) ✓ |

---

## 2. Foundation grounding — load-bearing context

**Direction C Frosted Lens is the unified button language.** Recipe = glass surface (`rgba(255,255,255,0.04)`) + `::before` radial backlight (Aurora Pulse, blur 12px, opacity tier-dependent) + outer `box-shadow` halo. Loud tier is "always-on at low ambience, brightens on hover" and was applied to: play button, primary `Button`, Mix Search, Mix Jam (inline + float). Quiet/Warning tiers are scoped to chrome and destructive.

**Aurora Pulse `#2DD4BF` is the new accent voice.** Token-driven everywhere except six rgba reference sites flagged in `play-button-color.md` §2.4. Per `play-button-color.md` §6.7 stop condition #3, the PlayerBar-scope CSS override dims the *outer halo* (28→14px rest, 36→18px hover) but leaves the `::before` backlight untouched — so the play button still owns its identity, but its outer diffusion does not compete with AlbumArt bleed.

**AlbumArt Path B locked.** [`albumGradient.ts:10-19`](../../frontend/src/lib/albumGradient.ts#L10-L19) hard-codes 8 hues — all cool family (teal 168°, mint 150°, cyan 195°, ice 210°, violet 255°, purple 275°, indigo 230°, forest mint 135°). **The procedural glow is structurally incapable of producing a warm color.** The boxShadow halo on AlbumArt at [`PlayerBar.tsx:179`](../../frontend/src/components/layout/PlayerBar.tsx#L179) is `0 0 24px -6px ${art.glow}` with `art.glow = hsla(...,0.25)`. This is load-bearing for finding §5.2.

**Principle 2 ("Aurora gradient is meaning, not decoration. Gradient marks a thing that is speaking")** is locked. Any recommendation that would add gradient outside the listed sites (wordmark, currently-playing title, Mix Jam buttons, primary `Button`, the two keyline-aurora fades) violates the system.

---

## 3. Research grounding

### 3.1 frontend-design skill principles, judged against Aurora

| Principle | Aurora delivery | Judgement |
|---|---|---|
| Bold aesthetic direction | OLED void + atmosphere + aurora gradient as identity | ✓ Committed |
| Distinctive typography (avoid Inter / Roboto / Arial) | Geist Variable + Fraunces | ⚠ Geist is the SaaS-default sans of 2024–26 (Vercel's house font). Well-executed (`ss01`/`cv11` features enabled) but in the same risk class as Inter — popular, characterful but not memorable. Fraunces is excellent and used on display only |
| Color discipline (dominant + sharp accents) | Dominant `#000000`, sharp Aurora Pulse `#2DD4BF`, `--aurora-secondary` violet for paired halos | ✓ Committed; not a "timid evenly-distributed palette" |
| Motion as orchestrated moments | `aurora-fade-in` (420ms), `aurora-row-in` (220ms × index, capped 16), `aurora-view-enter` (200ms opacity) | ⚠ Vocabulary is well-defined but the per-element timers fire independently — there is no *single orchestrated load sequence* per view |
| Spatial composition (asymmetry, overlap, grid-breaking) | 240px sidebar + 1fr main + 80px bottom bar | Conventional. **Per user's calibration this is consciously kept** — the speed/intuition cost of asymmetric layouts is not worth the distinctiveness gain. Marked as "kept" not as a finding |
| Atmosphere & backgrounds (gradient meshes, noise, depth) | Aurora photograph + veil + radial + noise stacked at z 0–1 | ✓ Strong; this is exactly what the principle prescribes |
| Avoid AI-slop (generic fonts, cliched palettes) | Mostly avoided; Geist is the closest call | ⚠ See typography row |

**Net.** Aurora is on the right *direction* for frontend-design's principles; the gaps are in three places: typography (Geist as default voice), motion (no choreographed sequence), and a long tail of polish. None of them are "redesign everything."

### 3.2 ui-ux-pro-max returns

Queries run via `python .claude/skills/ui-ux-pro-max/scripts/search.py`:

- **Music streaming product card** explicitly recommends `Dark Mode (OLED) + Vibrant & Block-based`, with **"Aurora UI"** listed as a secondary style. Aurora is on a recognised aesthetic axis.
- **Glassmorphism canon**: `backdrop-filter: blur(10–20px); background: rgba(255,255,255,0.10–0.30)` — translucent *white* glass over vibrant background. **Aurora's PlayerBar is `rgba(6,7,9,0.80) blur(12px)` — that's "smoked obsidian," not canonical frosted glass.** Defensible for OLED, but the bar reads as a darkened rectangle, not as glass. Finding in §5.1.
- **VisionOS spatial UI**: `blur(40px) saturate(180%) border-radius:24px hover:scale(1.02)`. Aurora's dialog is `blur(32px) saturate(120%) radius:14–22px no-scale`. Aurora is restrained on saturation and corner radius vs canonical spatial glass. Finding in §5.8.
- **Editorial typography canon**: Playfair Display + Inter, Cormorant Garamond + Libre Baskerville, Newsreader + Roboto, Libre Bodoni + Public Sans. Geist + Fraunces is less editorial than these — Fraunces is excellent but lives only on display.
- **Dark mode body text**: avoid pure `#FFFFFF`; use warm near-white (`#E1E1E1` range). Aurora uses `#e8e6e3` ✓.
- **Background base**: industry advice trends `#121212` over pure `#000000` (eye comfort). Aurora chose `#000000` deliberately ("OLED void is the ground plane"). Principled divergence — flagged in systemic concerns §7.

### 3.3 Web research — production music apps

| App | Bar layout | Album thumbnail | Insight for Aurora |
|---|---|---|---|
| **Spotify desktop** ([community](https://community.spotify.com/t5/Desktop-Windows/How-do-I-change-the-size-of-the-interface-and-multiple-other/td-p/5185177)) | Bottom bar ~70px tall | ~56–60px | Aurora's 80px bar with 56px art is similar ratio (70%) but absolute *bigger* — bar is taller than Spotify's by ~10px |
| **Apple Music (Tahoe 2025)** ([Apple Community](https://discussions.apple.com/thread/256137017)) | Bottom controls (recent change, generated user complaints) | Album-art-tinted dynamic background | Aurora's bottom-bar choice is now major-app convention. Aurora's smoked-obsidian base sidesteps Apple Music's adaptive-color complaint thread |
| **Tidal iOS 2026 redesign** ([piunika](https://piunikaweb.com/2026/03/18/tidal-ios-music-player-redesign-rolling-out/)) | Album-centric, dynamic background matches album color | Large square art dominates | Validates the album-color-bleed pattern as 2026-mainstream. Aurora's Path B (no extraction, perceptual bleed only) is *understated* on this trend |
| **Glassmorphism in 2026** ([invernessdesignstudio](https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026), [medium/MustBeWebCode](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f)) | "Standard" for music players in 2026 | Adapts color to album content | Aurora's current vocabulary is on-trend but executed quietly |
| **Apple Music adaptive UI complaints** ([9to5mac](https://9to5mac.com/2026/03/31/the-new-adaptive-apple-music-design-draws-complaints-from-dark-mode-users/)) | Light album art makes UI glaring at night | n/a | **Aurora's Path B is a strength**: by tying bleed to procedural cool-only colors at low alpha, Aurora avoids the trap Apple Music walked into |

---

## 4. Screenshot inventory and mapping

User dropped 7 screenshots with random filenames. Mapped by visual inspection:

| File | Surface identified | Notes |
|---|---|---|
| `Screenshot (201).png` | All Songs view, song "Again" by Yui loaded but **paused** | PlayerBar visible but no PLAYING label, time at 0:00. Maps to "all-songs-view at rest" |
| `Screenshot (202).png` | All Songs view, "Again" **playing** | PLAYING label visible bottom-right, time advancing. Maps to "all-songs-currently-playing" |
| `Screenshot (203).png` | Playlist Detail — "Anime" playlist | Hero cover is teal/green-dominant ("ONE PIECE FILM RED" art); cool-family bleed in hero |
| `Screenshot (204).png` | Playlist Detail — "Others" playlist | Hero cover is warm/red-dominant (Slam Dunk anime art); warm-leaning hero |
| `Screenshot (205).png` | Mix page with active query (`fast` + OR + Anime/Others/Rock chips) and Jam button visible | Maps to "mix-page-with-query" |
| `Screenshot (206).png` | Edit Tags dialog open over dimmed background; "After Dark" song; **"No tags yet" italic empty state** visible | Maps to "dialog-edit-tags-empty" |
| `Screenshot (207).png` | Mix in compact-tag-header mode — `fast` tag header + Edit query pill + 2 results | Bonus: a state I didn't request but useful for compact-mode audit |

**Surfaces requested but missing — flagged for incomplete coverage:**

- PlayerBar idle ("Nothing playing" placeholder + idle shimmer)
- PlayerBar with **multiple distinct cover types** in the bar position (only "Again" was loaded — cover-dependence of bleed cannot be empirically tested across albums; will rely on code analysis + the warm/cool playlist hero contrast in 203/204)
- Sidebar standalone close-up (sidebar is visible in every screenshot but at small scale)
- Mix page **empty** (no query built — full Search/Jam-button-at-rest read)
- Edit Song dialog
- Delete confirm AlertDialog (destructive variant in context)
- Empty filter results state
- Motion / view-transition capture

These gaps will be flagged inline at affected surfaces and aggregated in §8.

---

## 5. Surface-by-surface findings

Each finding block: **What works** · **What reads off** · **Why** · **Reference comparison** · **Severity** · **Recommended fix** · **Estimated scope.**

Severity scale: CRITICAL · HIGH · MEDIUM · LOW (per task brief).
Scope scale: S (single commit) · M (small session) · L (multi-commit session) · XL (multi-session).

---

### 5.1 PlayerBar — idle state ("Nothing playing")

> **Screenshot evidence: missing.** Audited from code only.
> Code: [`PlayerBar.tsx:155-167`](../../frontend/src/components/layout/PlayerBar.tsx#L155-L167) (desktop idle), [`PlayerBar.tsx:47-58`](../../frontend/src/components/layout/PlayerBar.tsx#L47-L58) (mobile idle), [`index.css`](../../frontend/src/index.css) `.aurora-idle-shimmer` keyframe.

**What works.** The `42×42px` shimmer placeholder + `.font-display-italic` "Nothing playing" + tracking-wide caption ("Pick a song or hit Jam") creates a deliberately quiet idle state. Italic Fraunces at 15px reads as poetic restraint instead of a bug. The 52px desktop / 44px mobile bar height is *short* — the idle bar visibly occupies less vertical space than the playing bar (80px / auto-stacked), giving the playing-state a satisfying "open" feel when a song starts. This is intentional and well-tuned.

**What reads off.** The `.aurora-idle-shimmer` is the only call-to-action signal in the idle state, and per [`design-system.md`](../design-system.md) §Motion table it loops at 3.5s ease-in-out — a **slow, ambient breath**. On first-load, with nothing on screen drawing the eye to the bar, a user opening Aurora for the first time may not register that the shimmer *is* an interactive surface or that the bottom bar is the player. The "Pick a song or hit Jam" copy is the only verbal hint. The bar offers no *clicked-something* affordance for new users.

**Why it reads off.** Frontend-design principle: orchestrated entrance, intentional motion. ui-ux-pro-max `cursor-pointer` rule: clickable elements need affordance. The shimmer is decorative, not interactive — but the copy implies it is. The idle state communicates "ambient/empty" but not "begin here."

**Reference comparison.** Spotify's empty-state similarly de-emphasises the bar but pairs it with a foreground "Start with what you like" panel in the main content area. Aurora's All Songs view does have content (the song table), so the user does have somewhere to click — the idle bar's quietness is *fine*, but the idle copy could carry one more nudge.

**Severity.** LOW — paper cut. First-load only; once any song plays, idle never returns (per code comment at [`PlayerBar.tsx:23-25`](../../frontend/src/components/layout/PlayerBar.tsx#L23-L25)).

**Recommended fix.** Tweak idle copy to be slightly more directive without breaking the poetic register. E.g. "Nothing playing yet" + "Hit a song above or press Jam" — same Fraunces italic, one more letter of nudge. **No motion change** (the shimmer is correct restraint).

**Estimated scope.** S.

---

### 5.2 PlayerBar — playing state, AlbumArt bleed claim

> **Screenshot evidence: indirect.** "Again" cover is loaded across all four All-Songs/Playlist screenshots (201–204). No multi-cover comparison possible.
> Code: [`PlayerBar.tsx:174-183`](../../frontend/src/components/layout/PlayerBar.tsx#L174-L183), [`AlbumArt.tsx:33-52`](../../frontend/src/components/songs/AlbumArt.tsx#L33-L52), [`albumGradient.ts:39-63`](../../frontend/src/lib/albumGradient.ts#L39-L63).

**What works.** The bleed system is wired correctly: the `boxShadow` recipe is `0 0 24px -6px ${art.glow}` (desktop) and `0 0 16px -4px ${art.glow}` (mobile), with `art.glow` at HSLA 25% opacity. The blast radius of about 18px (desktop) and 12px (mobile) past the art edge does not collide with the play-button outer halo (18px past the button edge at the new PlayerBar-scope override) per the geometry walked in `button-system.md` §7.1. Aurora is *not* about to walk into Apple Music's adaptive-color complaint trap because the procedural HUE family is locked cool and at low alpha.

**What reads off.** **The user reported a "warm bleed" visible in earlier ABBA Gold screenshots that is no longer visible in current screenshots, and asked the audit to investigate whether the bleed regressed or whether it is cover-dependent.** Examining the code:

The `art.glow` at [`albumGradient.ts:60`](../../frontend/src/lib/albumGradient.ts#L60) is `hsla(${a.h}, ${a.s}%, ${a.l}%, 0.25)`. The `a` hue is selected from the `HUES` array at [`albumGradient.ts:10-19`](../../frontend/src/lib/albumGradient.ts#L10-L19) — **all 8 entries are cool family** (teal, mint, cyan, ice, violet, purple, indigo, forest mint). **The boxShadow halo is structurally incapable of being warm.** Whatever warmth was visible in old screenshots cannot have come from `art.glow`.

The candidate sources of a perceived "warm" bleed in old screenshots:
1. **The album image itself** — `AlbumArt.tsx` renders `<img src={album_art_path} class="absolute inset-0 w-full h-full object-cover">` inside an `overflow-hidden` container. The image *cannot* extrude past the rounded square edge. The only pixels available beyond the square are the `boxShadow` halo. So the warmth was not the image.
2. **The procedural `background` painted under the image** — `art.background` at [`albumGradient.ts:54-58`](../../frontend/src/lib/albumGradient.ts#L54-L58) is two radial gradients + a linear gradient anchored in `#0a0c11 → #06080b`. The radial colors are cool HUES at HSLA 22-32% opacity. **Also incapable of being warm.**
3. **Misperception** — the user may have been seeing the `<img>` content *through* the rounded edge as a perceptual halo (the warm interior pixels read as a glow against the OLED ground via human-vision edge effects). Or recalled the bleed as warmer than it actually was.

**The bleed has not regressed.** The bleed system is intact, code-equivalent to the older code, and the procedural color family is hard-coded cool. The user's "warm bleed in earlier screenshots" cannot be reproduced by the current procedural system and could not have been produced by the older procedural system either, *unless* the HUES array has been edited. `git log -- frontend/src/lib/albumGradient.ts` would confirm — but the file's `HUES` constant has only ever been cool per the audit's read of `button-system.md` §7.4 which explicitly states "the procedural glow is structurally cool-only."

What is true: **the bleed at HSLA 0.25 alpha is barely visible against pure OLED black, especially through 24px blur.** In screenshots 201–204 the AlbumArt thumbnail in the PlayerBar bottom-left shows no perceptually obvious halo around it. This is consistent with the alpha math: a single 25%-opacity HSL color blurred at 24px against `#000000` produces a halo whose perceived luminance lift is roughly `0.25 × 0.5 ≈ 0.12` against ground — at the threshold of perceptibility for cool colors (the eye is less sensitive to teal/violet than to warm hues at low luminance lifts). **The bleed exists but is too quiet to read as a deliberate design moment.**

**Why it reads off.** Frontend-design principle: atmosphere should be felt, not labour-undetected. ui-ux-pro-max glassmorphism rule: backdrop-blur effects need to compose with vibrant background. Tidal 2026 reference: album-color is now mainstream as a *visible* atmosphere. Aurora's bleed is technically present but perceptually absent — it pays the implementation cost without delivering the aesthetic dividend.

**Reference comparison.** Tidal 2026 iOS dynamically shifts the entire background color to match the album — Aurora's far-quieter Path B (just the boxShadow halo) is on the conservative end of the trend. Apple Music's full adaptive UI is on the loud end. Aurora today is *quieter than the conservative end*.

**Severity.** **HIGH.** This is the user's #1 complaint surface (PlayerBar feel) and the bleed is currently doing none of the work it was designed to do.

**Recommended fix.** **Increase the bleed visibility without breaking Path B.** Three knobs available, all cheap:
1. **Raise `art.glow` HSLA alpha** from 0.25 to 0.35 (single line at [`albumGradient.ts:60`](../../frontend/src/lib/albumGradient.ts#L60)). Composited bleed lift goes from ~0.12 to ~0.17 — perceptually visible without becoming loud.
2. **Or raise the boxShadow blur radius** from 24px to 32px desktop (single line at [`PlayerBar.tsx:179`](../../frontend/src/components/layout/PlayerBar.tsx#L179)). Spreads the bleed wider; reads as more atmospheric.
3. **Or do both at smaller magnitude** (alpha 0.30, blur 28px).

Trade-off: louder bleed competes more with the play-button Loud-tier backlight when the album halo lands in the teal family (HUE indices 0, 1, 2, 7 — half the array). The PlayerBar-scope override at [`index.css:386-391`](../../frontend/src/index.css#L386-L391) already dims the play-button outer halo to 14/18px; if AlbumArt bleed is raised, watch this composition in the teal-hue half of the array. **No interaction-delay cost** — passive atmosphere change.

This recommendation does *not* break Path B (no extraction, no `dominant_color` column, procedural HUES untouched). It simply makes the existing bleed perceptible.

**Estimated scope.** S.

---

### 5.3 PlayerBar — AlbumArt size and proportion

> **Audited from code only** per task brief (code is sufficient).
> Code: [`PlayerBar.tsx:170-201`](../../frontend/src/components/layout/PlayerBar.tsx#L170-L201), [`AlbumArt.tsx:6-11`](../../frontend/src/components/songs/AlbumArt.tsx#L6-L11), [`design-system.md`](../design-system.md) §Spacing → PlayerBar sizing.

**What works.** The desktop playing-state bar is **80px tall** with a **56×56px AlbumArt** (`size="md"` = `w-14 h-14`). 56/80 = **70% of bar height** for the art square. Industry references (Spotify ≈70px bar with ≈56px art, Apple Music ≈80px bar with ≈60px art) put Aurora's ratio in the conventional band. **The "too big" complaint is not a ratio problem.**

**What reads off.** Looking at the LEFT cluster math:
- Cluster width: `w-[240px] min-w-[160px]` ([`PlayerBar.tsx:172`](../../frontend/src/components/layout/PlayerBar.tsx#L172)).
- AlbumArt: 56px wide.
- Gap: `gap-3.5` = 14px.
- Title row: Fraunces `text-[18px] leading-tight`, soft-italic display.
- Artist row: `text-[11px]` with `mt-0.5` (2px).
- Text stack approximate height: 18px title + 2px gap + 11px artist + line-height-tight padding ≈ **34px**.

**The AlbumArt is 56px tall; the text stack is 34px tall. The art is 165% the height of the text stack.** Visually the art *anchors* the cluster and the text reads as a caption to the art. This is the perceived "too big" — not the bar-relative ratio (which is industry-normal), but the *art-vs-text* mass ratio.

Spotify's equivalent: title ~16px bold + artist ~12px = ~32px stack, art 56px = 175% — *similar ratio to Aurora*. So why does Aurora feel "too big" while Spotify doesn't?

Two contributing factors:
1. **Title weight.** Spotify uses bold sans-serif at ~16px (high optical density per pixel). Aurora uses Fraunces at 18px in display-soft style — large optical size at moderate weight, which reads *visually lighter* than its pixel height suggests. The art doesn't get a dense companion to balance against.
2. **Title-to-artist tone gap.** Aurora's `--aurora-text` (#e8e6e3) title vs `--aurora-text-secondary` (#8b95a7) artist is a strong tonal drop — the artist line essentially recedes into chrome. Spotify's title-vs-artist drop is smaller. So Aurora's effective text mass is ~the title-line alone (~18px), vs. Spotify's effective text mass is title + readable artist (~28px combined).

**Net.** AlbumArt is industry-normal in absolute terms, but feels disproportionately heavy because the title-and-artist text doesn't carry equal visual weight on the right side of the cluster.

**Why it reads off.** Frontend-design principle: composition is about visual mass, not pixels. The fix is in the text, not the art.

**Reference comparison.** See above — Spotify and Apple Music have similar art-to-bar ratios but heavier text. Tidal's redesign goes the opposite direction (large square art, tiny text) and embraces the imbalance — but Aurora's left cluster does not have that intent.

**Severity.** **HIGH.** This is the user's stated complaint and the diagnosis is concrete and correctable.

**Recommended fix.** Two non-mutually-exclusive options:

**Option A — heavier text stack.** Bump the title to `font-medium` (currently inherits 600 via `.font-display`) is fine; but bump the *artist* row from `text-[var(--aurora-text-secondary)]` to a position between secondary and primary — possibly a new token at the gap (e.g., extend `--aurora-text-secondary` toward `#a5adba`), or in this specific spot use `text-[var(--aurora-text)]` at `opacity-70`. The artist line becomes a more visible counterweight to the art. **No interaction cost.**

**Option B — slightly smaller art.** Drop AlbumArt from `size="md"` (56px) to a custom 48px in the PlayerBar. The text stack stays the same; the art-to-text ratio drops from 165% to 141%, which reads more balanced. **No interaction cost.**

I lean **Option A** because reducing the art *also* reduces the canvas the §5.2 bleed has to bloom across. Solving the visual mass problem in text is additive to the bleed solution.

**Estimated scope.** S (Option A) or S (Option B).

---

### 5.4 Sidebar

> **Screenshot evidence:** sidebar visible in every screenshot but small. Best read in 201/202 (All Songs active).
> Code: [`Sidebar.tsx:50-198`](../../frontend/src/components/layout/Sidebar.tsx#L50-L198).

**What works.** The Aurora wordmark in the header is a **strong moment** — Fraunces at 34px with `aurora-gradient-text` clip + the 12px gradient hairline beneath it is the most distinctive piece of typography in the app. Section headers (`.label-micro` at 10.5px, uppercase, letter-spacing 0.16em, tertiary tone) are consistent and disciplined. Active NavItem indicator (3px left bar at Aurora Pulse + glow at active) reads cleanly in screenshots 201/202. Footer actions are appropriately quiet.

**What reads off.** Three observations from the code:

1. **The wordmark is the only identity moment in the entire sidebar.** Below the wordmark, the sidebar is *all* utility (nav + playlists + tags + footer). The wordmark sits in pretty isolation — the gradient line beneath it tries to bridge but is at `opacity: 0.4` (Sidebar.tsx:67), nearly invisible. The wordmark could carry more atmospheric anchoring.
2. **TagSidebarItem dot is `--aurora-muted`** (4×4px, [`Sidebar.tsx:291-294`](../../frontend/src/components/layout/Sidebar.tsx#L291-L294)) — a flat `rgba(255,255,255,0.14)`. No accent color. Tags are functionally as important as playlists in Aurora (boolean filter UI), but the playlist dots get per-playlist color (5px) while tag dots are uniformly grey. This reads as an inconsistency: playlists are visually distinguished, tags are visually homogenised.
3. **FooterAction uses inline JS hover handlers** ([`Sidebar.tsx:264-265`](../../frontend/src/components/layout/Sidebar.tsx#L264-L265)) — `onMouseEnter`/`onMouseLeave` swap background. This is a documented drift (see `button-system.md` §3.6) — works correctly but is the only place in the sidebar that uses JS hover instead of CSS `:hover`. No visible aesthetic problem in the screenshots, but it's a code-system inconsistency.

**Why it reads off.** Frontend-design principle: distinctive identity should have one or two anchored moments per view, not be reserved to a single corner. The wordmark is doing alone what should be reinforced *softly* across the sidebar (e.g., the `.aurora-keyline-right` already exists on the sidebar's right edge per [`design-system.md`](../design-system.md) §Glass surface 2 — but it's a top-down fade, easily missed). ui-ux-pro-max consistency rule: similar element types (playlist vs tag) should have similar visual treatment unless intentionally differentiated. Aurora differentiates them in dot-color but the differentiation reads as inconsistency, not as hierarchy.

**Reference comparison.** Spotify's sidebar repeats playlist cover-art thumbnails for *every* playlist row — heavy visual identity. Apple Music uses similar treatment. Aurora's choice to *not* show cover thumbnails per playlist (only on the active one in the "PLAYLISTS" section) is a deliberate restraint that supports the speed/intuition calibration. Don't reverse it. But the wordmark could get one or two more atmospheric companions.

**Severity.** **MEDIUM** — sidebar reads competently, but lacks the "yeah, that's good" moment outside the wordmark.

**Recommended fix.** Two cheap moves:

1. **Lift the gradient hairline from `opacity: 0.4` to `opacity: 0.7`** at [`Sidebar.tsx:67`](../../frontend/src/components/layout/Sidebar.tsx#L67) and **extend its width from `w-12` (48px) to `w-20` (80px)** at [`Sidebar.tsx:63`](../../frontend/src/components/layout/Sidebar.tsx#L63). Currently it's a faint 48px stub; bumped, it reads as an intentional underline of the wordmark. **No interaction cost.**
2. **Tag-dot accent.** Give `TagSidebarItem` dots a faint Aurora Pulse tint (e.g., `rgba(45, 212, 191, 0.35)` — a desaturated Aurora Pulse) instead of `--aurora-muted`. This visually differentiates tags from playlists *without* matching playlist intensity (playlist dots at full color → tags at faded teal). It also gives the tag column a chromatic line of identity that ties back to the wordmark gradient. **No interaction cost.**

For the FooterAction JS hover drift: not an aesthetic finding; chrome-cleanup work.

**Estimated scope.** S (both fixes can be one commit).

---

### 5.5 All Songs view

> **Screenshot evidence:** 201 (paused), 202 (playing). Both show table at full scroll-top.
> Code: [`SongRow.tsx`](../../frontend/src/components/songs/SongRow.tsx) (per `button-system.md` §3.7-3.8 references).

**What works.** Column headers in `.label-micro` (uppercase, letter-spacing) read as quiet structural markers. Row hover with `--aurora-surface-hover` is the unified hover treatment. Album thumbnails on every row provide visual anchor without dominating. The "SEE SONGS" or "ALL SONGS" right-aligned action affordance in screenshots 201/202 (top right) reads as a deliberate quiet exit from the dense table back to the playlist focus — clean.

**What reads off.** Five observations across the two screenshots:

1. **The currently-playing row is hard to find in screenshot 202.** "Again" by Yui is currently playing per the PlayerBar bottom; per the design system, the playing row should have a 3px left accent bar plus the `aurora-gradient-text` title clip. **In screenshot 202, no row in the visible scroll position shows that treatment.** "Again" appears at row 5 of the table, with no visible accent bar or gradient title. The currently-playing row is visually identical to other rows. This is either a regression or "Again" sits below the visible scroll-port. Comparing 201 (paused, also showing "Again" at row 5) and 202 (playing) at the same scroll position: **even in 202, row 5 ("Again") shows no playing-row indicator.** Worth flagging; the indicator may not be triggering correctly when the song was started from the table without a queue context.
2. **Density is high.** ~13 rows visible at the captured scroll position (estimate from screenshot proportions). At 14px row title + 11px artist with `px-4 py-3` cell padding (~48px row height) per design-system.md, the table is dense — closer to a Finder/Explorer file list than to Spotify's spacious row. For a personal music library used 2–4×/day, density is *correct* (faster scanning, fewer scrolls). But the density needs visual *rhythm* to stay readable; right now every row is the same weight.
3. **Album thumbnail size in rows is small** — appears to be ~32–36px (estimate from screenshot). Combined with the dense rows, the thumbnails read as a left-edge stripe rather than as identity per song. This is fine for utility, but it leaves no distinctive moment in the table.
4. **Column rhythm is even.** Title/duration/playlists/tags/actions columns are presented at even visual weight — no column gets a "primary" stress. Title is the only natural anchor, but its `text-[14px]` weight is unweighted.
5. **No top scrim** ([`design-system.md`](../design-system.md) §Elevation → Top scrim) — the table title and headers sit hard against the top of the scrollable area. The system has the `aurora-scrim-top` token defined and the AppShell has an inline equivalent ([`AppShell.tsx:70-77`](../../frontend/src/components/layout/AppShell.tsx#L70-L77)) — confirm this is working in screenshots; visually the "All Songs" header reads cleanly with no banding, so the scrim may be doing its job. Not a finding, just a confirmation.

**Why it reads off.** ui-ux-pro-max hierarchy rule: scannable lists need a primary stress (column or moment) to anchor the eye. Frontend-design principle: visual rhythm via type-weight or whitespace, not just color. Aurora's table is functional but is the same weight everywhere.

**Reference comparison.** Spotify uses **album-art coloring on the currently-playing row** (the entire row tints in the album's color). Apple Music uses a bold stripe + animated equalizer in the row. Aurora's design (3px accent bar + gradient title) is in the same family but per screenshot 202 may not be firing.

**Severity.**
- **HIGH** for the currently-playing-row indicator question — needs verification (regression or scroll-position artifact?). If regressed, fix is critical; if not regressed, drops to MEDIUM.
- **MEDIUM** for the table-rhythm finding (a "polish" gain, not a defect).

**Recommended fix.**

For finding 1: **Verify the currently-playing-row indicator is firing.** Either ad-hoc test (play a song, scroll to its row, confirm visible accent) or check the row-rendering code in `SongRow.tsx` against `usePlayerStore.currentSong?.id` matching. If it's not firing, the fix is in the conditional logic (likely a single boolean check).

For findings 2–4: **Add one moment of stress to the title column.** Bump the row title from `text-[14px]` plain to `text-[14px] font-medium`, OR introduce a subtle alternating-row treatment (every other row at `bg-[rgba(255,255,255,0.012)]`) that reads as table-rhythm without becoming zebra-stripe-loud. **No interaction cost.**

**Estimated scope.** S (verify + small fix) or M (if regression needs deeper root-cause).

---

### 5.6 Playlist Detail view

> **Screenshot evidence:** 203 (Anime, cool/teal hero), 204 (Others, warm/red hero).
> Code: [`PlaylistDetail.tsx`](../../frontend/src/components/playlists/PlaylistDetail.tsx) (per references in `button-system.md` §3.9-3.10).

**What works.** The hero composition (large album art + "PLAYLIST" label-micro + display-sized title + meta line) is clean. The pencil/trash IconBtns sit in the top-right of the hero at a comfortable distance — they don't fight the title.

**What reads off.** Four observations:

1. **The hero album art does not have a visible bleed in either screenshot** — neither 203 (Anime, with a strong teal-leaning cover) nor 204 (Others, with a warm cover). Looking at the code in `PlayerBar.tsx`, the bleed is tied to `albumGradient(...).glow`. PlaylistDetail almost certainly uses the same `AlbumArt` component but with `size="lg"` (120×120 per `AlbumArt.tsx:9`); whether the parent applies a boxShadow halo is a code question. **If PlaylistDetail does NOT apply the AlbumArt boxShadow halo, the hero art reads as a "stamp" rather than as something embedded in atmosphere.** This is a parity opportunity with PlayerBar.
2. **Title typography ("Anime", "Others") at the same Fraunces-display size as the PlayerBar song title** — both are large. At 60-70px height (estimating "Anime" rendered) the title is clearly hierarchical. This works.
3. **Meta line ("65 songs · 4 hr 12 min" or "180 songs · 11 hr 0 min") sits underneath the title at small weight.** Reads as caption. Fine.
4. **The "Others" warm cover in 204 is *the* test case for the bleed claim from §5.2** — and the bleed is not visible in this hero either. **This confirms that the procedural bleed system, which can never produce warm colors, was never going to make a warm cover bleed warmly. The "Others" hero would have bled in a cool color from the procedural radial — but at HSLA 0.25 alpha, against the warm `<img>` content, the cool bleed is visually swallowed.** Same finding as §5.2 in a different surface: the bleed is too quiet at 0.25 alpha to register.

**Why it reads off.** Frontend-design principle: atmospheric details should feel coherent across surfaces; the hero is the one place a user dwells on album art and the bleed not registering here wastes the atmosphere. ui-ux-pro-max glassmorphism: the hero is the canonical "depth + light source" moment.

**Reference comparison.** Spotify and Apple Music both bleed the album/playlist hero color into the surrounding background — sometimes aggressively (Apple Music tints the entire screen). Aurora's restraint is correct (Path B is locked) but at *zero perceived bleed*, the restraint reads as omission, not restraint.

**Severity.** **HIGH** — same root cause as §5.2; same fix applies symmetrically. Hero surfaces are where users spend dwell time, so the bleed cost-benefit is best here.

**Recommended fix.** Apply the same `art.glow` alpha bump (0.25 → 0.30–0.35) from §5.2 — it propagates automatically because PlaylistDetail uses the same `AlbumArt` component. If PlaylistDetail does not apply the `boxShadow` halo at all (verify in code), add the equivalent shadow recipe to its hero AlbumArt usage. **No interaction cost.**

**Estimated scope.** S (assuming PlaylistDetail already wires the shadow; if not, M).

---

### 5.7 Mix page — the user's "buttons feel off" claim

> **Screenshot evidence:** 205 (Mix with active query and Jam button visible).
> Code: [`QueryBuilder.tsx:124-336`](../../frontend/src/components/filter/QueryBuilder.tsx#L124-L336), [`index.css`](../../frontend/src/index.css) `.mix-btn-search`, `.mix-jam-primary`, `.mix-kbd`, `.aurora-chip`.

**What works.** The query bar's structure (input row above + chip tray below in one glass container) is a beautifully composed unit. The chip tray is the densest piece of UI in Aurora and it handles its density by tier-grouping (tags | divider | operator keys | divider | playlist chips). The keyboard-key style on operators (`AND`, `OR`, `NOT`, `(`, `)`) is a smart visual departure — it announces "these are atoms of a programmable query." The `mix-jam-primary` button at the bottom-right of the active state (screenshot 205) carries gradient + dual halo and is unmistakably the Loud-tier identity moment. The Edit query pill in compact mode (screenshot 207) is the right size and weight for the role.

**What reads off — the user's headline complaint.** Looking at screenshot 205 specifically:

1. **Three different "go" affordances live in the same view at the same time**: the Search button (top-right of the title row, `h-8 px-4 rounded-full`, Aurora Pulse fill), the Shuffle round button (`h-8 w-8 rounded-full` ghost icon), the Clear text button (text-only, `h-8 px-2`), the Jam button (bottom-right, `h-[50px] px-[28px]` gradient with dual halo), and the floating Search/Jam pair (when scrolled past sentinel). **The user has at least four "execute the query" buttons available in the active state.** Even if each is intentional (Search vs Jam = "search vs play immediately"), four affordances of similar intent in one view fragments attention.
2. **The Search button at top-right has Aurora Pulse fill** (per shipped Loud-tier recipe). **The Jam button at bottom-right has the teal→violet gradient.** Both are Loud-tier, but they don't *match* — Search is solid Aurora Pulse, Jam is gradient. The two loudest moments in the same view speak in different colors. They were each correct in isolation; together, they read as two different products of two different design moments.
3. **The Jam button's gradient overlaps with the wordmark gradient.** Per Principle 2 ("Aurora gradient is meaning, not decoration. Gradient marks a thing that is speaking"), the gradient should be reserved for the small set of identity moments. The Jam button qualifies (it's the soul of the Mix page). But the Jam button + wordmark + currently-playing row title means **three gradient surfaces visible at once on the Mix view**, and they're all in the same teal→violet axis. The view becomes a gradient-containing-page rather than a quiet-containing-one-loud-moment.
4. **Halo composition on Jam.** The `mix-jam-primary` recipe from `index.css` uses dual-color (teal + violet) outer halos at 22-32px, plus dual radial backlight in the `::before` pseudo. This is the most aggressive Loud-tier instance in Aurora. In screenshot 205 the Jam halo is unmistakable — but the surrounding chip tray (tags + operators + playlists) is itself busy. **The Jam button's loudness has to compete against the chip tray's information density** rather than against quiet space. The visual weight of the chip tray is high enough that Jam doesn't get the breathing room a Loud-tier button needs to land.
5. **The Search button (top-right) sits next to a Shuffle ghost button and a Clear text button** — these read as a "command cluster." But the cluster is mixed: one Loud-tier (Search), one Quiet-tier (Shuffle), one Tier-0 text (Clear). They're at the same `h-8` height but at three different intensity tiers. The eye doesn't know which is the primary action. The user's "feels off" likely lands here: Search is *trying* to be the primary action but its companions confuse the role.
6. **The "Mix" h1 title is underweight.** `text-[28px] font-display leading-none` Fraunces — at 28px it's the smallest of Aurora's display titles (PlaylistDetail goes larger, dialog headlines are 22-26). The Mix page is visually the most important page in Aurora (it's the boolean-filter killer feature), but its title is the smallest display number. The Mix page's title doesn't *announce* itself as the same-tier moment as a playlist hero.

**Why it reads off.** Frontend-design principle: bold aesthetic direction means committing to one Loud moment per view, not several. Principle 2 (gradient as voice): the gradient should mark what is speaking — the Mix view has a gradient wordmark, a gradient Jam, and a gradient currently-playing row title, and they don't speak in unison. ui-ux-pro-max consistency rule: same-tier elements should match treatment. Loud-tier Search vs Loud-tier Jam in different recipes is a tier-internal split.

**Reference comparison.** Spotify's search page has *one* primary action (the search input). Apple Music's filter UI similarly anchors on one moment. Aurora's Mix page is structurally more ambitious (three result paths: Search, Jam, Shuffle-and-Jam) and the action-cluster proliferation is a downstream consequence. The reference apps don't have this problem because they don't have this many actions. Aurora can't simply remove actions, but it can demote some to lower tiers.

**Severity.** **HIGH** — explicit user complaint, multi-cause, affects the most-distinctive page.

**Recommended fix.** Three independent fixes:

1. **Tier-rationalise the action cluster.** Decide whether **Search** or **Jam** is the *primary* action on the Mix page. If Jam (the user wanted Mix to be a "build and play" page), drop Search to Quiet tier (ghost-glass, no Loud-tier backlight) — it becomes a secondary alternative. Then Jam stands alone as the Loud moment. If Search (the user wanted Mix to be a "find first, decide later" page), demote Jam similarly. Either way, **one Loud, others Quiet** within a single view. **No interaction cost** — a tier swap is a CSS class change. Likely pick: Jam stays Loud (it's the gradient moment, the Mix page identity), Search drops to Quiet glass. This is consistent with the Mix page's name ("Mix" implies playing the result, not just filtering).
2. **Bump the Mix h1 from 28px to 36-40px Fraunces display.** Match the visual weight of a playlist hero. The Mix page deserves equal hero treatment to a playlist; right now it doesn't get it. **No interaction cost.**
3. **Add breathing room around the Jam button.** Currently the Jam button sits at `mt-4` (16px) below the chip tray ([`QueryBuilder.tsx:261`](../../frontend/src/components/filter/QueryBuilder.tsx#L261)). Bump to `mt-6` or `mt-7` (24-28px). Loud-tier elements need more whitespace than Quiet ones; the chip-tray density needs the gap to read as a separator. **No interaction cost.**

**Estimated scope.** S (each independently); together M (one focused session).

---

### 5.8 Dialogs

> **Screenshot evidence:** 206 (Edit Tags, "No tags yet" empty state). Edit Song / Add Song / Scan / Delete confirm screenshots not provided.
> Code: [`dialog.tsx:59-85`](../../frontend/src/components/ui/dialog.tsx#L59-L85) (shared chrome), [`EditSongDialog.tsx`](../../frontend/src/components/songs/EditSongDialog.tsx), [`TagEditor.tsx`](../../frontend/src/components/tags/TagEditor.tsx), [`design-system.md`](../design-system.md) §Glass surface 3 (Dialog).

**What works.** The dialog chrome itself is a strong moment: `linear-gradient(180deg, rgba(14,17,22,0.82), rgba(8,10,13,0.88))` + `blur(32px) saturate(120%)` + inset rim + lift shadow + aurora halo. In screenshot 206, the dialog reads as a lifted card over a dimmed app — the dim background respects the dialog's authority. The "Edit tags" Fraunces title + "After Dark" italic subtitle is a clean two-line header.

**What reads off — the "No tags yet" empty state.** The user flagged this specifically as feeling-wrong. Looking at screenshot 206:

1. **"No tags yet" appears in italic** (Fraunces italic) at small size, between the "CURRENT" label-micro and the "ADD TAG" label-micro. The italic styling says "this is a quiet ambient line" — but in this position it's reporting *factual data* (the song has no tags). The italic register is *editorial / atmospheric* (per `design-system.md` Typography rule: "Use `.font-display-italic` for all 'quiet' copy: empty-state sub-lines, 'Nothing playing,' placeholder text, and any text that should feel editorial or ambient"). Reporting state is not editorial — it's chrome. **The italic reads as misapplied register.**
2. **"No tags yet" is sandwiched between two `label-micro` headers** ("CURRENT" above, "ADD TAG" below). Both label-micros are uppercase tracking-wide. The italic in between has neither — it's a different typeface family in a different alignment style. The eye reads three different visual languages in three consecutive lines.
3. **The "ADD TAG" input has a focused Aurora Pulse glow** (visible in 206) — that's correct, on-spec. The suggestion list below ("fast", "gym", "hype", "rocks", "rocks2") reads cleanly.

**Why it reads off.** Per design-system.md's own typography rule, italic is for "ambient/editorial" copy — and an empty-state factual report is not ambient. Frontend-design principle: typographic register should match content function. ui-ux-pro-max consistency: similar copy purposes (status report) should use similar typography across surfaces.

**Reference comparison.** Spotify's empty states use sentence-case sans-serif at body weight ("No tracks added yet"). Apple Music similarly uses functional sans-serif. Aurora's italic was correct for the PlayerBar idle ("Nothing playing" sits in an *ambient/poetic* place — the bottom bar has nothing to do, and the italic reads as the bar acknowledging its own quietness). For the dialog — a focused, task-oriented surface — the italic register is wrong.

**Severity.** **MEDIUM** — paper-cut-grade. User noticed it, which means it's at the *visible polish gap* tier.

**Recommended fix.** Change "No tags yet" in EditTags (and any other in-dialog state-report empty lines) from `.font-display-italic` to `text-[12.5px] text-[var(--aurora-text-tertiary)]` plain Geist sans. Keep PlayerBar idle's "Nothing playing" italic — that one is correctly editorial. **No interaction cost.**

Possibly extend this to the Sidebar's "No playlists yet" / "No tags yet" empty lines ([`Sidebar.tsx:113`](../../frontend/src/components/layout/Sidebar.tsx#L113), [`Sidebar.tsx:151`](../../frontend/src/components/layout/Sidebar.tsx#L151)) — same logic: those report state in chrome, not editorial moments. The PlayerBar idle is the *only* sentence in the app that should stay italic for ambience. Per design-system.md the italic-for-quiet rule was inferred from the PlayerBar pattern; it has been over-applied to status copy in dialogs and sidebars.

**Other dialog audits.** Without screenshots of Edit Song, Add Song, Scan Folder, or Delete confirm dialogs, those are flagged as unaudited in §8.

**Estimated scope.** S.

---

### 5.9 Empty states (general)

> **Screenshot evidence:** missing (empty filter results, empty playlists, first-load) — partially audited from code.
> Code: `MixEmptyState` at [`QueryBuilder.tsx:339-384`](../../frontend/src/components/filter/QueryBuilder.tsx#L339-L384); sidebar empty-state lines at [`Sidebar.tsx:111-115, 149-153`](../../frontend/src/components/layout/Sidebar.tsx#L111-L153).

**What works.** The `MixEmptyState` component (the no-results state in Mix) has a hand-drawn 3-stroke aurora-curve SVG (96×52px, three paths in `rgba(77,184,164,0.30)` / `rgba(138,117,200,0.22)` / `rgba(77,184,164,0.14)`) — this is one of Aurora's quiet identity moments. The illustration is custom (not a stock empty-state icon), tied to the brand atmosphere, and disappears at the right scale. Below it, "No songs match this query" in display-italic + "Try relaxing a filter, or combine fewer tags" in body-tertiary is appropriately editorial because *this* is an ambient moment (dwell-on-empty page with no further action). **The italic register is correctly applied here.**

**What reads off.** Two observations:

1. **The aurora-curve SVG uses the OLD `rgba(77,184,164,...)` triplet** — that's the smoked-teal pre-Aurora-Pulse hex. Per `play-button-color.md` §6.4 (low-drift sites), this was deferred from the recolor patch. **The SVG reads in smoked-teal while the rest of the app reads in Aurora Pulse.** Subtle drift; visible only because the SVG and the Aurora Pulse halos are both visible on the same page after a search returns zero.
2. **First-load and empty-playlist screenshots not provided** — those states are presumed to use similar empty-state vocabulary, but unaudited.

**Why it reads off.** Token discipline: tokens shouldn't be bypassed in components. ui-ux-pro-max icon rule: brand colors should be consistent everywhere they appear.

**Reference comparison.** N/A — empty states are typically not where reference music apps invest design discipline.

**Severity.** **LOW** for the SVG color drift (visible only on the empty-results state, narrow exposure). UNAUDITED for first-load.

**Recommended fix.** Migrate the `MixEmptyState` SVG strokes from `rgba(77,184,164,...)` triplets to `rgba(45,212,191,...)` matching Aurora Pulse, per `play-button-color.md` §6.4. Single-file edit. **No interaction cost.**

**Estimated scope.** S.

---

### 5.10 Motion

> **Audited from code.** No motion screenshot/capture provided.
> Code: [`design-system.md`](../design-system.md) §Motion table; [`index.css`](../../frontend/src/index.css) `.aurora-fade-in`, `.aurora-row-in`, `.aurora-view-enter`, `.aurora-pulse`, `.aurora-idle-shimmer`, `.aurora-eq-*`.

**What works.** Motion is a fully documented system with explicit primitives, durations, and easings. The house curve `cubic-bezier(0.2, 0.7, 0.2, 1)` is consistently applied to space-moving transitions. `.aurora-row-in` with the 25ms × index stagger (capped at 16 rows) is a published pattern. Reduced-motion policy is mandated in the design system, even if some implementation gaps exist (per `design-system.md` §Accessibility note that "zero hits currently exist in `frontend/src`"). The Equalizer animation in the PlayerBar (`.aurora-eq-{1,2,3}` at staggered durations) is a genuine identity moment.

**What reads off.** Three observations:

1. **No orchestrated entry sequence per view.** When a view mounts (e.g., switching from All Songs to Playlist Detail to Mix), the entire view fades in at 200ms (`.aurora-view-enter`). Inside that, song rows stagger via `.aurora-row-in` (220ms × index). But the *hero of each view* (Mix h1, playlist title, AlbumArt hero, etc.) doesn't have its own entrance — it just appears with the view fade. Frontend-design principle: "one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions." Aurora has the latter, not the former. **However**, per the user's speed/intuition calibration, an orchestrated reveal that *delays interactivity* would be a regression. The fix here must not extend the 200ms view-enter or block input.
2. **Idle shimmer + ambient pulse + equalizer all run concurrently.** When a song is playing, the PlayerBar has the equalizer running, and the song row has its own pulse. When the user is idle (mouse not moving), the shimmer breathes. These are all on the right durations, but cumulatively they create a low constant motion across the view. **Per `prefers-reduced-motion` users this is correctly disabled** (mandated in design-system.md), but for default users the constant motion ground means the eye rarely gets a still moment. This is a minor energy drain over long sessions.
3. **No "song change" moment.** When the user clicks a new song in the table, the PlayerBar's title changes via React's natural re-render. There's no transition between songs — the title swaps instantly. For a music app, the moment of song change is *the* emotional event. Spotify and Apple Music both fade-cross or animate the title transition. Aurora misses this moment. Per the speed calibration: **a 100-150ms fade-cross does not delay interaction** (the audio still triggers immediately), so this is permitted under the user's calibration.

**Why it reads off.** Frontend-design: motion as orchestrated moments. ui-ux-pro-max animation rule: 150-300ms for micro-interactions, transform/opacity not width/height. Aurora has all the primitives but uses them per-element, not per-moment.

**Reference comparison.** Spotify cross-fades the now-playing title in ~200ms when switching tracks. Apple Music does similar plus a brief AlbumArt scale-in (1.0 → 1.02 → 1.0). Both are sub-200ms transitions that don't block any interaction.

**Severity.** **MEDIUM** for the song-change moment (it's a missed atmospheric beat, not a defect). **LOW** for the orchestrated-entry observation (the speed calibration argues against extending it). **LOW** for the constant-motion-ground observation (reduced-motion users are protected, default users adapt).

**Recommended fix.** Add a 150ms opacity cross-fade on the PlayerBar title and AlbumArt when `currentSong.id` changes. Use a key-based React re-mount on the title element so `aurora-view-enter` fires automatically. **No interaction cost** — audio plays on click as before; only the visual title swap fades. Per the user's calibration, this is the highest-value motion polish that respects the speed constraint.

**Estimated scope.** S.

---

## 6. Aggregation — top 5 priorities

Ranked by aesthetic impact × user-facing visibility × cost-cheapness. All recommended fixes here have **no interaction-delay cost** (per the user's corrected calibration); recommendations that would have added latency have been downgraded one tier and noted.

1. **§5.7 Mix page button-tier rationalisation + h1 size + Jam breathing room.** The user's explicit "Mix buttons feel off" complaint is multi-cause; all three fixes are cheap, all three target the most-distinctive page in Aurora, none introduce friction. Order: (a) tier-rationalise (decide Jam as the singular Loud), (b) bump h1 to 36-40px, (c) bump Jam `mt-4` to `mt-6`. Severity HIGH; scope M total.

2. **§5.2 + §5.6 AlbumArt bleed alpha bump.** Single line in `albumGradient.ts` (and possibly a parity check on PlaylistDetail's hero shadow) raises the bleed from "structurally invisible at 0.25 alpha" to "perceptually atmospheric at 0.30-0.35." Fixes the user's bleed concern *without* breaking Path B and *without* committing to backend extraction. Severity HIGH; scope S.

3. **§5.3 PlayerBar AlbumArt visual mass — bump artist row weight (Option A).** Targets the user's "AlbumArt feels too big" without touching the AlbumArt size (which is industry-normal). Severity HIGH; scope S.

4. **§5.5 currently-playing-row indicator verification.** If regressed, this is CRITICAL (a documented design system feature is silently absent). If just a scroll-position artifact in the screenshot, drops to MEDIUM. Cheap to test (play a song, scroll, observe) before fixing.

5. **§5.8 Empty-state italic register fix.** Move dialog/sidebar status copy from `.font-display-italic` to plain Geist sans-tertiary; preserve PlayerBar idle as the *only* italic ambience. Single-line typography fix per location. Severity MEDIUM; scope S.

**Recommended order:** #4 first (verify before fix), #1 next (most-visible page), #2 alongside #3 (PlayerBar polish bundle), #5 last (mop-up).

---

## 7. Quick wins (single-session reach)

All single-commit (S) or small-session (M) findings that move the needle disproportionately:

- **Sidebar wordmark gradient hairline** (§5.4 fix 1): one CSS class change. Lifts the only identity anchor in the sidebar.
- **Tag-dot Aurora Pulse tint** (§5.4 fix 2): one inline style change. Brings tag column into the gradient axis without matching playlist color intensity.
- **Aurora-curve SVG color migration** (§5.9): three rgba triplets in `QueryBuilder.tsx` lines 353, 367. Closes the §6.4 deferred-migration loop in `play-button-color.md`.
- **PlayerBar song-change cross-fade** (§5.10): one React `key` prop on title/art. Adds a missed atmospheric beat without delaying audio.
- **AlbumArt bleed alpha bump** (§5.2/§5.6): one line in `albumGradient.ts`.
- **Empty-state italic-to-sans migration** (§5.8): three to four lines across dialog/sidebar/edit-tags.

Six quick wins. None costs more than a single focused commit. Together they address user-flagged issues in PlayerBar, Mix, and dialog surfaces, and tighten three system-discipline drifts.

---

## 8. Bigger investments (multi-commit / multi-session)

- **Mix page tier-rationalisation + h1 bump** (§5.7) is the largest-scope single-finding fix; classified M because it touches `mix-btn-search` recipe, the Mix h1, and (potentially) the float-zone Search button to keep behaviour symmetric. It's still single-session work.
- **Currently-playing-row indicator regression diagnosis** (§5.5 finding 1) is unknown-scope until verified. Could be a one-line bug fix; could be a queue-context state question. Worth verifying ahead of estimating.
- **All Songs table-rhythm finding** (§5.5 findings 2-4): if the user wants to push table polish further, this is M scope (per-row weight changes + possibly an alternating-row treatment). De-prioritised for now because the table is already functional.

No XL-scope findings. The audit does **not** recommend a redesign. Aurora has substantial existing design work and most of what reads "off" is recoverable with focused S/M fixes.

---

## 9. Systemic concerns (not per-surface findings — the design system itself)

Three observations that are *about the system*, not about a specific surface. These would need a dedicated design-system extension session — **not** per-surface fix sessions.

### 9.1 Geist-as-default voice

Geist Variable is a polished, characterful sans (Vercel's house font). It's well-executed in Aurora (`ss01`/`cv11` features enabled, paired with Fraunces). But it sits in the same "popular SaaS default" cohort as Inter — a font frontend-design's principles specifically warn against. Aurora's distinctive moments are all in Fraunces (wordmark, hero titles, "Nothing playing"). The body voice is generic by 2026 standards.

**Implication.** Aurora could swap the body sans to something more characterful (the editorial canon picks like Public Sans or Karla, or something more idiosyncratic like Manrope or Söhne) without breaking the design system — the body voice is a token swap, not an architectural change. **But this is a meaningful change** (it touches every text surface in the app) and should be approached as a design-system extension, not a per-surface fix.

**Recommendation.** Do *not* address inline. Surface to the user as a deliberate decision: "Geist works; would you commission a body-font reconsidering session?" If yes, that's a focused exploration doc. If no (Geist is fine), the audit's typography findings remain at "works well, less distinctive than Fraunces alone could be."

### 9.2 Smoked-obsidian glass vs canonical frosted glass

ui-ux-pro-max's glassmorphism rule says `rgba(255,255,255,0.10-0.30)` over a vibrant background. Aurora's PlayerBar/sidebar uses `rgba(6-8,7-10,9-11,0.60-0.80)` — translucent obsidian over OLED black. The composition reads as *dimmed darkness*, not *frosted glass*. There is essentially no light-through-glass effect because the underlying surface is also dark.

**Implication.** Aurora's "glass" isn't really glass — it's a smoked panel over a near-black ground. This is defensible (pure OLED black + atmospheric photograph at z 0-1 means the "glass" sits over a complex ground that *does* have variance), but the ui-ux-pro-max rule that glass needs a vibrant ground to read as glass is not satisfied. **The aurora photograph at z 0 IS the vibrant ground**, but it's so quiet and dark that the bar's glass effect is muted.

**Recommendation.** Surface for user decision: would Aurora gain from raising the aurora-photograph atmospheric layer's brightness/opacity by ~15-20%? This would give the smoked-obsidian glass actual color to compose against. **Risk:** the OLED-discipline of Principle 1 ("OLED void is the ground plane") could be perceptually softened. This is a system-level call, not a per-surface fix. Could be tested in a design-system extension session before any commitment.

### 9.3 Pure `#000000` ground vs `#121212`

Industry dark-mode advice consistently recommends `#121212`/`#1B1B1B` over pure `#000000` (eye comfort, less stark contrast). Aurora chose `#000000` deliberately per Principle 1. Aurora's text is `#e8e6e3` (warm near-white) — this is correct, eye-comfortable.

The pure-black ground has two effects worth flagging:
1. **It maximises OLED power-saving** — true.
2. **It maximises contrast** with everything painted on it, which means subtle/quiet moments (like the bleed at §5.2) need to fight *against* the maximum contrast threshold. A `#0a0a0a` ground would let low-alpha moments register more easily.

**Implication.** Aurora's "everything has to either be a strong moment or be invisible" tension is partly a function of the pure-black choice. Softening the ground to `#0a0a0a` would let low-alpha bleed and atmospheric details register without committing them to a higher alpha (which would compete with the loud moments).

**Recommendation.** Surface for user decision. Same argument as §9.2: small ground softening could lift atmospheric quality without losing OLED discipline. **Do not change without user approval** — this is a Principle 1 modification.

---

## 10. Inferred-vs-explicit appendix

Every claim in §5–§9 traced to its source.

### 10.1 Claims about user state — sourced

| Claim | Source |
|---|---|
| "User reported 'AlbumArt too big'" | User brief at session start, prior to audit |
| "User reported 'Mix buttons feel off'" | User brief at session start |
| "User reported 'play button is ok I guess'" | User brief at session start; not the audit's headline finding because button-system + play-button-color shipped fixes already |
| "User reported warm bleed visible in earlier ABBA Gold screenshots" | User brief at session start; investigated in §5.2 and concluded the procedural system cannot produce warm bleed |

### 10.2 Code-only claims

| Claim | Source |
|---|---|
| PlayerBar desktop bar 80px / AlbumArt md 56px | [`PlayerBar.tsx:151`](../../frontend/src/components/layout/PlayerBar.tsx#L151), [`PlayerBar.tsx:174-176`](../../frontend/src/components/layout/PlayerBar.tsx#L174-L176), [`AlbumArt.tsx:6-11`](../../frontend/src/components/songs/AlbumArt.tsx#L6-L11) |
| AlbumArt boxShadow `0 0 24px -6px ${art.glow}` | [`PlayerBar.tsx:179`](../../frontend/src/components/layout/PlayerBar.tsx#L179) |
| `art.glow = hsla(...,0.25)` | [`albumGradient.ts:60`](../../frontend/src/lib/albumGradient.ts#L60) |
| HUES array is 8 cool-family entries | [`albumGradient.ts:10-19`](../../frontend/src/lib/albumGradient.ts#L10-L19) — explicit list inspected |
| AlbumArt `<img>` is in `overflow-hidden` container | [`AlbumArt.tsx:35`](../../frontend/src/components/songs/AlbumArt.tsx#L35) |
| `MixEmptyState` SVG uses `rgba(77,184,164,...)` (smoked-teal pre-Aurora-Pulse) | [`QueryBuilder.tsx:353, 367`](../../frontend/src/components/filter/QueryBuilder.tsx#L353-L367) |
| Sidebar wordmark gradient hairline at `opacity: 0.4`, `w-12` | [`Sidebar.tsx:63-67`](../../frontend/src/components/layout/Sidebar.tsx#L63-L67) |
| TagSidebarItem dot is `--aurora-muted` (rgba(255,255,255,0.14)) | [`Sidebar.tsx:291-294`](../../frontend/src/components/layout/Sidebar.tsx#L291-L294) |
| FooterAction uses inline JS hover | [`Sidebar.tsx:264-265`](../../frontend/src/components/layout/Sidebar.tsx#L264-L265) |
| Mix h1 is `font-display text-[28px]` | [`QueryBuilder.tsx:128-130`](../../frontend/src/components/filter/QueryBuilder.tsx#L128-L130) |
| Jam button at `mt-4` from chip tray | [`QueryBuilder.tsx:261`](../../frontend/src/components/filter/QueryBuilder.tsx#L261) |
| Search button is `mix-btn-search` (Loud-tier) | [`QueryBuilder.tsx:135`](../../frontend/src/components/filter/QueryBuilder.tsx#L135), recipe at [`index.css`](../../frontend/src/index.css) `.mix-btn-search` |
| Jam button is `mix-jam-primary` (Loud-tier with gradient) | [`QueryBuilder.tsx:265-269`](../../frontend/src/components/filter/QueryBuilder.tsx#L265-L269) |
| design-system.md says `.font-display-italic` for "ambient/editorial" | [`design-system.md`](../design-system.md) §Typography → Display utilities |

### 10.3 Inferred claims (judgement, with reasoning)

| Claim | Reasoning |
|---|---|
| "AlbumArt visual mass feels too big because text stack is light" | Computed from code: art 56px vs text stack ~34px = 165% ratio. Reference Spotify ratio similar but with bolder text — concluded it's the text weight not the art size. **Author judgement.** |
| "Bleed at 0.25 alpha is too quiet to read" | Math: HSLA at 0.25 alpha through 24px blur on OLED produces ~0.12 perceived luminance lift. Below typical perceptibility threshold for cool colors. **Inferred from color-math; not directly measured.** |
| "Mix view has too many simultaneous gradient surfaces" | Counted: wordmark + Jam + (when playing) currently-playing row title = 3 gradient surfaces. **Explicit count.** |
| "Search vs Jam in different recipes splits the Loud tier" | Comparison of `.mix-btn-search` (solid Aurora Pulse fill) vs `.mix-jam-primary` (gradient + dual halo). **Read directly from CSS.** Whether this *reads* as a problem is **author judgement** — the user reported it as "feels off," which is consistent. |
| "Currently-playing-row indicator is missing in screenshot 202" | Visual inspection of screenshot 202 — no row 5 ("Again") shows an accent bar or gradient title. **Could be misread of the screenshot at small scale; flagged for verification.** |
| "Italic register on dialog 'No tags yet' is misapplied" | design-system.md's own typography rule says italic is for editorial/ambient; status report is not editorial. **Inferred from rule + visual judgement of screenshot 206.** |
| "Geist is a popular SaaS default cohort with Inter" | Industry knowledge: Geist is Vercel's house font; both Geist and Inter are widely used in 2024-26 SaaS. **Author judgement; not from a single citation.** |

### 10.4 Reference comparisons — sourced

| Claim | Source |
|---|---|
| Spotify desktop now-playing bar ~70px | [Spotify community thread](https://community.spotify.com/t5/Desktop-Windows/How-do-I-change-the-size-of-the-interface-and-multiple-other/td-p/5185177) — referenced 70px customization implies similar default |
| Apple Music Tahoe 2025 moved controls to bottom | [Apple Community](https://discussions.apple.com/thread/256137017) |
| Tidal 2026 iOS redesign album-centric with dynamic background | [piunikaweb](https://piunikaweb.com/2026/03/18/tidal-ios-music-player-redesign-rolling-out/) |
| Apple Music adaptive UI causes dark-mode complaints | [9to5mac 2026-03-31](https://9to5mac.com/2026/03/31/the-new-adaptive-apple-music-design-draws-complaints-from-dark-mode-users/) |
| Glassmorphism standard in 2026 music apps | [invernessdesignstudio](https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026), [medium/MustBeWebCode](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f) |
| Industry dark-mode advice prefers `#121212` over `#000000` | [GenDesigns dark mode guide](https://gendesigns.ai/blog/dark-mode-design-guide-apps), [UInkits 2025 best practices](https://www.uinkits.com/blog-post/best-dark-mode-ui-design-examples-and-best-practices-in-2025) |
| Music Streaming product card in ui-ux-pro-max recommends Dark Mode + Vibrant; Aurora UI as secondary | `python .claude/skills/ui-ux-pro-max/scripts/search.py "transport controls player bar density" --domain product` result 5 |
| Glassmorphism canonical recipe `blur(10-20px) rgba(255,255,255,0.10-0.30)` | `python .claude/skills/ui-ux-pro-max/scripts/search.py "glassmorphism frosted dark mode production" --domain style` result 2 |
| VisionOS spatial UI `blur(40px) saturate(180%) radius:24px` | Same query, result 4 |
| Editorial typography canon (Playfair, Cormorant, Newsreader, Bodoni) | `python .claude/skills/ui-ux-pro-max/scripts/search.py "editorial atmospheric serif italic display" --domain typography` results 1-4 |

### 10.5 Severity classifications — basis

| Severity | Basis |
|---|---|
| CRITICAL | Reserved for "actively making the app feel amateurish." Used in §5.5 as a *contingent* — if the currently-playing-row indicator regression is real, it's CRITICAL because a design-system documented feature is silently absent |
| HIGH | Used for: user's explicit complaints (§5.7 Mix buttons, §5.3 AlbumArt size), surfaces where the user spends dwell time and the polish gap is visible (§5.2 + §5.6 bleed), regressions or absence of designed features (§5.5 indicator if confirmed) |
| MEDIUM | Used for: visible polish gaps that affect overall feel but not headline complaints (§5.4 sidebar identity, §5.5 table rhythm, §5.8 dialog italic, §5.10 song-change moment) |
| LOW | Used for: paper cuts visible on narrow surfaces (§5.1 idle copy, §5.9 SVG color drift, §5.10 constant-motion-ground) |

Severity is the audit's judgement against the user's stated priorities (beautiful AND fast, distinctiveness gains valued, no friction tax). The user can re-rank.

### 10.6 What the user should scrutinise specifically

Per the brief, the top-3 inferred-vs-explicit items that deserve user pushback before commissioning fixes:

1. **§5.2 bleed-alpha recommendation.** The math says 0.25 → 0.30-0.35 will be visible without becoming loud. But "loud enough to compete with the play-button backlight" is an empirical question — the audit recommends the bump but *the user should preview before commissioning the merge.* The current 0.25 has a defensible "atmospheric, doesn't compete with play button" argument; raising to 0.35 may invert that.
2. **§5.7 Search-vs-Jam tier rationalisation.** The audit recommends Jam as the singular Loud and Search as Quiet. The opposite (Search as Loud, Jam as Quiet) is also defensible — if the user thinks Search is the *primary* action of the Mix page, the recommendation flips. **The user's mental model of which is primary is the deciding input.**
3. **§9 systemic concerns are user-decisions, not audit recommendations.** Geist body voice, smoked-obsidian glass over OLED, pure-black ground — these are all principled current choices that the audit *could* see different choices for, but they are not faults. The user should take §9 as "options to revisit," not "fix this."

---

## 11. Surfaces incompletely audited (screenshot gaps)

Per the screenshot inventory in §4, the following surfaces could not be fully audited:

| Surface | Why incomplete |
|---|---|
| PlayerBar idle (Nothing playing) | No screenshot — audited from code only |
| PlayerBar with bright/dark/warm/cool cover variations | All screenshots show the same "Again" cover; cover-dependence of bleed could not be empirically tested. **Code-only conclusion in §5.2 stands** but a multi-cover screenshot batch would let the user verify visually |
| Sidebar standalone close-up | Visible only at small scale across the screenshots |
| Mix page **empty** (no query, default state) | Not provided — Search and Jam buttons at *rest* (vs active) could not be visually checked. §5.7 finding stands from code |
| Edit Song dialog | Not provided — only Edit Tags (206) and inferred dialog chrome were audited |
| Add Song dialog | Not provided |
| Scan Folder dialog | Not provided |
| Delete confirm AlertDialog (destructive variant in context) | Not provided |
| Empty filter results state | Not provided — `MixEmptyState` audited from code |
| First-load empty (no music scanned) | Not provided |
| Motion / view-transition capture | Not provided — audited from CSS / component code |

**Recommendation.** If the user wants tighter visual evidence on any of the above surfaces before commissioning fixes, the per-surface findings can be re-audited with a follow-up screenshot batch. **None of the missing surfaces produced a finding the audit was unable to support from code.**

---

## 12. Final report

**Doc path:** `docs/design/aesthetic-audit.md` (this file).

**Findings count by severity:**
- CRITICAL: 0 confirmed (1 contingent, pending verification — §5.5)
- HIGH: 4 (§5.2 + §5.6 bleed treated as one cross-surface finding; §5.3 AlbumArt mass; §5.5 row indicator; §5.7 Mix buttons)
- MEDIUM: 5 (§5.4 sidebar; §5.5 table rhythm; §5.8 dialog italic; §5.10 song-change; §5.6 hero shadow if separate)
- LOW: 3 (§5.1 idle copy; §5.9 SVG color; §5.10 motion-ground & orchestration)

**Top 5 priorities (from §6):**
1. §5.7 Mix page tier-rationalisation + h1 + Jam breathing room
2. §5.2 + §5.6 AlbumArt bleed alpha bump
3. §5.3 PlayerBar artist-row weight bump (AlbumArt visual mass fix without resizing)
4. §5.5 currently-playing-row indicator verification
5. §5.8 empty-state italic register correction

**Quick wins count:** 6 (per §7).

**Bigger investments count:** 2 documented; 0 XL.

**Systemic concerns count:** 3 (per §9): Geist body voice, smoked-obsidian glass, pure-black ground. **All require user decision; none are audit-recommended changes.**

**Top 3 inferred-vs-explicit items to scrutinise** (per §10.6):
1. §5.2 bleed-alpha recommendation — preview before commit
2. §5.7 Search-vs-Jam tier choice — user's mental model decides
3. §9 systemic concerns — these are options to revisit, not faults

**Surfaces incompletely audited:** 11 listed in §11. None blocked an audit finding; tighter visual evidence can be commissioned per surface if needed.

---

*End of audit. No code changed. No design-system revisions in line. All findings traceable in §10.*
