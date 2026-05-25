# Aurora — Identity & Skills Plan (Step #1)

Decisions of record for the Aurora visual overhaul. This document captures the
identity, design language, anti-slop guardrails, and Step #1 tooling install
procedure. Codified in-repo so subsequent sessions (and contributors) can pick
up the thread without re-litigating the basics.

Companion documents are in this repo at `docs/design/new1.md` (user vision)
and `docs/design/AURORA1.md` (web-Opus handoff doc); this file is the canonical
merge of those notes.

---

## What Aurora is

**A music library that feels alive.** Not a tracker. Not a streaming clone. A
tactile, atmospheric instrument for people who actually own and curate their
library — and who want it to *feel* like something when they open it.

The feature surface (tags, boolean queries `AND/OR/NOT`, custom playback windows,
per-playlist crossfade, format-aware dedup, Jam / Shuffle-Jam) is real and
stays. It is not the front door. The front door is the *surface*: the play
button, the wordmark, the per-song atmospheric bleed, the typography.
Power-user features stay one motion away — visible to the curious, invisible to
the casual.

## Who it's for

Curators, not consumers. People who:

- Already have a music library (rips, downloads, bandcamp, demos, sets) and
  don't want it in someone else's cloud.
- Care about the feel of opening an app, not just whether it works.
- Have a tagging mental model that no existing app matches — and want a query
  language strong enough to use it.
- Might invite friends to use their instance, or run a tiny shared deployment.

## Positioning

| Not | Is |
|---|---|
| Spotify / Apple / YT Music (cloud, algorithmic, owns your taste) | Yours. Local-first. You own the files. |
| Foobar / Tauon (tracker grid, function-first, ugly-on-purpose) | Tactile, expressive, designed-on-purpose. |
| Feishin / Nora (server-pair UIs, utility-grade) | Premium feel — opening it should feel like picking up a record. |
| AI-default glassmorphism (purple-pink, soft corners, Inter everywhere) | Editorial italics, OLED black, Aurora-bright-star primitive, specular liquid glass. |

**Monetization is parked.** Possible future paths: hosted-instance tier,
premium themes, self-host helper. No work on this in Step #1. Decisions today
should not foreclose multi-user / shared-instance futures (e.g., do not
hard-code single-user assumptions into the data model).

---

## Design language: "Northern Lights over OLED"

| Axis | Decision |
|---|---|
| Base | Pure OLED black `#000`. Not near-black. |
| Surface | Liquid Glass (Apple iOS 26 / visionOS) — translucent layers with specular highlights. NOT frosted glass. NOT generic soft-corner glass. |
| Accent | Per-song dominant color extracted from album art; bled atmospherically — bolder than Spotify, larger source, further behind. |
| Signature element | Play button = liquid-glass dome with a single Aurora-bright-star point of light inside. Ripples on hover/click from contact point. Optional slow pulse tied to song length. |
| Wordmark | Custom SVG. The `A` is two convergent strokes meeting at an apex; that apex *is* the bright-star primitive. `urora` trails in editorial italic. Wordmark + play button share DNA = system identity. |
| Display / headers | Reckless Neue Italic OR PP Editorial New Italic |
| Body / UI | General Sans (free, distinctive geometric) |
| Accent (chips, query, timestamps, metadata) | JetBrains Mono — makes tag queries feel like a dev instrument |
| Banned fonts | Inter, Roboto, Space Grotesk, Lato, Arial, Open Sans |
| Motion | Physics-tinted ripples, specular drift, kinetic typography on hero text. NOT Material bouncy. 120fps targets. |
| Density | Generous whitespace on player chrome. Dense on song / tag tables (tracker-style is fine *there*). |

## Anti-slop checklist

Banned because they are the AI-default look in 2026:

- Purple → pink linear gradients
- Soft-corner translucent panels with no specular highlight
- Inter / Roboto / Space Grotesk body text
- Material-style spring bounces (overshoot + settle)
- Generic Lottie illustrations
- Centered hero with three feature cards below
- Emoji as primary iconography
- Gradient text on a gradient background

Allowed because they're earned by the aesthetic:

- True OLED black + per-song color bleed (atmosphere)
- Editorial italics in heros (Reckless / PP Editorial)
- Mono in the functional cluster (queries, timestamps, file format)
- Tactile brutalism *only* where it earns the contrast — e.g., the tag query
  input could feel hard-edged against the soft player surface.

## Moodboard

Sources to audit before Step #2 (visual redesign):

| Source | What to pull from it |
|---|---|
| Awwwards — Sites of the Year | General taste benchmark for 2025 / 2026 |
| Awwwards — Music Interfaces collection | Music-app-specific UI patterns |
| Awwwards — Dark Mode collection | OLED-discipline benchmarks |
| Emil Kowalski + Sonner + Vaul | Animation philosophy, micro-detail (Linear / Vercel-vetted) |
| Rauno Freiberg | Tiny details, design-engineering craft |
| Linear, Raycast, Arc, Warp, Vercel | Dark-first chrome discipline, accent-on-black, luminance over weight |
| Apple iOS 26 / visionOS 4 Liquid Glass gallery | Surface language source-of-truth |
| Aurora Borealis astrophotography (NASA APOD, ESA archives) | Literal palette + atmospheric reference. Use real photos, not generic gradients. |
| Spotify Now-Playing | Dynamic-bleed *only* — not layout |
| Foobar2000, Tauon, Feishin, Nora | Define-by-contrast benchmarks — what we are explicitly NOT |
| Cosmos | Curation-as-atmosphere DNA (not a music app, but the right mood) |

---

## Toolbox

