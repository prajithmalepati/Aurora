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

  // Initialize Howl when song changes
  useEffect(() => {
    // Destroy old Howl if exists
    if (howlRef.current) {
      howlRef.current.stop()
      howlRef.current.unload()
      howlRef.current = null
    }

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Don't create Howl if no song
    if (!currentSong || !currentSong.file_path) {
      currentSongRef.current = null
      return
    }

    const songId = String(currentSong.id)
    currentSongRef.current = songId

    // Create new Howl instance with html5: true for streaming
    const howl = new Howl({
      src: `http://localhost:8000/api/songs/${songId}/stream`,
      html5: true,
      preload: true,
      autoplay: true,
      onplay: () => {
        // Start seeking interval on play
        intervalRef.current = window.setInterval(() => {
          if (!seekingRef.current && howlRef.current) {
            updateSeek(howlRef.current.seek())
          }
        }, 1000)
      },
      onpause: () => {
        // Clear seeking interval on pause
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      },
      onend: () => {
        // Clear interval and go to next song
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        next()
      },
      onload: () => {
        // Set duration when loaded
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

    // Set initial volume
    howl.volume(volume)

    return () => {
      // Cleanup on unmount or song change
      if (howlRef.current) {
        howlRef.current.stop()
        howlRef.current.unload()
        howlRef.current = null
      }
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [currentSong?.id])

  // Sync isPlaying state
  useEffect(() => {
    if (!howlRef.current || !currentSong) return

    if (isPlaying) {
      howlRef.current.play()
    } else {
      howlRef.current.pause()
    }
  }, [isPlaying, currentSong])

  // Sync volume state
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