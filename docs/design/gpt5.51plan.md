# GPT 5.5.1 Planning Notes - Visual Overhaul Reviews

## Kimi Review Verdict

Kimi's two docs are useful, but they mix real engineering catches with overconfident "research theater." Use them as a hardening checklist, not as a new source of truth.

### Fold

- **WebGL context loss handling**: add `webglcontextlost`, `webglcontextrestored`, RAF cancellation, shader/program cleanup, and fallback behavior.
- **Time wrapping + highp precision**: pass `uTime % 1000` and use `highp` when available.
- **Reduced-motion must stop JS loops too**: do not only hide the canvas in CSS; disable shader RAF, color lerp, waveform shimmer, and transition choreography.
- **Idle timer should not set React state on every pointermove**: use refs/throttling or event timestamps.
- **Avoid DOM queries inside waveform animation**: no `document.getElementById` per frame.
- **Use stable SVG IDs or no IDs**: use `useId()` or ref-based rendering, never `Math.random()` in render.
- **SVG `viewBox` instead of reading width during render**: avoids resize churn.
- **Wordmark as SVG path**: aligns with the spec. Do not rely on live font positioning for the star/apex.
- **Shader asymmetry/fBm/altitude tint**: good design guidance, not a mandate for ray marching.

### Push Back / Prototype First

- **`useEffectEvent`** is useful, but do not build the plan around it unless React/ESLint support is clean. A `useRef` callback pattern is simpler and less magical.
- **Waveform `stroke-dasharray`** is only better if the waveform is a stroked line. If Aurora wants a filled waveform silhouette, a clip/mask or two-path overlay may still be correct. The real rule: no DOM query per frame, no random IDs, no width reads during render.
- **Custom SVG `role="slider"`** is worse than the spec. Keep the native `<input type="range">` as the accessible control. Custom ARIA sliders are easy to get subtly wrong.
- **Howler analyser advice is incomplete**. Aurora currently creates Howls with `html5: true`; tapping `Howler.masterGain` may not see HTML5 audio output. Prototype this before committing to audio-reactive shader work.
- **Volumetric/ray-marched aurora** is overkill. Use fBm, vertical structure, asymmetry, and altitude tinting, not full ray marching.
- **Additive blending** needs testing. Blend function and premultiplied alpha details are easy to get wrong visually.
- **Performance math claims** are not trustworthy without DevTools measurement on target hardware.

The biggest Kimi miss: because `useAudioPlayer.ts` uses `html5: true`, the analyser path may be the riskiest part of the whole shader plan. Before designing transient-reactive curtains, prove stable amplitude data from the actual playback path without breaking the two-effect Howl architecture.

Net: Kimi is good on technical hardening, weaker on product restraint. The actionable takeaway is not "make the shader more advanced." It is "make the implementation harder to break."

---

## Qwen Review Verdict

Qwen is partly valid, but it has one major false alarm.

The big wrong claim: **`useEffectEvent` is not removed from React 19.** This repo uses `react@19.2.4`, and `useEffectEvent` exists in the React 19.2 line. So "fatal trap / immediate build crash" is likely false. That said, the recommendation to use the simpler `useRef` / `useLatest` pattern is still reasonable. We did not miss the risk; we already downgraded `useEffectEvent` to "do not build the plan around it."

### Fold From Qwen

- **Canvas DPR cap at `1.5`**: valid. The plan had performance budgets, but not this concrete guard.
- **Clamp Culori linear RGB before WebGL uniforms**: valid. OKLCH can produce out-of-gamut RGB.
- **Native invisible range overlay for waveform**: valid. This matches the original spec and avoids custom ARIA slider risk.
- **Pillow `quantize()` instead of `scikit-learn` KMeans**: strong backend suggestion. It removes a heavy dependency and is good enough for two dominant colors.
- **SQLite `busy_timeout`**: valid. Current `get_db()` sets `foreign_keys`, but not `busy_timeout`. WAL is initialized, but `busy_timeout=5000` should be set per connection.
- **WebGL context loss + `preventDefault()`**: valid and already belongs in the Phase 4 hardening work.
- **No high-frequency React state in RAF/analyser loops**: valid. Use refs/throttling.
- **Stable SVG IDs with `useId()`**: valid if clip paths are used.
- **Autoplay/audio context resume**: valid, but incomplete. The larger unresolved risk is still `html5: true` possibly bypassing `Howler.masterGain`.

### Questionable / Too Strong

- **`miniaudio` segfault warning**: plausible, but overstated. C extensions can crash. Treat subprocess isolation as a robustness upgrade, not mandatory for v1 unless scanning untrusted or very messy libraries.
- **"WAL on every connection"**: `busy_timeout` should be per connection. `journal_mode=WAL` is persistent after set, though reasserting it is harmless.
- **Ghost waveform pulsing to analyser while peaks load**: extra feature. Skip for now.
- **Tailwind `@theme` migration**: maybe useful, but do not make visual overhaul depend on a token architecture migration unless the CSS is already being touched deeply.
- **Liquid glass `mix-blend-mode` overlay**: prototype only. Blend modes can get weird over shader/canvas layers.

### Why These Were Easy To Miss

- Earlier reviews focused on spec correctness and product restraint, not low-level browser/GPU failure modes.
- The backend scanner discussion accepted the spec's suggested libraries instead of challenging whether `scikit-learn` was the right tool. Qwen correctly challenged that.
- DPR caps and RGB gamut clamping only appear once someone thinks through `AuroraCanvas.tsx` implementation details.
- SQLite locking was outside the visual design lens, but scanner/API changes increase write pressure enough that it matters.

### Net Qwen Decision

Fold in:

- DPR cap
- RGB clamping
- `busy_timeout`
- Pillow `quantize`
- native range overlay
- stable SVG IDs

Ignore:

- the `useEffectEvent` panic
- ghost waveform
- Tailwind `@theme` as a blocker
- mandatory `miniaudio` subprocess isolation for v1

Treat as prototype-only:

- analyser path with `html5: true`
- liquid glass blend-mode details
- additive shader blending
