---
timestamp: 2026-05-25T17-49-54Z
slug: playerbar-sidebar-appshell
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Active states, Equalizer, disabled controls solid. Missing: no loading feedback on API calls |
| 2 | Match System / Real World | 4 | "All Songs / Mix / Playlists / Tags" — clean vocabulary for this audience |
| 3 | User Control and Freedom | 3 | Transport, seek, shuffle/repeat all good |
| 4 | Consistency and Standards | 2 | Font stack ≠ identity spec. FooterAction hover via inline JS. NavItem vs FooterAction active patterns diverge |
| 5 | Error Prevention | 2 | Seek + transport disabled when idle. Destructive confirmations out of scope |
| 6 | Recognition Rather Than Recall | 3 | Footer icons labeled. Tag click immediate filter — no result preview |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts. Tag click is the one power shortcut |
| 8 | Aesthetic and Minimalist Design | 2 | Gradient wordmark + decorative accent line + Playing/Equalizer redundancy add noise |
| 9 | Error Recovery | 2 | "Pick a song or hit Jam" is sole guidance |
| 10 | Help and Documentation | 1 | No tooltips, no contextual help anywhere |
| **Total** | | **24/40** | **Acceptable** |

## Anti-Patterns Verdict

LLM: Gradient text on wordmark + 3px left-bar nav indicator = two explicit absolute-ban violations. Rest of design is disciplined and non-template.

Detector: 2 findings. `pure-black-white` (AppShell:41) = false positive (intentional OLED black). `layout-transition` (PlayerBar:191) = confirmed real issue.

## Priority Issues

[P1] Gradient text wordmark — `aurora-gradient-text` on Sidebar.tsx:59. Absolute ban. Replace with SVG wordmark per identity spec.

[P1] NavItem side-stripe border — 3px left-bar active indicator on Sidebar.tsx:226. Absolute ban. Replace with full background tint.

[P1] Font stack mismatch — Fraunces/Geist vs spec Reckless Neue/General Sans/JetBrains Mono. Resolve which is canonical.

[P2] No per-song color bleed on PlayerBar — art.glow computed but not applied to bar background. Core identity feature missing.

[P2] transition: height layout animation — PlayerBar.tsx:191 and index.css:.playerbar. Use grid-template-rows instead.

## Persona Red Flags

Alex: No keyboard shortcuts for transport. Tag click no undo.
Sam: FooterAction hover via inline JS — keyboard focus gets no background tint. Focus indicator missing on footer buttons.
The Curator: Wordmark reads as template. Song change = no chrome response. Identity moment lost.

## Minor Observations

label-micro section headers: keep. aurora-divider-h: keep. aurora-keyline-right fade: keep. FooterAction 4-item density: watch. aurora-range-pct custom property: good engineering.
