import { useEffect, useRef, useCallback } from "react"
import { Howl } from "howler"
import { usePlayerStore } from "@/stores/playerStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { usePlaylistStore } from "@/stores/playlistStore"

export function useAudioPlayer() {
  const howlRef = useRef<Howl | null>(null)
  const nextHowlRef = useRef<Howl | null>(null)
  const intervalRef = useRef<number | null>(null)
  const currentSongRef = useRef<string | null>(null)
  const seekingRef = useRef(false)
  const crossfadeActiveRef = useRef(false)
  const crossfadeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const crossfadeNextSongIdRef = useRef<number | null>(null)

  const currentSong = usePlayerStore((state) => state.currentSong)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const volume = usePlayerStore((state) => state.volume)
  const updateSeek = usePlayerStore((state) => state.updateSeek)
  const setDuration = usePlayerStore((state) => state.setDuration)
  const next = usePlayerStore((state) => state.next)

  function clearCrossfadeTimers() {
    crossfadeTimersRef.current.forEach(clearTimeout)
    crossfadeTimersRef.current = []
  }

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

  // Single chokepoint: ALL Howl creation and initial playback goes through here.
  // Fires only when the song ID changes.
  useEffect(() => {
    // If crossfade is in progress, suppress normal Howl creation — the fade-complete
    // timer owns the swap. Song-change effect just returns.
    if (crossfadeActiveRef.current) return

    // Cancel any crossfade that was pending from a previous song (manual skip scenario)
    if (nextHowlRef.current) {
      nextHowlRef.current.unload()
      nextHowlRef.current = null
    }
    clearCrossfadeTimers()
    crossfadeNextSongIdRef.current = null

    // Always unload any previous Howl before creating a new one
    if (howlRef.current) {
      howlRef.current.stop()
      howlRef.current.unload()
      howlRef.current = null
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!currentSong?.file_path) {
      currentSongRef.current = null
      return
    }

    const songId = String(currentSong.id)
    currentSongRef.current = songId

    const howl = new Howl({
      src: `http://localhost:8000/api/songs/${songId}/stream`,
      html5: true,
      preload: true,
      onplay: () => {
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
                howlRef.current.seek(startSec)
                updateSeek(startSec)
              } else {
                next()
              }
              return
            }

            // Crossfade initiation
            if (!crossfadeActiveRef.current) {
              const { enabled, duration } = resolveXfade()
              if (enabled) {
                const howlDuration = howlRef.current.duration()
                if (howlDuration > 0) {
                  const effectiveDuration = Math.min(duration, howlDuration / 2)
                  if (seekSec >= howlDuration - effectiveDuration) {
                    const state = usePlayerStore.getState()
                    const nextIdx = state.queueIndex + 1
                    const nextSong =
                      state.queue[nextIdx] ??
                      (state.repeatMode === "all" ? state.queue[0] : null)

                    if (nextSong?.file_path) {
                      crossfadeActiveRef.current = true
                      crossfadeNextSongIdRef.current = nextSong.id
                      const vol = state.volume

                      nextHowlRef.current = new Howl({
                        src: `http://localhost:8000/api/songs/${nextSong.id}/stream`,
                        html5: true,
                        volume: 0,
                        autoplay: true,
                        onend: () => {
                          if (intervalRef.current) {
                            window.clearInterval(intervalRef.current)
                            intervalRef.current = null
                          }
                          const { repeatMode: rm } = usePlayerStore.getState()
                          if (rm === "one") {
                            const s = usePlayerStore.getState().currentSong
                            const startSec2 = (s?.start_time_ms ?? 0) / 1000
                            howlRef.current?.seek(startSec2)
                            howlRef.current?.play()
                            updateSeek(startSec2)
                          } else {
                            next()
                          }
                        },
                        onpause: () => {
                          if (intervalRef.current) {
                            window.clearInterval(intervalRef.current)
                            intervalRef.current = null
                          }
                        },
                      })

                      howlRef.current.fade(vol, 0, effectiveDuration * 1000)
                      nextHowlRef.current.fade(0, vol, effectiveDuration * 1000)

                      const t1 = setTimeout(() => {
                        usePlayerStore.getState().next()
                      }, effectiveDuration * 500)

                      const t2 = setTimeout(() => {
                        howlRef.current?.stop()
                        howlRef.current?.unload()
                        if (nextHowlRef.current) {
                          howlRef.current = nextHowlRef.current
                          nextHowlRef.current = null
                        }
                        crossfadeActiveRef.current = false
                        crossfadeNextSongIdRef.current = null
                        crossfadeTimersRef.current = []
                      }, effectiveDuration * 1000)

                      crossfadeTimersRef.current = [t1, t2]
                    }
                  }
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
        if (crossfadeActiveRef.current) return // crossfade handles advancement
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
        console.error(`Howl load error for song ${songId}, errorId: ${errorId}`)
      },
      onplayerror: (_, errorId) => {
        console.error(`Howl play error for song ${songId}, errorId: ${errorId}`)
      },
    })

    howlRef.current = howl
    howl.volume(volume)

    if (usePlayerStore.getState().isPlaying) {
      howl.play()
    }

    return () => {
      howl.stop()
      howl.unload()
      if (howlRef.current === howl) {
        howlRef.current = null
      }
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id])

  // Pause / resume effect: fires ONLY when isPlaying toggles.
  useEffect(() => {
    if (!howlRef.current) return
    if (isPlaying) {
      howlRef.current.play()
      if (nextHowlRef.current) nextHowlRef.current.play()
    } else {
      howlRef.current.pause()
      if (nextHowlRef.current) nextHowlRef.current.pause()
    }
  }, [isPlaying])

  // Volume sync
  useEffect(() => {
    if (!howlRef.current) return
    howlRef.current.volume(volume)
    // Don't override nextHowlRef volume — it's being faded in
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
