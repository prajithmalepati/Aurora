# HyperFrames Evaluation — Aurora Session 29

**Date:** 2026-05-26
**Verdict: GO** — viable for the parked background-video supplement (session 30 plan).

---

## What was tested

5-second 1920×1080 aurora-like CSS animation:
- 4 radial-gradient curtain layers with screen blend mode + blur
- Star field background
- GSAP-animated fade-in and fade-out
- "Aurora" wordmark with glyph drop-shadow

**Test output:** `D:\AI\projects2\hyperframes-eval\aurora-test\renders\aurora-test_2026-05-26_13-49-55.mp4`

---

## Install footprint

| Dependency | How installed | Notes |
|---|---|---|
| HyperFrames 0.6.46 | `npm install hyperframes` (local) | `npx` had Windows lock conflicts — local install is reliable |
| FFmpeg | `winget install ffmpeg` | One-time global install, ~100MB |
| Headless Chrome | Auto-downloaded on first render | ~101MB, cached in hyperframes data dir |

**Total one-time cost:** ~200MB download. After that, renders run fully offline.

---

## Performance

- 5s composition, 150 frames at 30fps
- 5 worker processes (20 cores detected)
- **Render time: ~25 seconds** (5x realtime — fast for 1080p)
- Output: 1.4 MB H.264 MP4

---

## Quality

CSS radial-gradient curtains with `mix-blend-mode: screen` and `filter: blur(80px)` look convincingly aurora-like. GSAP fade-in/out is smooth. Quality ceiling = whatever CSS/canvas can do offline (no custom WebGL GLSL — Aurora's live shader is richer, but this is sufficient for a looping background layer).

Lint system caught real bugs before render: GSAP + CSS `transform` conflicts, overlapping clip tracks, font-family without @font-face. Forced correct composition structure. This is valuable for agentic authorship.

---

## Limitations

- No custom WebGL GLSL shaders in headless Chrome — `oklch()` color functions work correctly, but complex fBm noise must be faked with CSS layers
- `@font-face` required for any non-system font; cannot use Aurora's Fraunces/JetBrains in the video directly without capturing the TTF files
- CSS-only animations (no RAF-based procedural noise) — motion is smooth but less organic than the live AuroraCanvas shader

---

## Verdict for session 30 design pivot

**USE IT** for the background-video supplement. Author in HTML/CSS/GSAP → render → serve as `<video muted loop playsinline>` behind the AuroraCanvas shader. The two layers complement each other: CSS video = ambient background, WebGL shader = reactive audio-driven foreground.

**Author brief:** a 15-30 second seamless-loop night sky with subtle star twinkle and slow aurora drift. No wordmark. No GSAP HOLD at end — use `animation-iteration-count: infinite` CSS animations so the loop is gapless.

---

## agent-browser MCP — Phase 0.1 finding

Vercel Labs `agent-browser` (34k stars) is a **Rust CLI + web dashboard** (port 4848), NOT an MCP server. No MCP interface as of 2026-05-26. Falling back to existing Playwright MCP for all verification gates in this plan. No install performed.
