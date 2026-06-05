import { useEffect, useRef, useCallback } from "react"
import { Howl } from "howler"
import { usePlayerStore } from "@/stores/playerStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { toast } from "@/lib/toast"

export function useAudioPlayer() {
  const howlRef = useRef<Howl | null>(null)
  // Holds the outgoing howl being faded out — cleanup passes it here instead of stopping
  const prevHowlRef = useRef<Howl | null>(null)
  // Preloaded next song's Howl — created ~5s before song end to eliminate silence gap
  const nextHowlRef = useRef<{ howl: Howl; songId: string } | null>(null)
  const intervalRef = useRef<number | null>(null)
  const currentSongRef = useRef<string | null>(null)
  const seekingRef = useRef(false)

  const currentSong = usePlayerStore((state) => state.currentSong)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const volume = usePlayerStore((state) => state.volume)
  const updateSeek = usePlayerStore((state) => state.updateSeek)
  const setDuration = usePlayerStore((state) => state.setDuration)
  const next = usePlayerStore((state) => state.next)

  function resolveXfade(): { enabled: boolean; duration: number } {
    const { queuePlaylistId } = usePlayerStore.getState()
    const settings = useSettingsStore.getState()
    if (queuePlaylistId) {
      const playlist = usePlaylistStore.getState().playlists.find((p) => p.id === queuePlaylistId)
      if (playlist && playlist.crossfade_enabled !== null && playlist.crossfade_enabled !== undefined) {
        return {
          enabled: playlist.crossfade_enabled === 1,
          duration: playlist.crossfade_duration_s ?? settings.crossfadeDuration,
        }
      }
    }
    return { enabled: settings.crossfadeEnabled, duration: settings.crossfadeDuration }
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
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      intervalRef.current = window.setInterval(() => {
        if (!seekingRef.current && howlRef.current) {
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

          // Crossfade early trigger
          const { enabled: xEnabled, duration: xDuration } = resolveXfade()
          if (xEnabled) {
            const howlDuration = howlRef.current.duration()
            if (howlDuration > 0) {
              const effectiveDuration = Math.min(xDuration, howlDuration / 2)
              if (seekSec >= howlDuration - effectiveDuration) {
                window.clearInterval(intervalRef.current!)
                intervalRef.current = null
                next()
              }
            }
          }

          // Pre-buffer next song when within 5 seconds of end (B4 fix)
          preloadNextIfNeeded(seekSec)
        }
      }, 250)
    })

    howl.on('pause', () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    })

    howl.on('end', () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
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
    })

    howl.on('playerror', (_, errorId) => {
      console.error(`Howl play error song ${songId}:`, errorId)
      const song = usePlayerStore.getState().currentSong
      const songTitle = song?.title ?? "Unknown song"
      toast.error(`Playback interrupted for "${songTitle}"`)
    })
  }

  /** Create a new Howl for the next song and store in nextHowlRef.
   *  Replaces stale preloads when queue order changes (shuffle, etc.). */
  function preloadNextIfNeeded(currentSeekSec: number) {
    const hDuration = howlRef.current?.duration()
    if (!hDuration || hDuration <= 0 || currentSeekSec < hDuration - 5) return

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
    }

    const preExt = nextSong.file_path.split('.').pop()?.toLowerCase()
    nextHowlRef.current = {
      howl: new Howl({
        src: `http://localhost:8000/api/songs/${preId}/stream`,
        format: preExt ? [preExt] : undefined,
        html5: true,
        preload: true,
      }),
      songId: preId,
    }
  }

  // Unmount cleanup — stop everything that's still playing
  useEffect(() => {
    return () => {
      if (howlRef.current) { howlRef.current.stop(); howlRef.current.unload() }
      if (prevHowlRef.current) { prevHowlRef.current.stop(); prevHowlRef.current.unload() }
      if (nextHowlRef.current) { nextHowlRef.current.howl.unload(); nextHowlRef.current = null }
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [])

  // Song-change effect — fires only when currentSong.id changes.
  // Cleanup does NOT stop the outgoing howl; it hands it to prevHowlRef so this
  // effect's body can crossfade it instead of hard-cutting.
  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // The previous effect's cleanup deposited the outgoing howl here
    const prev = prevHowlRef.current
    prevHowlRef.current = null

    const { enabled, duration } = resolveXfade()
    const crossfadeIn = enabled && (prev?.playing() ?? false)

    // Fade out / stop the outgoing howl
    if (prev) {
      if (crossfadeIn) {
        prev.fade(prev.volume(), 0, duration * 1000)
        setTimeout(() => { prev.stop(); prev.unload() }, duration * 1000)
      } else {
        prev.stop()
        prev.unload()
      }
    }

    if (!currentSong?.file_path) {
      currentSongRef.current = null
      // Clear stale preloaded Howl when queue ends
      if (nextHowlRef.current) {
        nextHowlRef.current.howl.unload()
        nextHowlRef.current = null
      }
      return
    }

    const songId = String(currentSong.id)
    currentSongRef.current = songId

    // --- Check for preloaded Howl (B4 fix: eliminate silence gap) ---
    const preloaded = nextHowlRef.current
    let howl: Howl

    if (preloaded && preloaded.songId === songId) {
      // Promote preloaded Howl — audio already buffered, just attach handlers
      howl = preloaded.howl
      nextHowlRef.current = null
      bindHowlHandlers(howl, songId)
      // Run post-load init now (onload already fired during preload)
      initHowlAfterLoad(howl)
      usePlayerStore.getState().setIsBuffering(false)
    } else {
      // Destroy stale preload (wrong song, or user skipped)
      if (preloaded) {
        preloaded.howl.unload()
        nextHowlRef.current = null
      }

      usePlayerStore.getState().setIsBuffering(true)

      const ext = currentSong.file_path?.split('.').pop()?.toLowerCase()
      howl = new Howl({
        src: `http://localhost:8000/api/songs/${songId}/stream`,
        format: ext ? [ext] : undefined,
        html5: true,
        preload: true,
      })
      bindHowlHandlers(howl, songId)
    }

    howlRef.current = howl

    if (usePlayerStore.getState().isPlaying) {
      const ctx: AudioContext | undefined = (window as any).Howler?.ctx
      if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
      if (crossfadeIn) {
        howl.volume(0)
        howl.play()
        howl.fade(0, volume, duration * 1000)
      } else {
        howl.volume(volume)
        howl.play()
      }
    } else {
      howl.volume(volume)
    }

    return () => {
      // Hand off to prevHowlRef — DO NOT stop here, let the next body crossfade
      prevHowlRef.current = howl
      if (howlRef.current === howl) howlRef.current = null
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
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
      const ctx: AudioContext | undefined = (window as any).Howler?.ctx
      if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
      howlRef.current.play()
      if (prevHowlRef.current && prevHowlRef.current.volume() > 0.05) {
        prevHowlRef.current.play()
      }
    } else {
      howlRef.current.pause()
      prevHowlRef.current?.pause()
    }
  }, [isPlaying])

  // Volume sync
  useEffect(() => {
    if (!howlRef.current) return
    howlRef.current.volume(volume)
    // Don't touch prevHowlRef — it's mid-fade
  }, [volume])

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
