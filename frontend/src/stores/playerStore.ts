import { create } from "zustand"
import type { Song } from "@/types"

const MAX_HISTORY = 100

interface PlayerState {
  currentSong: Song | null
  queue: Song[]
  queueIndex: number
  queueHistory: Song[]
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
  isCrossfading: boolean
  crossfadeFromTitle: string | null
  setIsBuffering: (v: boolean) => void
  setCrossfading: (crossfading: boolean, fromTitle?: string) => void

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
  playNext: (song: Song) => void
  addToQueue: (song: Song) => void
  reorderQueue: (fromIndex: number, toIndex: number) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
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
  queueHistory: [],
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
  isCrossfading: false,
  crossfadeFromTitle: null,

  playSong: (song, queue, playlistId = null) => {
    if (!song.file_path) return
    const newQueue = queue?.filter((s) => s.file_path) ?? [song]
    const index = newQueue.findIndex((s) => s.id === song.id)
    const prev = get().currentSong
    const prevHistory = get().queueHistory
    const history = prev && prev.id !== song.id
      ? [...prevHistory, prev].slice(-MAX_HISTORY)
      : prevHistory
    set({
      currentSong: song,
      queue: newQueue,
      queueIndex: index >= 0 ? index : 0,
      queueHistory: history,
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
    const { queue, queueIndex, repeatMode, currentSong, queueHistory } = get()
    // repeat-one is handled by useAudioPlayer onend — pressing Next still advances
    if (queueIndex < queue.length - 1) {
      const nextSong = queue[queueIndex + 1]
      const history = currentSong
        ? [...queueHistory, currentSong].slice(-MAX_HISTORY)
        : queueHistory
      set({
        currentSong: nextSong,
        queueIndex: queueIndex + 1,
        queueHistory: history,
        isPlaying: true,
        seek: 0,
        duration: nextSong.duration ?? 0,
      })
    } else if (repeatMode === "all") {
      const firstSong = queue[0]
      const history = currentSong
        ? [...queueHistory, currentSong].slice(-MAX_HISTORY)
        : queueHistory
      set({
        currentSong: firstSong,
        queueIndex: 0,
        queueHistory: history,
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
    const { queue, queueIndex, seek, queueHistory } = get()
    if (seek > 3) {
      set({ seek: 0 })
      return
    }
    // Try history first — pop the last played song
    if (queueHistory.length > 0) {
      const historySong = queueHistory[queueHistory.length - 1]
      const idx = queue.findIndex((s) => s.id === historySong.id)
      set({
        currentSong: historySong,
        queueIndex: idx >= 0 ? idx : queueIndex,
        queueHistory: queueHistory.slice(0, -1),
        isPlaying: true,
        seek: 0,
        duration: historySong.duration ?? 0,
      })
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
    queueHistory: [],
    isShuffled: false,
    originalQueue: [],
    queuePlaylistId: null,
  }),

  setIsBuffering: (v) => set({ isBuffering: v }),

  setCrossfading: (crossfading, fromTitle) => set({
    isCrossfading: crossfading,
    crossfadeFromTitle: crossfading ? (fromTitle ?? null) : null,
  }),

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

  playNext: (song) => {
    if (!song.file_path) return
    const { queue, queueIndex, isShuffled, originalQueue } = get()
    // Insert after current song
    const newQueue = [...queue]
    newQueue.splice(queueIndex + 1, 0, song)
    // If shuffled, also update originalQueue so toggling off preserves the insert
    if (isShuffled && originalQueue.length > 0) {
      const newOrig = [...originalQueue]
      newOrig.splice(queueIndex + 1, 0, song)
      set({ queue: newQueue, originalQueue: newOrig })
    } else {
      set({ queue: newQueue })
    }
  },

  addToQueue: (song) => {
    if (!song.file_path) return
    const { isShuffled, originalQueue } = get()
    set({ queue: [...get().queue, song] })
    if (isShuffled && originalQueue.length > 0) {
      set({ originalQueue: [...originalQueue, song] })
    }
  },

  reorderQueue: (fromIndex, toIndex) => {
    const { queue, queueIndex } = get()
    if (fromIndex < 0 || fromIndex >= queue.length) return
    if (toIndex < 0 || toIndex >= queue.length) return
    if (fromIndex === toIndex) return
    const newQueue = [...queue]
    const [moved] = newQueue.splice(fromIndex, 1)
    newQueue.splice(toIndex, 0, moved)
    // Adjust queueIndex if the current song was moved
    let newIndex = queueIndex
    if (fromIndex === queueIndex) {
      newIndex = toIndex
    } else if (fromIndex < queueIndex && toIndex >= queueIndex) {
      newIndex = queueIndex - 1
    } else if (fromIndex > queueIndex && toIndex <= queueIndex) {
      newIndex = queueIndex + 1
    }
    set({ queue: newQueue, queueIndex: newIndex })
  },

  removeFromQueue: (index) => {
    const { queue, queueIndex, currentSong, isShuffled, originalQueue } = get()
    if (index < 0 || index >= queue.length) return
    if (index === queueIndex && currentSong) {
      // Removing current song — advance to next or stop
      const newQueue = queue.filter((_, i) => i !== index)
      if (newQueue.length === 0) {
        get().stop()
        return
      }
      const newIndex = Math.min(index, newQueue.length - 1)
      const nextSong = newQueue[newIndex]
      const newOrig = isShuffled ? originalQueue.filter(s => s.id !== currentSong.id) : []
      set({
        queue: newQueue,
        queueIndex: newIndex,
        currentSong: nextSong,
        isPlaying: true,
        seek: 0,
        duration: nextSong.duration ?? 0,
        originalQueue: newOrig,
      })
    } else {
      const newQueue = queue.filter((_, i) => i !== index)
      const newIndex = index < queueIndex ? queueIndex - 1 : queueIndex
      const removed = queue[index]
      const newOrig = isShuffled ? originalQueue.filter(s => s.id !== removed.id) : originalQueue
      set({ queue: newQueue, queueIndex: newIndex, originalQueue: newOrig })
    }
  },

  clearQueue: () => {
    const current = get().currentSong
    if (current) {
      set({ queue: [current], queueIndex: 0 })
    } else {
      get().stop()
    }
  },
}))