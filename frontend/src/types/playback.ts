/**
 * playback.ts — the PlaybackEngine contract (Phase 0, task 0.8).
 *
 * This is the boundary between Aurora's playback orchestration
 * (useAudioPlayer: queue, crossfade curves, gapless preload, trim
 * enforcement, ReplayGain) and any concrete audio backend.
 *
 * One engine instance = one playable source (a "voice"). Orchestration
 * that needs overlapping audio — crossfade, gapless handoff — holds
 * multiple instances and mixes by driving their volumes. Engines never
 * construct API paths; they receive fully resolved URLs.
 *
 * Implementations:
 *   - HowlerEngine (`@/lib/engines/howlerEngine`) — web/desktop today
 *   - NativeAudioEngine — Phase 3, tauri-plugin-native-audio
 *   - Rust engine (symphonia + cpal) — Phase 4
 */

export interface PlaybackSource {
  /** Fully resolved stream URL. The orchestrator builds it; the engine just plays it. */
  url: string
  /** Container/extension hint, e.g. "flac", "mp3" — needed when the URL has no extension. */
  format?: string
  /** True when this source is loaded ahead of time for a gapless transition.
   *  Engines may use it to prioritize full decode over fast start. */
  gapless?: boolean
}

/**
 * Event payloads. Events fire once per occurrence and are NOT replayed to
 * late subscribers — a handler attached after `load` completed will not
 * receive the missed `load` event; check `isLoaded()` instead.
 */
export interface PlaybackEventPayloads {
  /** Playback actually started (audio is audible). */
  play: void
  /** Playback paused. */
  pause: void
  /** Source played to its natural end. */
  end: void
  /** Source fully loaded; payload is duration in seconds. */
  load: number
  /** Loading failed; payload is the engine-specific error detail. */
  loaderror: unknown
  /** Starting playback failed; payload is the engine-specific error detail. */
  playerror: unknown
  /**
   * Buffering state changed. `true` when the engine starts fetching/decoding
   * and playback cannot proceed; `false` once playback starts or fails
   * terminally. Addon streaming (Phase 2) relies on engines emitting
   * mid-track `true` on network stalls; local-file engines may never stall.
   */
  buffering: boolean
}

export type PlaybackEvent = keyof PlaybackEventPayloads

export type PlaybackEventHandler<E extends PlaybackEvent> = (
  payload: PlaybackEventPayloads[E],
) => void

export interface PlaybackEngine {
  /** Begin loading a source. Replaces any previously loaded source on this
   *  instance. Emits `buffering: true` immediately, then `load` or `loaderror`. */
  load(source: PlaybackSource): void

  /** Start or resume playback. No-op before `load`. */
  play(): void
  /** Pause, keeping position. */
  pause(): void
  /** Stop and reset position to 0. */
  stop(): void
  /** Release all resources. The instance is dead afterwards — create a new
   *  engine for the next source. Safe to call at any time, twice included. */
  unload(): void

  /** Seek to an absolute position in seconds. */
  seek(seconds: number): void
  /** Current position in seconds (0 when nothing is loaded). */
  position(): number
  /** Duration in seconds (0 until loaded). */
  duration(): number

  /** Set output volume, 0..1 (post-mix; ReplayGain math lives in the orchestrator). */
  setVolume(volume: number): void
  /** Current output volume, 0..1. */
  getVolume(): number
  /** Ramp volume from → to over durationMs. Used for linear crossfade. */
  fade(from: number, to: number, durationMs: number): void

  isPlaying(): boolean
  isLoaded(): boolean

  /** Sample-precise reset to position 0, called just before a gapless start.
   *  Engines without that capability no-op. */
  resetToStart(): void

  on<E extends PlaybackEvent>(event: E, handler: PlaybackEventHandler<E>): void
  /** Remove one handler, or all handlers for the event when omitted. */
  off<E extends PlaybackEvent>(event: E, handler?: PlaybackEventHandler<E>): void
}
