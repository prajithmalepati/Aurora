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
  repeatMode: "none" | "all" | "one"
  isShuffled: boolean
  originalQueue: Song[]
  queuePlaylistId: number | null
  isBuffering: boolean
  setIsBuffering: (v: boolean) => void

  playSong: (song: Song, queue?: Song[], playlistId?: number | null) => void
  togglePlay: () => void
  next: () => void
  previous: () => void
  setVolume: (v: number) => void
  toggleMute: () => void
  setSeek: (s: number) => void
  setDuration: (d: number) => void
  updateSeek: (s: number) => void
  stop: () => void
  cycleRepeat: () => void
  toggleShuffle: () => void
}

function loadStoredVolume(): number {
  const stored = parseFloat(localStorage.getItem("aurora-volume") ?? "")
  return !isNaN(stored) && stored >= 0 && stored <= 1 ? stored : 0.7
}

const _initVol = loadStoredVolume()

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  volume: _initVol,
  preMuteVolume: _initVol > 0 ? _initVol : 0.7,
  seek: 0,
  duration: 0,
  repeatMode: "none" as "none" | "all" | "one",
  isShuffled: false,
  originalQueue: [],
  queuePlaylistId: null,
  isBuffering: false,

  playSong: (song, queue, playlistId = null) => {
    if (!song.file_path) return
    const newQueue = queue?.filter((s) => s.file_path) ?? [song]
    const index = newQueue.findIndex((s) => s.id === song.id)
    set({
      currentSong: song,
      queue: newQueue,
      queueIndex: index >= 0 ? index : 0,
      isPlaying: true,
      seek: 0,
      duration: song.duration ?? 0,
      isShuffled: false,
      originalQueue: [],
      queuePlaylistId: playlistId ?? null,
    })
  },

  togglePlay: () => {
    const { currentSong, isPlaying } = get()
    if (!currentSong) return
    set({ isPlaying: !isPlaying })
  },

  next: () => {
    const { queue, queueIndex, repeatMode } = get()
    // repeat-one is handled by useAudioPlayer onend — pressing Next still advances
    if (queueIndex < queue.length - 1) {
      const nextSong = queue[queueIndex + 1]
      set({
        currentSong: nextSong,
        queueIndex: queueIndex + 1,
        isPlaying: true,
        seek: 0,
        duration: nextSong.duration ?? 0,
      })
    } else if (repeatMode === "all") {
      const firstSong = queue[0]
      set({
        currentSong: firstSong,
        queueIndex: 0,
        isPlaying: true,
        seek: 0,
        duration: firstSong.duration ?? 0,
      })
    } else {
      // end of queue, no repeat — stop but keep currentSong visible
      set({ isPlaying: false })
    }
  },

  previous: () => {
    const { queue, queueIndex, seek } = get()
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
    } else {
      // at queue start with seek <= 3s — restart current song
      set({ seek: 0 })
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
    isShuffled: false,
    originalQueue: [],
    queuePlaylistId: null,
  }),

  setIsBuffering: (v) => set({ isBuffering: v }),

  cycleRepeat: () => {
    const { repeatMode } = get()
    const nextMode: Record<string, "none" | "all" | "one"> = {
      none: "all",
      all: "one",
      one: "none",
    }
    set({ repeatMode: nextMode[repeatMode] })
  },

  toggleShuffle: () => {
    const { isShuffled, queue, currentSong, originalQueue } = get()
    if (queue.length === 0) return
    if (!isShuffled) {
      const shuffled = shuffleArray(queue)
      const newIndex = shuffled.findIndex((s) => s.id === currentSong?.id)
      set({
        isShuffled: true,
        originalQueue: queue,
        queue: shuffled,
        queueIndex: newIndex >= 0 ? newIndex : 0,
      })
    } else {
      const restored = originalQueue
      const newIndex = restored.findIndex((s) => s.id === currentSong?.id)
      set({
        isShuffled: false,
        queue: restored,
        queueIndex: newIndex >= 0 ? newIndex : 0,
        originalQueue: [],
      })
    }
  },
}))