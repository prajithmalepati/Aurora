import { useEffect, useRef, useCallback } from "react"
import { Howl } from "howler"
import { usePlayerStore } from "@/stores/playerStore"

export function useAudioPlayer() {
  const howlRef = useRef<Howl | null>(null)
  const intervalRef = useRef<number | null>(null)
  const currentSongRef = useRef<string | null>(null)
  const seekingRef = useRef(false)

  const currentSong = usePlayerStore((state) => state.currentSong)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const volume = usePlayerStore((state) => state.volume)
  const updateSeek = usePlayerStore((state) => state.updateSeek)
  const setDuration = usePlayerStore((state) => state.setDuration)
  const next = usePlayerStore((state) => state.next)

  // Single chokepoint: ALL Howl creation and initial playback goes through here.
  // Fires only when the song ID changes. Stops/unloads the previous Howl before
  // creating a new one, then plays immediately if the store says isPlaying=true.
  useEffect(() => {
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
            updateSeek(howlRef.current.seek())
          }
        }, 1000)
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

    // Read current isPlaying from store directly — not from closure —
    // to avoid stale-value issues when this effect runs due to song change
    // while isPlaying hasn't changed (the isPlaying effect won't re-run then).
    if (usePlayerStore.getState().isPlaying) {
      howl.play()
    }

    return () => {
      // Use the local howl reference so we always clean up the correct instance
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
  // Does NOT depend on currentSong — song switches are handled entirely above.
  useEffect(() => {
    if (!howlRef.current) return
    if (isPlaying) {
      howlRef.current.play()
    } else {
      howlRef.current.pause()
    }
  }, [isPlaying])

  // Volume sync
  useEffect(() => {
    if (!howlRef.current) return
    howlRef.current.volume(volume)
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
