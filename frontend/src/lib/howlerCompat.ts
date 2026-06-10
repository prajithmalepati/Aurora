/**
 * howlerCompat.ts — Safe wrappers around Howler.js private APIs.
 *
 * Howler exposes a public API for most operations, but two audio-engine
 * touches require reaching into internal properties:
 *   1. `Howler.ctx` — the shared AudioContext (for resume after suspend).
 *   2. `_sounds[0]._node` — the underlying HTMLAudioElement (for gapless
 *      currentTime reset).
 *
 * Both are guarded by feature detection and degrade to no-ops when the
 * internal shape changes. This keeps the private-API access contained
 * in one file, making Howler upgrades/forks auditable at a glance.
 */

import { Howl } from "howler"

/**
 * Resume the shared Howler AudioContext if it exists and is suspended.
 * Must be called in a user-gesture handler or the leaf effect closest
 * to the gesture — the browser may reject resume() otherwise.
 */
export function resumeAudioContext(): void {
  try {
    const ctx: AudioContext | undefined = (window as any).Howler?.ctx
    if (ctx?.state === "suspended") {
      ctx.resume().catch(() => {
        // Browser autoplay policy may reject — safe to ignore.
      })
    }
  } catch {
    // Howler global missing or ctx shape changed — no-op.
  }
}

/**
 * Reset the underlying audio element's currentTime to 0 for gapless
 * transitions. This avoids a sub-second silence gap when the new
 * Howl starts playing from its default position.
 *
 * Only effective when the Howl uses HTML5 Audio (html5: true).
 * Web Audio mode does not expose `_node` and this is a no-op.
 */
export function resetAudioNodeTime(howl: Howl): void {
  try {
    const node = (howl as any)._sounds?.[0]?._node as HTMLAudioElement | undefined
    if (node && typeof node.currentTime === "number") {
      node.currentTime = 0
    }
  } catch {
    // Private API shape changed or element not yet created — no-op.
  }
}
