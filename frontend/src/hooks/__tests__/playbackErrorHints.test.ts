import { describe, it, expect } from "vitest"
import { buildPlaybackErrorHint } from "@/lib/playbackErrorHints"

/**
 * Regression: Aurora is a desktop app. Error copy must never reference
 * "browser" — the audio engine is WebView/HTML5 Audio today, but the
 * user-facing message must describe it as Aurora's engine limitation.
 *
 * See: N50.6 — FLAC unsupported UX copy + native-audio architecture clarity
 */
describe("buildPlaybackErrorHint", () => {
  // --- code 4: MEDIA_ERR_SRC_NOT_SUPPORTED (format not decodable) ---

  it("code 4 load — says 'Aurora's audio engine', never 'browser'", () => {
    const hint = buildPlaybackErrorHint(4, "flac", "load")
    expect(hint).toContain("Aurora")
    expect(hint).not.toContain("browser")
    expect(hint).not.toContain("Browser")
    expect(hint).toContain("FLAC")
  })

  it("code 4 play — says 'Aurora's audio engine', never 'browser'", () => {
    const hint = buildPlaybackErrorHint(4, "ogg", "play")
    expect(hint).toContain("Aurora")
    expect(hint).not.toContain("browser")
    expect(hint).toContain("OGG")
  })

  it("code 4 — format is uppercased in the message", () => {
    expect(buildPlaybackErrorHint(4, "flac", "load")).toContain("FLAC")
    expect(buildPlaybackErrorHint(4, "mp3", "play")).toContain("MP3")
    expect(buildPlaybackErrorHint(4, "m4a_alac", "load")).toContain("M4A_ALAC")
  })

  // --- code 3: MEDIA_ERR_DECODE (corrupt or malformed file) ---

  it("code 3 load — distinguishes decode failure from unsupported format", () => {
    const hint = buildPlaybackErrorHint(3, "flac", "load")
    expect(hint).toContain("could not be decoded")
    expect(hint).not.toContain("browser")
    expect(hint).not.toContain("not supported")
  })

  it("code 3 play — distinguishes decode failure from unsupported format", () => {
    const hint = buildPlaybackErrorHint(3, "mp3", "play")
    expect(hint).toContain("failed to decode")
    expect(hint).not.toContain("browser")
    expect(hint).not.toContain("not supported")
  })

  // --- code 2: MEDIA_ERR_NETWORK ---

  it("code 2 load — reports network error", () => {
    const hint = buildPlaybackErrorHint(2, "mp3", "load")
    expect(hint).toContain("network")
    expect(hint).not.toContain("browser")
  })

  it("code 2 play — empty (no network hint for play errors)", () => {
    const hint = buildPlaybackErrorHint(2, "mp3", "play")
    expect(hint).toBe("")
  })

  // --- null / unknown codes ---

  it("null code — returns empty string", () => {
    expect(buildPlaybackErrorHint(null, "flac", "load")).toBe("")
    expect(buildPlaybackErrorHint(null, "mp3", "play")).toBe("")
  })

  it("unknown code (e.g. 1) — returns empty string", () => {
    expect(buildPlaybackErrorHint(1, "wav", "load")).toBe("")
  })

  // --- blanket "browser" check across all codes ---

  it("never mentions 'browser' for any error code or format", () => {
    const formats = ["flac", "mp3", "ogg", "wav", "aac", "m4a", "wma", "opus"]
    const codes = [null, 1, 2, 3, 4]
    const contexts = ["load", "play"] as const

    for (const fmt of formats) {
      for (const code of codes) {
        for (const ctx of contexts) {
          const hint = buildPlaybackErrorHint(code, fmt, ctx)
          if (hint.toLowerCase().includes("browser")) {
            throw new Error(
              `hint for code=${code} fmt=${fmt} ctx=${ctx} must not contain "browser", got: "${hint}"`,
            )
          }
        }
      }
    }
  })
})
