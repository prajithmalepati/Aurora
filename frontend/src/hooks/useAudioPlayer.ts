import { useEffect, useRef, useCallback } from "react"
import { Howl } from "howler"
import { usePlayerStore } from "@/stores/playerStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { usePlaylistStore } from "@/stores/playlistStore"

export function useAudioPlayer() {
  const howlRef = useRef<Howl | null>(null)
  // Holds the outgoing howl being faded out — cleanup passes it here instead of stopping
  const prevHowlRef = useRef<Howl | null>(null)
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

  // Unmount cleanup — stop everything that's still playing
  useEffect(() => {
    return () => {
      if (howlRef.current) { howlRef.current.stop(); howlRef.current.unload() }
      if (prevHowlRef.current) { prevHowlRef.current.stop(); prevHowlRef.current.unload() }
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
      return
    }

    const songId = String(currentSong.id)
    currentSongRef.current = songId

    usePlayerStore.getState().setIsBuffering(true)

    const ext = currentSong.file_path?.split('.').pop()?.toLowerCase()
    const howl = new Howl({
      src: `http://localhost:8000/api/songs/${songId}/stream`,
      format: ext ? [ext] : undefined,
      html5: true,
      preload: true,
      onplay: () => {
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

            // Crossfade early trigger — clear interval first to prevent double-fire
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
          }
        }, 250)
      },
      onpause: () => {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      },
      onend: () => {
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
      },
      onload: () => {
        if (howlRef.current) {
          setDuration(howlRef.current.duration())
          const song = usePlayerStore.getState().currentSong
          if (song?.start_time_ms && song.start_time_ms > 0) {
            howlRef.current.seek(song.start_time_ms / 1000)
          }
        }
      },
      onloaderror: (_, errorId) => {
        console.error(`Howl load error song ${songId}:`, errorId)
      },
      onplayerror: (_, errorId) => {
        console.error(`Howl play error song ${songId}:`, errorId)
      },
    })

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
      prevHowlRef.current?.play()
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
