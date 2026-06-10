import { useEffect, useRef, useCallback } from "react"
import { Howl } from "howler"
import { usePlayerStore } from "@/stores/playerStore"
import { useSettingsStore } from "@/stores/settingsStore"
import type { CrossfadeCurve } from "@/stores/settingsStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { toast } from "@/lib/toast"
import { getBaseUrl } from "@/lib/api"
import { resumeAudioContext, resetAudioNodeTime } from "@/lib/howlerCompat"

export function useAudioPlayer() {
  const howlRef = useRef<Howl | null>(null)
  // Holds the outgoing howl being faded out — cleanup passes it here instead of stopping
  const prevHowlRef = useRef<Howl | null>(null)
  // Title of the outgoing song (for crossfade indicator)
  const prevTitleRef = useRef<string | null>(null)
  // Preloaded next song's Howl — created ~5s before song end to eliminate silence gap
  const nextHowlRef = useRef<{ howl: Howl; songId: string } | null>(null)
  // Tracks whether the preloaded Howl's onload has fired (fully decoded, ready to play)
  const preloadReadyRef = useRef<boolean>(false)
  const intervalRef = useRef<number | null>(null)
  const xfadeIntervalRef = useRef<number | null>(null) // equal-power crossfade interval
  const currentSongRef = useRef<string | null>(null)
  const seekingRef = useRef(false)
  // Collects all Howls from rapid transitions that need cleanup
  const staleHowlsRef = useRef<Howl[]>([])

  const currentSong = usePlayerStore((state) => state.currentSong)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const volume = usePlayerStore((state) => state.volume)
  const replaygainMode = useSettingsStore((state) => state.replaygainMode)
  const updateSeek = usePlayerStore((state) => state.updateSeek)
  const setDuration = usePlayerStore((state) => state.setDuration)
  const next = usePlayerStore((state) => state.next)

  /** Compute Howler volume with ReplayGain applied.
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
          duration: playlist.crossfade_duration_s ?? settings.crossfadeDuration,
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
   *  Called from both onload event and after promoting a preloaded Howl. */
  function initHowlAfterLoad(howl: Howl) {
    setDuration(howl.duration())
    const song = usePlayerStore.getState().currentSong
    if (song?.start_time_ms && song.start_time_ms > 0) {
      howl.seek(song.start_time_ms / 1000)
    }
  }

  /** Attach all event handlers (play, pause, end, load, errors) to a Howl instance.
   *  Used for both newly created and promoted preloaded Howls. */
  function bindHowlHandlers(howl: Howl, songId: string) {
    howl.on('play', () => {
      usePlayerStore.getState().setIsBuffering(false)
      if (intervalRef.current) window.clearTimeout(intervalRef.current)

      const tick = () => {
        if (!seekingRef.current && howlRef.current && howlRef.current.state() === 'loaded') {
          const seekSec = howlRef.current.seek()
          updateSeek(seekSec)

          // End-time enforcement (playlist trim)
          const song = usePlayerStore.getState().currentSong
          if (song?.end_time_ms && song.end_time_ms > 0 && seekSec * 1000 >= song.end_time_ms) {
            const { repeatMode } = usePlayerStore.getState()
            if (repeatMode === "one") {
              const startSec = (song.start_time_ms ?? 0) / 1000
              howlRef.current?.seek(startSec)
              updateSeek(startSec)
            } else {
              next()
            }
            return
          }

          // Crossfade early trigger — fires at crossfadeDuration seconds before end
          const { enabled: xEnabled, duration: xDuration } = resolveXfade()
          if (xEnabled) {
            const howlDuration = howlRef.current.duration()
            if (howlDuration > 0) {
              const triggerPoint = Math.max(0, howlDuration - xDuration)
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

    howl.on('pause', () => {
      if (intervalRef.current) {
        window.clearTimeout(intervalRef.current)
        intervalRef.current = null
      }
    })

    howl.on('end', () => {
      if (intervalRef.current) {
        window.clearTimeout(intervalRef.current)
        intervalRef.current = null
      }
      const { repeatMode } = usePlayerStore.getState()
      if (repeatMode === "one") {
        howl.seek(0)
        howl.play()
        updateSeek(0)
      } else {
        next()
      }
    })

    howl.on('load', () => {
      if (howlRef.current === howl) {
        initHowlAfterLoad(howl)
      }
    })

    howl.on('loaderror', (_, errorId) => {
      console.error(`Howl load error song ${songId}:`, errorId)
      const song = usePlayerStore.getState().currentSong
      const songTitle = song?.title ?? "Unknown song"
      toast.error(`Failed to load "${songTitle}" — format may be unsupported`)
      usePlayerStore.getState().setIsBuffering(false)
      setTimeout(() => {
        const { currentSong } = usePlayerStore.getState()
        if (currentSong && String(currentSong.id) === songId) {
          usePlayerStore.getState().next()
        }
      }, 1500)
    })

    howl.on('playerror', (_, errorId) => {
      console.error(`Howl play error song ${songId}:`, errorId)
      const song = usePlayerStore.getState().currentSong
      const songTitle = song?.title ?? "Unknown song"
      toast.error(`Playback interrupted for "${songTitle}"`)
      usePlayerStore.getState().setIsBuffering(false)
      setTimeout(() => {
        const { currentSong } = usePlayerStore.getState()
        if (currentSong && String(currentSong.id) === songId) {
          usePlayerStore.getState().next()
        }
      }, 1500)
    })
  }

  /** Create a new Howl for the next song and store in nextHowlRef.
   *  Replaces stale preloads when queue order changes (shuffle, etc.).
   *  Attaches onload/loaderror so preloadReadyRef stays accurate. */
  function preloadNextIfNeeded(currentSeekSec: number) {
    const hDuration = howlRef.current?.duration()
    if (!hDuration || hDuration <= 0) return
    // For songs > 5s: preload in last 5 seconds. For short songs: preload immediately.
    if (hDuration > 5 && currentSeekSec < hDuration - 5) return

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
      if (nextHowlRef.current) {
        nextHowlRef.current.howl.unload()
        nextHowlRef.current = null
        preloadReadyRef.current = false
      }
      return
    }

    const preId = String(nextSong.id)
    const curId = currentSong?.id != null ? String(currentSong.id) : null
    if (preId === curId) return

    // Already preloaded the correct song
    if (nextHowlRef.current?.songId === preId) return

    // Destroy stale preload (wrong song due to shuffle / queue change)
    if (nextHowlRef.current) {
      nextHowlRef.current.howl.unload()
      nextHowlRef.current = null
      preloadReadyRef.current = false
    }

    const preExt = nextSong.file_path.split('.').pop()?.toLowerCase()
    nextHowlRef.current = {
      howl: new Howl({
        src: `${getBaseUrl()}/api/songs/${preId}/stream`,
        format: preExt ? [preExt] : undefined,
        html5: true,
        preload: true,
        onload: () => {
          preloadReadyRef.current = true
        },
        onloaderror: () => {
          console.error(`Gapless preload failed for song ${preId} — falling back to normal load`)
          if (nextHowlRef.current?.songId === preId) {
            nextHowlRef.current.howl.unload()
            nextHowlRef.current = null
            preloadReadyRef.current = false
          }
        },
      }),
      songId: preId,
    }
  }

  // Unmount cleanup — stop everything that's still playing
  useEffect(() => {
    return () => {
      // Drain all stale Howls from rapid transitions
      for (const stale of staleHowlsRef.current) {
        try { stale.stop(); stale.unload() } catch {}
      }
      staleHowlsRef.current = []
      if (xfadeIntervalRef.current) { window.clearInterval(xfadeIntervalRef.current); xfadeIntervalRef.current = null }
      if (howlRef.current) { howlRef.current.stop(); howlRef.current.unload() }
      if (prevHowlRef.current) { prevHowlRef.current.stop(); prevHowlRef.current.unload() }
      if (nextHowlRef.current) { nextHowlRef.current.howl.unload(); nextHowlRef.current = null; preloadReadyRef.current = false }
      if (intervalRef.current) window.clearTimeout(intervalRef.current)
    }
  }, [])

  // Song-change effect — fires only when currentSong.id changes.
  // Cleanup does NOT stop the outgoing howl; it hands it to prevHowlRef so this
  // effect's body can crossfade it instead of hard-cutting.
  useEffect(() => {
    if (intervalRef.current) {
      window.clearTimeout(intervalRef.current)
      intervalRef.current = null
    }

    // Drain all stale Howls from rapid transitions — stop + unload every one
    for (const stale of staleHowlsRef.current) {
      try { stale.stop(); stale.unload() } catch {}
    }
    staleHowlsRef.current = []

    // The previous effect's cleanup deposited the outgoing howl here
    const prev = prevHowlRef.current
    prevHowlRef.current = null

    const { enabled, duration, curve } = resolveXfade()
    const crossfadeIn = enabled && (prev?.playing() ?? false)

    if (!currentSong?.file_path) {
      currentSongRef.current = null
      // Clear stale preloaded Howl when queue ends
      if (nextHowlRef.current) {
        nextHowlRef.current.howl.unload()
        nextHowlRef.current = null
        preloadReadyRef.current = false
      }
      // Clean up the outgoing Howl (no new song to transition to)
      if (prev) {
        prev.stop()
        prev.unload()
      }
      return
    }

    const songId = String(currentSong.id)
    currentSongRef.current = songId

    // --- Check for preloaded Howl (gapless: only promote when fully decoded) ---
    const preloaded = nextHowlRef.current
    const preloadIsReady = preloadReadyRef.current
    let howl: Howl

    if (preloaded && preloaded.songId === songId && preloadIsReady) {
      // Promote preloaded Howl — fully decoded and ready for gapless transition
      howl = preloaded.howl
      nextHowlRef.current = null
      preloadReadyRef.current = false
      bindHowlHandlers(howl, songId)
      // Run post-load init now (onload already fired during preload)
      initHowlAfterLoad(howl)
      usePlayerStore.getState().setIsBuffering(false)
    } else {
      // Destroy stale or unready preload (wrong song, user skipped, load error, or not yet loaded)
      if (preloaded) {
        preloaded.howl.unload()
        nextHowlRef.current = null
        preloadReadyRef.current = false
      }

      usePlayerStore.getState().setIsBuffering(true)

      const ext = currentSong.file_path?.split('.').pop()?.toLowerCase()
      howl = new Howl({
        src: `${getBaseUrl()}/api/songs/${songId}/stream`,
        format: ext ? [ext] : undefined,
        html5: true,
        preload: true,
      })
      bindHowlHandlers(howl, songId)
    }

    howlRef.current = howl

    // --- Gapless transition: play new Howl BEFORE stopping the old one ---
    // This eliminates the silence gap by starting the new audio source
    // while the old one is still finishing its final samples.
    if (usePlayerStore.getState().isPlaying) {
      resumeAudioContext()

      // For non-crossfade gapless: reset the Audio element to start
      // so the transition is sample-precise.
      if (!crossfadeIn) {
        resetAudioNodeTime(howl)
      }

      if (crossfadeIn) {
        // crossfadeIn guarantees prev is non-null (derived from prev?.playing())
        const outgoing = prev!
        howl.volume(0)
        howl.play()

        const fadeDurationMs = duration * 1000
        const targetVol = resolveVolume()

        if (curve === 'overlap') {
          // Overlap: play both at full volume, then cut old one after duration
          howl.volume(targetVol)
          usePlayerStore.getState().setCrossfading(true, prevTitleRef.current ?? undefined)
          setTimeout(() => {
            outgoing.stop()
            outgoing.unload()
            usePlayerStore.getState().setCrossfading(false)
          }, fadeDurationMs)
        } else if (curve === 'equalpower') {
          // Equal Power: cosine curve for constant-power transition
          const prevVol = outgoing.volume()
          const startTime = performance.now()
          usePlayerStore.getState().setCrossfading(true, prevTitleRef.current ?? undefined)

          const equalPowerInterval = setInterval(() => {
            const elapsed = performance.now() - startTime
            const t = Math.min(1, elapsed / fadeDurationMs)
            // Cosine curves: sin² + cos² = 1 → constant power
            const fadeInVol = Math.sin(t * Math.PI / 2) * targetVol
            const fadeOutVol = Math.cos(t * Math.PI / 2) * prevVol
            howl.volume(fadeInVol)
            if (outgoing.playing()) outgoing.volume(fadeOutVol)
            if (t >= 1) {
              clearInterval(equalPowerInterval)
              xfadeIntervalRef.current = null
              outgoing.stop()
              outgoing.unload()
              usePlayerStore.getState().setCrossfading(false)
            }
          }, 33) // ~30fps
          xfadeIntervalRef.current = equalPowerInterval as unknown as number
        } else {
          // Linear: default Howler fade behavior
          usePlayerStore.getState().setCrossfading(true, prevTitleRef.current ?? undefined)
          howl.fade(0, targetVol, fadeDurationMs)
        }
      } else {
        howl.volume(resolveVolume())
        howl.play()
      }
    } else {
      howl.volume(resolveVolume())
    }

    // NOW handle the outgoing Howl — after the new one is already playing.
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
          // Linear: use Howler's built-in fade
          prev.fade(prev.volume(), 0, fadeDurationMs)
          setTimeout(() => {
            prev.stop()
            prev.unload()
            usePlayerStore.getState().setCrossfading(false)
          }, fadeDurationMs)
        }
      } else {
        prev.stop()
        prev.unload()
      }
    }

    return () => {
      // Hand off to prevHowlRef — DO NOT stop here, let the next body crossfade
      prevHowlRef.current = howl
      prevTitleRef.current = currentSong?.title ?? null
      if (howlRef.current === howl) howlRef.current = null
      // Also push into stale array so rapid transitions don't lose Howls
      staleHowlsRef.current.push(howl)
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id])

  // Pause / resume
  useEffect(() => {
    if (!howlRef.current) return
    if (isPlaying) {
      // Resume AudioContext before play — must happen in the leaf effect closest to user gesture.
      // useAudioAnalyser runs later (App.tsx root) and may miss the browser's activation window.
      resumeAudioContext()
      howlRef.current.play()
      if (prevHowlRef.current && prevHowlRef.current.volume() > 0.05) {
        prevHowlRef.current.play()
      }
    } else {
      howlRef.current.pause()
      prevHowlRef.current?.pause()
    }
  }, [isPlaying])

  // Volume sync (includes ReplayGain)
  useEffect(() => {
    if (!howlRef.current) return
    howlRef.current.volume(resolveVolume())
    // Don't touch prevHowlRef — it's mid-fade
  }, [volume, replaygainMode])

  const seekTo = useCallback((seconds: number) => {
    seekingRef.current = true
    usePlayerStore.getState().setSeek(seconds)
    if (howlRef.current) {
      howlRef.current.seek(seconds)
    }
    setTimeout(() => {
      seekingRef.current = false
    }, 200)
  }, [])

  return { seekTo }
}