```
            CURRENT TOOLBOX (keep)
            superpowers · frontend-design
            graphify · caveman
                     │
       ┌─────────────┼─────────────────┐
       ▼             ▼                 ▼
     ADD          SWAP              SKIP / DEFER
   ─────────    ──────────────    ─────────────────
   impeccable   ui-ux-pro-max     model routing
   Playwright    →  impeccable    (no extra subs)
   Context7      (two visual      Sequential-thinking
   shadcn         skills =         (defer until needed)
   animate-       design drift)
     skill
```

### Verified install commands

These are local-machine commands. Run them on the user's host Claude Code
installation; they have no effect in the Aurora repo itself.

**1. impeccable.** The repo ships pre-built bundles; install is copy-from-dist:

```bash
# Recommended: download Claude Code bundle from https://impeccable.style
# CLI alternative:
git clone https://github.com/pbakaus/impeccable /tmp/impeccable

# Project-scoped (cleaner for Aurora):
cp -r /tmp/impeccable/dist/claude-code/.claude/* /path/to/aurora/.claude/

# OR user-scoped:
cp -r /tmp/impeccable/dist/claude-code/.claude/* ~/.claude/
```

`npx impeccable detect src/` is a *separate* CLI scanner, not the skill itself.
Use ad-hoc when wanted.

**2. Remove ui-ux-pro-max** — manual, after impeccable is verified working:

```bash
ls ~/.claude/skills/ | grep -i ui-ux
ls ~/.claude/plugins/ 2>/dev/null | grep -i ui-ux
# Then rm -rf the matched directory.
```

**3. Playwright MCP** — package `@playwright/mcp`:

```bash
claude mcp add playwright -- npx -y @playwright/mcp@latest
```

**4. Context7 MCP** — package `@upstash/context7-mcp`:

```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
```

**5. shadcn MCP** — official, two paths:

```bash
# User-scoped:
claude mcp add shadcn -- npx shadcn@latest mcp

# OR project-scoped — add to .mcp.json at repo root:
# {
#   "mcpServers": {
#     "shadcn": { "type": "stdio", "command": "npx", "args": ["shadcn@latest", "mcp"] }
#   }
# }
```

**6. animate-skill** — pick one:

```bash
# A. Emil Kowalski's own (closer to source, narrower):
npx skills add https://github.com/emilkowalski/skill --skill emil-design-eng

# B. delphi-ai's port (broader patterns):
npx skills add https://github.com/delphi-ai/animate-skill --skill animate
```

Recommendation: install A first. Add B only if A feels too narrow during the
redesign.

### Post-install verification

```bash
# Restart Claude Code, then in a session:
/plugin list      # impeccable + animate skill should appear
/mcp              # playwright, context7, shadcn should show "Connected"

# Smoke tests:
# - impeccable: "audit frontend/src/components/layout/PlayerBar.tsx against impeccable anti-patterns"
# - Playwright: start `cd frontend && npm run dev`, then ask:
#     "screenshot http://localhost:5173 via playwright"
# - Context7: "fetch the latest React 19 use() docs via context7"
# - shadcn: "via shadcn mcp, get the Dialog component's prop signatures"
# - animate-skill: "use emil-design-eng to review the Sonner toast slide-in animation in index.css"
```

---

## Step #2 preview

Order, to be confirmed after Step #1 install is verified:

1. Audit current frontend against impeccable + the moodboard. Output: a "kill
   list" of components that look slop today.
2. Write `DESIGN.md` (tokens, banned patterns, motion principles, anti-slop
   checklist, palette derivation from album art).
3. Prototype the play-button + wordmark primitive as standalone SVG / component.
   Get the bright-star shared.
4. Roll the surface language out: PlayerBar → Mix command zone → Playlist hero
   → All Songs → Sidebar.
5. Visual regression with Playwright on every surface as it lands.

## Open questions (carry into Step #2)

1. **Wordmark tone** — "Aurora" all-italic, or `A` upright + `urora` italic, or
   `A` upright + `urora` italic+spaced? Decide after first SVG pass (3 variants).
2. **Bleed scope** ✅ DECIDED — player bar + now-playing + playlist hero. Filter
   result cards stay neutral so the bleed is *the* signal.
3. **Play button "hold to glow scaled by song length"** ✅ DECIDED — keep as
   Easter egg, not primary affordance.
4. **Multi-user / online future** ✅ DECIDED — no structural work in Step #1;
   flag any Step #2 decision that forecloses shared-instance future (e.g.,
   localStorage-only theme persistence).
5. **Sessions log** ✅ DECIDED — keep current `HANDOFF.md` +
   `claude-workspace/Aurora/{JOURNAL,PATTERNS,CONTEXT}.md`. Do not adopt
   AURORA1's `sessions/`.

## References

- Awwwards — Sites of the Year: https://www.awwwards.com/websites/sites_of_the_year/
- Awwwards — Music Interfaces: https://www.awwwards.com/awwwards/collections/music-interfaces/
- Awwwards — Dark Mode: https://www.awwwards.com/awwwards/collections/dark-mode/
- Emil Kowalski: https://emilkowal.ski/
- emil-design-eng skill: https://github.com/emilkowalski/skill
- Rauno Freiberg: https://rauno.me/
- animate-skill (delphi-ai): https://github.com/delphi-ai/animate-skill
- impeccable: https://github.com/pbakaus/impeccable / https://impeccable.style
- Playwright MCP: https://github.com/microsoft/playwright-mcp
- Context7: https://github.com/upstash/context7
- shadcn MCP: https://ui.shadcn.com/docs/mcp
- Cosmos: https://www.cosmos.so/
