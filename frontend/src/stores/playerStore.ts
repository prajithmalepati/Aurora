import { create } from "zustand"
import type { Song } from "@/types"

interface PlayerState {
  currentSong: Song | null
  queue: Song[]
  queueIndex: number
  isPlaying: boolean
  volume: number          // 0 to 1
  preMuteVolume: number   // volume to restore when unmuting
  seek: number            // current position in seconds
  duration: number        // total duration in seconds

  playSong: (song: Song, queue?: Song[]) => void
  togglePlay: () => void
  next: () => void
  previous: () => void
  setVolume: (v: number) => void
  toggleMute: () => void
  setSeek: (s: number) => void
  setDuration: (d: number) => void
  updateSeek: (s: number) => void
  stop: () => void
}

function loadStoredVolume(): number {
  const stored = parseFloat(localStorage.getItem("aurora-volume") ?? "")
  return !isNaN(stored) && stored >= 0 && stored <= 1 ? stored : 0.7
}

const _initVol = loadStoredVolume()

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  volume: _initVol,
  preMuteVolume: _initVol > 0 ? _initVol : 0.7,
  seek: 0,
  duration: 0,

  playSong: (song, queue) => {
    // Only play songs that have a file_path (audio available)
    if (!song.file_path) return

    const newQueue = queue?.filter(s => s.file_path) ?? [song]
    const index = newQueue.findIndex(s => s.id === song.id)

    set({
      currentSong: song,
      queue: newQueue,
      queueIndex: index >= 0 ? index : 0,
      isPlaying: true,
      seek: 0,
      duration: song.duration ?? 0,
    })
  },

  togglePlay: () => {
    const { currentSong, isPlaying } = get()
    if (!currentSong) return
    set({ isPlaying: !isPlaying })
  },

  next: () => {
    const { queue, queueIndex } = get()
    if (queueIndex < queue.length - 1) {
      const nextSong = queue[queueIndex + 1]
      set({
        currentSong: nextSong,
        queueIndex: queueIndex + 1,
        isPlaying: true,
        seek: 0,
        duration: nextSong.duration ?? 0,
      })
    } else {
      // End of queue — stop playing
      set({ isPlaying: false })
    }
  },

  previous: () => {
    const { queue, queueIndex, seek } = get()
    // If more than 3 seconds in, restart current song
    if (seek > 3) {
      set({ seek: 0 })
      return
    }
    if (queueIndex > 0) {
      const prevSong = queue[queueIndex - 1]
      set({
        currentSong: prevSong,
        queueIndex: queueIndex - 1,
        isPlaying: true,
        seek: 0,
        duration: prevSong.duration ?? 0,
      })
    }
  },

  setVolume: (v) => {
    const clamped = Math.max(0, Math.min(1, v))
    localStorage.setItem("aurora-volume", String(clamped))
    if (clamped > 0) {
      set({ volume: clamped, preMuteVolume: clamped })
    } else {
      set({ volume: clamped })
    }
  },

  toggleMute: () => {
    const { volume, preMuteVolume } = get()
    if (volume > 0) {
      localStorage.setItem("aurora-volume", "0")
      set({ volume: 0, preMuteVolume: volume })
    } else {
      const restored = preMuteVolume > 0 ? preMuteVolume : 0.7
      localStorage.setItem("aurora-volume", String(restored))
      set({ volume: restored })
    }
  },
  setSeek: (s) => set({ seek: s }),
  setDuration: (d) => set({ duration: d }),
  updateSeek: (s) => set({ seek: s }),

  stop: () => set({
    currentSong: null,
    isPlaying: false,
    seek: 0,
    duration: 0,
    queue: [],
    queueIndex: 0,
  }),
}))