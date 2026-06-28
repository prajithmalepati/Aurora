import { useEffect, useRef, useCallback } from "react"
import { usePlayerStore } from "@/stores/playerStore"
import { isPlayable } from "@/stores/playerStore"
import { useSettingsStore } from "@/stores/settingsStore"
import type { CrossfadeCurve } from "@/stores/settingsStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { toast } from "@/lib/toast"
import { getBaseUrl, withToken, api } from "@/lib/api"
import { createPlaybackEngine, unlockAudioOutput } from "@/lib/engines/howlerEngine"
import type { PlaybackEngine, PlaybackSource } from "@/types/playback"

/** Build the PlaybackSource for a library song. URL resolution lives here —
 *  engines receive a fully resolved URL and never construct API paths. */
function streamSource(
  songId: string,
  filePath: string | null | undefined,
  gapless = false,
): PlaybackSource {
  const ext = filePath?.split(".").pop()?.toLowerCase()
  return {
    url: withToken(`${getBaseUrl()}/api/songs/${songId}/stream`),
    format: ext,
    gapless,
  }
}

export function useAudioPlayer() {
  const engineRef = useRef<PlaybackEngine | null>(null)
  // Holds the outgoing engine being faded out — cleanup passes it here instead of stopping
  const prevEngineRef = useRef<PlaybackEngine | null>(null)
  // Title of the outgoing song (for crossfade indicator)
  const prevTitleRef = useRef<string | null>(null)
  // Outgoing engine while a crossfade is in flight — the pause/resume effect
  // must reach it (prevEngineRef is already nulled by then)
  const fadingOutRef = useRef<PlaybackEngine | null>(null)
  // Pending delayed start of the incoming engine (lagged curve) — cleared on
  // transition cleanup so a skip during the delay can't start a ghost engine
  const laggedStartTimerRef = useRef<number | null>(null)
  // Preloaded next song's engine — created ~5s before song end to eliminate silence gap
  const nextEngineRef = useRef<{ engine: PlaybackEngine; songId: string } | null>(null)
  // Tracks whether the preloaded engine has finished loading (fully decoded, ready to play)
  const preloadReadyRef = useRef<boolean>(false)
  const intervalRef = useRef<number | null>(null)
  const xfadeIntervalRef = useRef<number | null>(null) // equal-power crossfade interval
  const currentSongRef = useRef<string | null>(null)
  const seekingRef = useRef(false)
  // Collects all engines from rapid transitions that need cleanup
  const staleEnginesRef = useRef<PlaybackEngine[]>([])

  const currentSong = usePlayerStore((state) => state.currentSong)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const volume = usePlayerStore((state) => state.volume)
  const replaygainMode = useSettingsStore((state) => state.replaygainMode)
  const updateSeek = usePlayerStore((state) => state.updateSeek)
  const setDuration = usePlayerStore((state) => state.setDuration)
  const next = usePlayerStore((state) => state.next)

  /** Compute output volume with ReplayGain applied.
   *  Returns a value clamped to [0, 1]. */
  function resolveVolume(): number {
    const vol = usePlayerStore.getState().volume
    const rgMode = useSettingsStore.getState().replaygainMode
    if (rgMode === "off") return vol

    const song = usePlayerStore.getState().currentSong
    let gainDb: number | null | undefined = null

    if (rgMode === "track") {
      gainDb = song?.replaygain_track_gain
    } else if (rgMode === "album") {
      // Prefer album gain, fall back to track gain if album is missing
      gainDb = song?.replaygain_album_gain ?? song?.replaygain_track_gain
    }

    if (gainDb == null) return vol

    const gain = Math.pow(10, gainDb / 20)
    return Math.max(0, Math.min(1, vol * gain))
  }

  function resolveXfade(): {
    enabled: boolean
    duration: number
    curve: CrossfadeCurve
  } {
    const { queuePlaylistId } = usePlayerStore.getState()
    const settings = useSettingsStore.getState()
    if (queuePlaylistId) {
      const playlist = usePlaylistStore.getState().playlists.find((p) => p.id === queuePlaylistId)
      if (playlist && playlist.crossfade_enabled !== null && playlist.crossfade_enabled !== undefined) {
        return {
          enabled: playlist.crossfade_enabled === 1,
          duration: Math.max(1, Math.min(12, playlist.crossfade_duration_s ?? settings.crossfadeDuration)),
          curve: settings.crossfadeCurve,
        }
      }
    }
    return {
      enabled: settings.crossfadeEnabled,
      duration: settings.crossfadeDuration,
      curve: settings.crossfadeCurve,
    }
  }

  /** Run post-load initialization (set duration, seek to start_time_ms).
   *  Called from both the load event and after promoting a preloaded engine. */
  function initEngineAfterLoad(engine: PlaybackEngine) {
    setDuration(engine.duration())
    const song = usePlayerStore.getState().currentSong
    const { respectTrims } = useSettingsStore.getState()
    if (respectTrims && song?.start_time_ms && song.start_time_ms > 0) {
      engine.seek(song.start_time_ms / 1000)
    }
  }

  /** Attach all event handlers (play, pause, end, load, errors, buffering) to an
   *  engine. Used for both newly created and promoted preloaded engines. */
  function bindEngineHandlers(engine: PlaybackEngine, songId: string) {
    engine.on("buffering", (buffering) => {
      usePlayerStore.getState().setIsBuffering(buffering)
    })

    engine.on("play", () => {
      if (intervalRef.current) window.clearTimeout(intervalRef.current)

      let debugTickCount = 0
      const tick = () => {
        if (!seekingRef.current && engineRef.current && engineRef.current.isLoaded()) {
          const seekSec = engineRef.current.position()
          updateSeek(seekSec)

          // Listening-pass heartbeat (~5s) — position/volume/playing of the live engine
          if (localStorage.getItem("aurora-debug-audio") && ++debugTickCount % 20 === 0) {
            console.log("[audio] heartbeat", {
              song: usePlayerStore.getState().currentSong?.id,
              pos: +seekSec.toFixed(1), dur: +engineRef.current.duration().toFixed(1),
              vol: +engineRef.current.getVolume().toFixed(2),
              playing: engineRef.current.isPlaying(),
            })
          }

          // Trim-out as effective end (Apple Music "Stop Time" convention),
          // only when the user wants trims respected
          const song = usePlayerStore.getState().currentSong
          const { respectTrims } = useSettingsStore.getState()
          const trimEndSec =
            respectTrims && song?.end_time_ms && song.end_time_ms > 0
              ? Math.min(song.end_time_ms / 1000, engineRef.current.duration() || Infinity)
              : null

          // End-time enforcement (playlist trim) — backstop hard advance
          if (trimEndSec !== null && seekSec >= trimEndSec) {
            const { repeatMode } = usePlayerStore.getState()
            if (repeatMode === "one") {
              const startSec = (song?.start_time_ms ?? 0) / 1000
              engineRef.current?.seek(startSec)
              updateSeek(startSec)
            } else {
              next()
            }
            return
          }

          // Crossfade early trigger — fires at crossfadeDuration seconds
          // before the EFFECTIVE end (trim-out if set, else file end).
          // Skipped on repeat-one: the song must loop via the end handler.
          const { enabled: xEnabled, duration: xDuration } = resolveXfade()
          if (xEnabled && usePlayerStore.getState().repeatMode !== "one") {
            const engineDuration = engineRef.current.duration()
            const effectiveEnd = trimEndSec ?? (engineDuration > 0 ? engineDuration : 0)
            if (effectiveEnd > 0) {
              const triggerPoint = Math.max(0, effectiveEnd - xDuration)
              if (seekSec >= triggerPoint) {
                if (intervalRef.current) { window.clearTimeout(intervalRef.current); intervalRef.current = null }
                next()
                return
              }
            }
          }

          // Pre-buffer next song when within 5 seconds of end (B4 fix)
          preloadNextIfNeeded(seekSec)
        }
        intervalRef.current = window.setTimeout(tick, 250)
      }
      intervalRef.current = window.setTimeout(tick, 250)
    })

    engine.on("pause", () => {
      if (intervalRef.current) {
        window.clearTimeout(intervalRef.current)
        intervalRef.current = null
      }
    })

    engine.on("end", () => {
      if (intervalRef.current) {
        window.clearTimeout(intervalRef.current)
        intervalRef.current = null
      }
      const { repeatMode, currentSong: song } = usePlayerStore.getState()
      if (localStorage.getItem("aurora-debug-audio")) {
        console.log("[audio] natural end", { song: song?.id, repeat: repeatMode })
      }
      if (repeatMode === "one") {
        const { respectTrims } = useSettingsStore.getState()
        const startSec = respectTrims ? (song?.start_time_ms ?? 0) / 1000 : 0
        engine.seek(startSec)
        engine.play()
        updateSeek(startSec)
      } else {
        next()
      }
    })

    engine.on("load", () => {
      if (engineRef.current === engine) {
        initEngineAfterLoad(engine)
      }
    })

    engine.on("loaderror", (error) => {
      console.error(`Playback load error song ${songId}:`, error)
      const song = usePlayerStore.getState().currentSong
      const songTitle = song?.title ?? "Unknown song"
      toast.error(`Failed to load "${songTitle}" — format may be unsupported`)
      setTimeout(() => {
        const { currentSong } = usePlayerStore.getState()
        if (currentSong && String(currentSong.id) === songId) {
          usePlayerStore.getState().next()
        }
      }, 1500)
    })

    engine.on("playerror", (error) => {
      console.error(`Playback error song ${songId}:`, error)
      const song = usePlayerStore.getState().currentSong
      const songTitle = song?.title ?? "Unknown song"
      toast.error(`Playback interrupted for "${songTitle}"`)
      setTimeout(() => {
        const { currentSong } = usePlayerStore.getState()
        if (currentSong && String(currentSong.id) === songId) {
          usePlayerStore.getState().next()
        }
      }, 1500)
    })
  }

  /** Create a preload engine for the next song and store in nextEngineRef.
   *  Replaces stale preloads when queue order changes (shuffle, etc.).
   *  Attaches load/loaderror so preloadReadyRef stays accurate. */
  function preloadNextIfNeeded(currentSeekSec: number) {
    const curDuration = engineRef.current?.duration()
    if (!curDuration || curDuration <= 0) return
    const curSong = usePlayerStore.getState().currentSong
    const { respectTrims } = useSettingsStore.getState()
    const effectiveEnd =
      respectTrims && curSong?.end_time_ms && curSong.end_time_ms > 0
        ? Math.min(curSong.end_time_ms / 1000, curDuration)
        : curDuration
    // Preload in last 5 seconds (or last 80% for songs ≤ 5s) before effective end.
    const preloadWindow = Math.min(5, effectiveEnd * 0.8)
    if (currentSeekSec < effectiveEnd - preloadWindow) return

    const state = usePlayerStore.getState()
    const { queue, queueIndex, repeatMode, currentSong } = state
    let nextSong = null
    if (queueIndex < queue.length - 1) {
      nextSong = queue[queueIndex + 1]
    } else if (repeatMode === 'all' && queue.length > 0) {
      nextSong = queue[0]
    }

    if (!nextSong?.file_path) {
      // No next song — destroy any existing preload
      if (nextEngineRef.current) {
        nextEngineRef.current.engine.unload()
        nextEngineRef.current = null
        preloadReadyRef.current = false
      }
      return
    }

    const preId = String(nextSong.id)
    const curId = currentSong?.id != null ? String(currentSong.id) : null
    if (preId === curId) return

    // Already preloaded the correct song
    if (nextEngineRef.current?.songId === preId) return

    // Destroy stale preload (wrong song due to shuffle / queue change)
    if (nextEngineRef.current) {
      nextEngineRef.current.engine.unload()
      nextEngineRef.current = null
      preloadReadyRef.current = false
    }

    const preEngine = createPlaybackEngine()
    preEngine.on("load", () => {
      preloadReadyRef.current = true
    })
    preEngine.on("loaderror", () => {
      console.error(`Gapless preload failed for song ${preId} — falling back to normal load`)
      if (nextEngineRef.current?.songId === preId) {
        nextEngineRef.current.engine.unload()
        nextEngineRef.current = null
        preloadReadyRef.current = false
      }
    })
    preEngine.load(streamSource(preId, nextSong.file_path, true))
    nextEngineRef.current = { engine: preEngine, songId: preId }
  }

  // Unmount cleanup — stop everything that's still playing
  useEffect(() => {
    return () => {
      // Drain all stale engines from rapid transitions
      for (const stale of staleEnginesRef.current) {
        try { stale.stop(); stale.unload() } catch {}
      }
      staleEnginesRef.current = []
      if (xfadeIntervalRef.current) { window.clearInterval(xfadeIntervalRef.current); xfadeIntervalRef.current = null }
      if (engineRef.current) { engineRef.current.stop(); engineRef.current.unload() }
      if (prevEngineRef.current) { prevEngineRef.current.stop(); prevEngineRef.current.unload() }
      if (nextEngineRef.current) { nextEngineRef.current.engine.unload(); nextEngineRef.current = null; preloadReadyRef.current = false }
      if (intervalRef.current) window.clearTimeout(intervalRef.current)
      if (laggedStartTimerRef.current) window.clearTimeout(laggedStartTimerRef.current)
    }
  }, [])

  // Song-change effect — fires only when currentSong.id changes.
  // Cleanup does NOT stop the outgoing engine; it hands it to prevEngineRef so
  // this effect's body can crossfade it instead of hard-cutting.
  useEffect(() => {
    if (intervalRef.current) {
      window.clearTimeout(intervalRef.current)
      intervalRef.current = null
    }

    // The previous effect's cleanup deposited the outgoing engine here
    const prev = prevEngineRef.current
    prevEngineRef.current = null

    // Neutralize the outgoing engine's handlers. Its natural `end` arrives
    // DURING the crossfade (trigger fires at duration - fade, so real end lands
    // ~fade-duration later, before fade-complete stop()) — if the handler stays
    // bound it calls next() a second time and yanks the incoming song away
    // mid-fade. Same for stale buffering/error handlers.
    if (prev) {
      for (const ev of ["buffering", "play", "pause", "end", "load", "loaderror", "playerror"] as const) {
        prev.off(ev)
      }
    }

    // Drain stale engines from rapid transitions — but never the deposited prev:
    // stopping it here would make prev.isPlaying() read false below and kill every
    // crossfade/gapless handoff. prev stays tracked for the NEXT drain, which
    // catches it if an interrupted fade leaks it mid-transition.
    for (const stale of staleEnginesRef.current) {
      if (stale === prev) continue
      try { stale.stop(); stale.unload() } catch {}
    }
    staleEnginesRef.current = prev ? [prev] : []
    // Any earlier fade's outgoing engine was just drained (or finished on its
    // own timer) — this transition sets it again if it starts a new fade.
    fadingOutRef.current = null

    const { enabled, duration, curve } = resolveXfade()
    const crossfadeIn = enabled && (prev?.isPlaying() ?? false)

    // Listening-pass diagnostics — enable with localStorage.setItem("aurora-debug-audio", "1")
    if (localStorage.getItem("aurora-debug-audio")) {
      console.log("[audio] transition", {
        to: currentSong?.id, title: currentSong?.title, crossfadeIn, curve, fadeS: duration,
        prevPlaying: prev?.isPlaying() ?? false, targetVol: resolveVolume(),
        repeat: usePlayerStore.getState().repeatMode, isPlaying: usePlayerStore.getState().isPlaying,
      })
    }

    if (!currentSong) {
      currentSongRef.current = null
      // Clear stale preloaded engine when queue ends
      if (nextEngineRef.current) {
        nextEngineRef.current.engine.unload()
        nextEngineRef.current = null
        preloadReadyRef.current = false
      }
      // Clean up the outgoing engine (no new song to transition to)
      if (prev) {
        prev.stop()
        prev.unload()
      }
      return
    }

    if (!isPlayable(currentSong)) {
      currentSongRef.current = null
      if (nextEngineRef.current) {
        nextEngineRef.current.engine.unload()
        nextEngineRef.current = null
        preloadReadyRef.current = false
      }
      if (prev) {
        prev.stop()
        prev.unload()
      }
      return
    }

    const songId = String(currentSong.id)
    currentSongRef.current = songId

    // --- Check for preloaded engine (gapless: only promote when fully decoded) ---
    const preloaded = nextEngineRef.current
    const preloadIsReady = preloadReadyRef.current
    let engine: PlaybackEngine

    if (preloaded && preloaded.songId === songId && preloadIsReady) {
      // Promote preloaded engine — fully decoded and ready for gapless transition
      engine = preloaded.engine
      nextEngineRef.current = null
      preloadReadyRef.current = false
      bindEngineHandlers(engine, songId)
      // Run post-load init now (load already completed during preload)
      initEngineAfterLoad(engine)
      usePlayerStore.getState().setIsBuffering(false)
    } else {
      // Destroy stale or unready preload (wrong song, user skipped, load error, or not yet loaded)
      if (preloaded) {
        preloaded.engine.unload()
        nextEngineRef.current = null
        preloadReadyRef.current = false
      }

      engine = createPlaybackEngine()
      bindEngineHandlers(engine, songId)

      // Addon songs need async URL resolution; local songs load synchronously
      if (currentSong.file_path) {
        engine.load(streamSource(songId, currentSong.file_path))
        engineRef.current = engine
      } else {
        // Addon resolve-then-load (§2b: guarded async inside the effect)
        // load() emits buffering:true via the bound handler — reuse it for the resolve gap
        usePlayerStore.getState().setIsBuffering(true)
        engineRef.current = engine

        // Handle prev SYNCHRONOUSLY — don't defer to startPlayback.
        // During the resolve gap, the old song must be stopped (non-crossfade)
        // or kept reachable via fadingOutRef (crossfade) so pause can stop it.
        if (prev) {
          if (crossfadeIn) {
            // Keep prev reachable for the isPlaying effect during the resolve gap.
            // startPlayback will handle the actual fade once the new engine loads.
            fadingOutRef.current = prev
          } else {
            prev.stop()
            prev.unload()
          }
        }
        const doResolve = async () => {
          try {
            const res = await api.get<{ data: { type: string; url: string; expires_at?: string } }>(
              `/songs/${songId}/resolve`
            )
            // Staleness guard (§0.5): rapid skip during resolve must not start a ghost engine
            if (currentSongRef.current !== songId) return
            const { url, type } = res.data
            if (type === "local") {
              // Backend returned a local file path — use the stream endpoint
              engine.load(streamSource(songId, url))
            } else {
              // Stream URL from addon — pass format hint for extensionless URLs (§2b)
              const format = currentSong.file_format ?? undefined
              engine.load({ url, format })
            }
            // Start playback after load — engine.play() is a no-op before load
            startPlayback(engine)
          } catch (err) {
            console.error(`Addon resolve failed for song ${songId}:`, err)
            // Re-check staleness before showing error (§0.5)
            if (currentSongRef.current !== songId) return
            const song = usePlayerStore.getState().currentSong
            toast.error(`Failed to resolve stream for "${song?.title ?? "Unknown"}"`)
            usePlayerStore.getState().setIsBuffering(false)
            setTimeout(() => {
              if (currentSongRef.current === songId) {
                usePlayerStore.getState().next()
              }
            }, 1500)
          }
        }
        doResolve()
      }
    }

    // --- Start playback / crossfade for the new engine ---
    // For local songs this runs synchronously; for addon songs it's called
    // from doResolve() after engine.load() completes (play() is a no-op before load).
    function startPlayback(engine: PlaybackEngine) {
      if (usePlayerStore.getState().isPlaying) {
        unlockAudioOutput()

        // For non-crossfade gapless: reset the audio position to start
        // so the transition is sample-precise.
        if (!crossfadeIn) {
          engine.resetToStart()
        }

        if (crossfadeIn) {
          // crossfadeIn guarantees prev is non-null (derived from prev?.isPlaying())
          const outgoing = prev!
          const fadeDurationMs = duration * 1000
          const targetVol = resolveVolume()
          fadingOutRef.current = outgoing
          const fadeDone = () => {
            if (fadingOutRef.current === outgoing) fadingOutRef.current = null
          }

          // Howler trap: on an already-loaded engine (promoted preload), play()
          // holds _playLock until the html5 play() promise resolves. volume()/
          // fade() calls made during the lock are pushed onto Howler's action
          // queue with no event that ever releases them — the song plays at
          // volume 0 forever. So: set volume BEFORE play(), and start fades on
          // the engine's play event (emitted after the lock clears).

          if (curve === 'overlap') {
            // Overlap: play both at full volume for the duration, then taper the
            // old one out over 250ms — a true hard cut sounds like a glitch
            engine.setVolume(targetVol)
            engine.play()
            usePlayerStore.getState().setCrossfading(true, prevTitleRef.current ?? undefined)
            setTimeout(() => {
              outgoing.fade(outgoing.getVolume(), 0, 250)
              setTimeout(() => {
                outgoing.stop()
                outgoing.unload()
                fadeDone()
                usePlayerStore.getState().setCrossfading(false)
              }, 250)
            }, fadeDurationMs)
          } else if (curve === 'equalpower') {
            engine.setVolume(0)
            engine.play()
            // Equal Power: cosine curve for constant-power transition
            const prevVol = outgoing.getVolume()
            const startTime = performance.now()
            usePlayerStore.getState().setCrossfading(true, prevTitleRef.current ?? undefined)

            const equalPowerInterval = setInterval(() => {
              const elapsed = performance.now() - startTime
              const t = Math.min(1, elapsed / fadeDurationMs)
              // Cosine curves: sin² + cos² = 1 → constant power
              const fadeInVol = Math.sin(t * Math.PI / 2) * targetVol
              const fadeOutVol = Math.cos(t * Math.PI / 2) * prevVol
              engine.setVolume(fadeInVol)
              if (outgoing.isPlaying()) outgoing.setVolume(fadeOutVol)
              if (t >= 1) {
                clearInterval(equalPowerInterval)
                xfadeIntervalRef.current = null
                outgoing.stop()
                outgoing.unload()
                fadeDone()
                usePlayerStore.getState().setCrossfading(false)
              }
            }, 33) // ~30fps
            xfadeIntervalRef.current = equalPowerInterval as unknown as number
          } else if (curve === 'lagged') {
            // Lagged: outgoing fades to 0 over the full N (handled in the
            // `if (prev)` block below — it shares the linear fade-out path);
            // incoming stays parked for N/2, then plays and fades up over
            // the remaining N/2. See PLAYLOCK TRAP note: volume set before
            // play, fade started from the play event.
            engine.setVolume(0)
            const startFade = () => {
              engine.off("play", startFade)
              engine.fade(0, targetVol, fadeDurationMs / 2)
            }
            engine.on("play", startFade)
            laggedStartTimerRef.current = window.setTimeout(() => {
              laggedStartTimerRef.current = null
              // A newer transition replaced this engine — do nothing
              if (engineRef.current !== engine) return
              // Resume during the delay already started this engine via the
              // isPlaying effect — a second play() would spawn a second Howler
              // sound instance of the same file (double audio)
              if (engine.isPlaying()) return
              if (!usePlayerStore.getState().isPlaying) {
                // User paused during the delay: don't start. Park the engine at
                // target volume so resume (isPlaying effect) comes in audible.
                engine.off("play", startFade)
                engine.setVolume(targetVol)
                return
              }
              engine.play()
            }, fadeDurationMs / 2)
            usePlayerStore.getState().setCrossfading(true, prevTitleRef.current ?? undefined)
          } else {
            // Linear: engine-native fade, deferred to the play event (see Howler
            // trap note above — fade() during _playLock is silently dropped)
            engine.setVolume(0)
            const startFade = () => {
              engine.off("play", startFade)
              engine.fade(0, targetVol, fadeDurationMs)
            }
            engine.on("play", startFade)
            engine.play()
            usePlayerStore.getState().setCrossfading(true, prevTitleRef.current ?? undefined)
          }
        } else {
          engine.setVolume(resolveVolume())
          engine.play()
        }
      } else {
        engine.setVolume(resolveVolume())
      }

      // NOW handle the outgoing engine — after the new one is already playing.
      // The momentary overlap of two audio sources produces the gapless transition.
      if (prev) {
        if (crossfadeIn) {
          const fadeDurationMs = duration * 1000
          if (curve === 'overlap') {
            // Already handled above via setTimeout
            // prev continues at full volume until the timeout fires
          } else if (curve === 'equalpower') {
            // Already handled above via setInterval
            // prev volume is being manually ramped down
          } else {
            // Linear AND lagged: engine-native fade out over the full duration
            prev.fade(prev.getVolume(), 0, fadeDurationMs)
            setTimeout(() => {
              prev.stop()
              prev.unload()
              if (fadingOutRef.current === prev) fadingOutRef.current = null
              usePlayerStore.getState().setCrossfading(false)
            }, fadeDurationMs)
          }
        } else {
          prev.stop()
          prev.unload()
        }
      }
    }

    // For local songs, start playback synchronously; addon songs call startPlayback from doResolve()
    if (currentSong.file_path) {
      startPlayback(engine)
    }

    return () => {
      // Hand off to prevEngineRef — DO NOT stop here, let the next body crossfade
      prevEngineRef.current = engine
      prevTitleRef.current = currentSong?.title ?? null
      if (engineRef.current === engine) engineRef.current = null
      // Also push into stale array so rapid transitions don't lose engines
      staleEnginesRef.current.push(engine)
      if (intervalRef.current) {
        window.clearTimeout(intervalRef.current)
        intervalRef.current = null
      }
      if (xfadeIntervalRef.current) {
        window.clearInterval(xfadeIntervalRef.current)
        xfadeIntervalRef.current = null
        // If crossfade was interrupted, ensure state is cleaned up
        usePlayerStore.getState().setCrossfading(false)
      }
      if (laggedStartTimerRef.current) {
        window.clearTimeout(laggedStartTimerRef.current)
        laggedStartTimerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id])

  // Pause / resume
  useEffect(() => {
    if (!engineRef.current) return
    if (isPlaying) {
      // Unlock audio output before play — must happen in the leaf effect closest
      // to the user gesture. useAudioAnalyser runs later (App.tsx root) and may
      // miss the browser's activation window.
      unlockAudioOutput()
      // Guard: don't play an unloaded engine (addon resolve in flight).
      // Howler queues play-on-load, which conflicts with doResolve's post-load play.
      if (engineRef.current.isLoaded()) {
        engineRef.current.play()
      }
      // Resume a mid-crossfade outgoing engine only if it's still audible —
      // pausing snaps Howler fades to their end value, so a faded-out engine
      // reads 0 here and stays stopped
      if (fadingOutRef.current && fadingOutRef.current.isLoaded() && fadingOutRef.current.getVolume() > 0.05) {
        fadingOutRef.current.play()
      }
    } else {
      engineRef.current.pause()
      fadingOutRef.current?.pause()
    }
  }, [isPlaying])

  // Volume sync (includes ReplayGain)
  useEffect(() => {
    if (!engineRef.current) return
    engineRef.current.setVolume(resolveVolume())
    // Don't touch prevEngineRef — it's mid-fade
  }, [volume, replaygainMode])

  const seekTo = useCallback((seconds: number) => {
    seekingRef.current = true
    usePlayerStore.getState().setSeek(seconds)
    if (engineRef.current) {
      engineRef.current.seek(seconds)
    }
    setTimeout(() => {
      seekingRef.current = false
    }, 200)
  }, [])

  return { seekTo }
}
