/**
 * playbackErrorHints.ts — User-facing error copy for audio playback failures.
 *
 * Extracted from useAudioPlayer so it can be tested in isolation (no store
 * or browser API dependencies) and grepped for copy compliance.
 *
 * CRITICAL: These strings must never reference "browser", "WebView", or
 * "HTML5". Aurora is a desktop app — the audio engine is the relevant concept.
 */

/** Descriptive hint for a media error code, appended to a toast message.
 *  @param code  — HTML MediaError.code (1–4) or null
 *  @param format — file extension or codec hint (e.g. "flac", "mp3")
 *  @param context — whether this is a load-time or play-time error
 */
export function buildPlaybackErrorHint(
  code: number | null,
  format: string,
  context: "load" | "play",
): string {
  const fmt = format.toUpperCase()
  if (code === 4) {
    return ` — ${fmt} is not supported by Aurora's audio engine yet`
  }
  if (code === 3) {
    return context === "load"
      ? ` — ${fmt} could not be decoded`
      : ` — ${fmt} failed to decode`
  }
  if (code === 2 && context === "load") {
    return " — network error"
  }
  return ""
}
