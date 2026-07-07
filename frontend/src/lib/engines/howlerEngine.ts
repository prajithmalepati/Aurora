/**
 * howlerEngine.ts — PlaybackEngine implementation on Howler.js (HTML5 Audio).
 *
 * This is the only file (besides howlerCompat.ts, which it wraps) that may
 * import Howler. The orchestrator talks exclusively to the PlaybackEngine
 * interface, so swapping in a native or Rust engine later is an import
 * change, not surgery.
 *
 * Buffering semantics here are coarse: HTML5 Audio gives no reliable
 * mid-track stall signal, so `buffering` is `true` from `load()` until the
 * first `play` (or a terminal error). Streaming engines (Phase 2+) emit
 * finer-grained transitions through the same event.
 */

import { Howl } from "howler"
import { resumeAudioContext, resetAudioNodeTime } from "@/lib/howlerCompat"
import type {
  PlaybackEngine,
  PlaybackEvent,
  PlaybackEventHandler,
  PlaybackEventPayloads,
  PlaybackSource,
} from "@/types/playback"

/** MediaError.code values from the HTML5 spec. */
const MEDIA_ERROR_NAMES: Record<number, string> = {
  1: "MEDIA_ERR_ABORTED",
  2: "MEDIA_ERR_NETWORK",
  3: "MEDIA_ERR_DECODE",
  4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
}

/**
 * Extract a structured diagnostic from a Howler load/play error.
 * Howler passes the native MediaError object (or a number on some paths).
 */
function describeMediaError(error: unknown): {
  code: number | null
  name: string
  message: string
} {
  if (error && typeof error === "object") {
    const me = error as MediaError
    const code = typeof me.code === "number" ? me.code : null
    return {
      code,
      name: (code && MEDIA_ERROR_NAMES[code]) || "UNKNOWN",
      message: me.message || String(error),
    }
  }
  if (typeof error === "number") {
    return {
      code: error,
      name: MEDIA_ERROR_NAMES[error] || "UNKNOWN",
      message: "",
    }
  }
  return { code: null, name: "UNKNOWN", message: String(error) }
}

/** Unlock the shared audio output after a user gesture (browser autoplay
 *  policy). Must be called in a gesture handler or the leaf effect closest
 *  to it. Engine-agnostic name; today it resumes Howler's AudioContext. */
export function unlockAudioOutput(): void {
  resumeAudioContext()
}

/** The single swap point: orchestration code creates engines only through
 *  this factory and never names a concrete engine class. */
export function createPlaybackEngine(): PlaybackEngine {
  return new HowlerEngine()
}

class HowlerEngine implements PlaybackEngine {
  private howl: Howl | null = null
  private listeners = new Map<PlaybackEvent, Set<(payload: unknown) => void>>()

  private emit<E extends PlaybackEvent>(event: E, payload: PlaybackEventPayloads[E]): void {
    this.listeners.get(event)?.forEach((handler) => handler(payload))
  }

  load(source: PlaybackSource): void {
    this.disposeHowl()
    this.emit("buffering", true)

    const howl = new Howl({
      src: source.url,
      format: source.format ? [source.format] : undefined,
      html5: true,
      preload: true,
    })

    howl.on("play", () => {
      this.emit("buffering", false)
      this.emit("play", undefined)
    })
    howl.on("pause", () => this.emit("pause", undefined))
    howl.on("end", () => this.emit("end", undefined))
    howl.on("load", () => this.emit("load", howl.duration()))
    howl.on("loaderror", (_id: number, error: unknown) => {
      const diag = describeMediaError(error)
      console.error(
        `[Aurora] loaderror: code=${diag.code} (${diag.name}) msg="${diag.message}" src=${source.url.split("?")[0]} fmt=${source.format ?? "unknown"}`,
      )
      this.emit("buffering", false)
      this.emit("loaderror", { ...diag, source: source.url.split("?")[0], format: source.format })
    })
    howl.on("playerror", (_id: number, error: unknown) => {
      const diag = describeMediaError(error)
      console.error(
        `[Aurora] playerror: code=${diag.code} (${diag.name}) msg="${diag.message}" src=${source.url.split("?")[0]} fmt=${source.format ?? "unknown"}`,
      )
      this.emit("buffering", false)
      this.emit("playerror", { ...diag, source: source.url.split("?")[0], format: source.format })
    })

    this.howl = howl
  }

  play(): void {
    this.howl?.play()
  }

  pause(): void {
    this.howl?.pause()
  }

  stop(): void {
    this.howl?.stop()
  }

  unload(): void {
    this.disposeHowl()
  }

  seek(seconds: number): void {
    this.howl?.seek(seconds)
  }

  position(): number {
    const pos = this.howl?.seek()
    return typeof pos === "number" ? pos : 0
  }

  duration(): number {
    return this.howl?.duration() ?? 0
  }

  setVolume(volume: number): void {
    this.howl?.volume(volume)
  }

  getVolume(): number {
    const vol = this.howl?.volume()
    return typeof vol === "number" ? vol : 0
  }

  fade(from: number, to: number, durationMs: number): void {
    this.howl?.fade(from, to, durationMs)
  }

  isPlaying(): boolean {
    return this.howl?.playing() ?? false
  }

  isLoaded(): boolean {
    return this.howl?.state() === "loaded"
  }

  resetToStart(): void {
    if (this.howl) resetAudioNodeTime(this.howl)
  }

  on<E extends PlaybackEvent>(event: E, handler: PlaybackEventHandler<E>): void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(handler as (payload: unknown) => void)
  }

  off<E extends PlaybackEvent>(event: E, handler?: PlaybackEventHandler<E>): void {
    if (!handler) {
      this.listeners.delete(event)
      return
    }
    this.listeners.get(event)?.delete(handler as (payload: unknown) => void)
  }

  private disposeHowl(): void {
    if (!this.howl) return
    this.howl.off()
    this.howl.unload()
    this.howl = null
  }
}
