import { describe, it, expect, vi, beforeEach } from "vitest"

// In-memory localStorage mock
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { for (const k in store) delete store[k] }),
  get length() { return Object.keys(store).length },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
}
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock })

function makeSong(id: number) {
  return {
    id,
    title: `Song ${id}`,
    artist: `Artist ${id}`,
    album: null,
    duration: 180,
    file_path: `/music/song${id}.mp3`,
    source: "local",
    tags: [],
    playlists: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }
}

describe("playerStore queue persistence", () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("playSong writes queue to localStorage", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1), makeSong(2), makeSong(3)]

    usePlayerStore.getState().playSong(songs[1], songs)

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "aurora-queue-v1",
      expect.any(String),
    )

    const saved = JSON.parse(store["aurora-queue-v1"])
    expect(saved.queueIds).toEqual([1, 2, 3])
    expect(saved.currentSongId).toBe(2)
    expect(saved.currentIndex).toBe(1)
    expect(saved.repeatMode).toBe("none")
    expect(saved.shuffle).toBe(false)
  })

  it("next() updates localStorage with new index", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1), makeSong(2), makeSong(3)]

    usePlayerStore.getState().playSong(songs[0], songs)
    usePlayerStore.getState().next()

    const saved = JSON.parse(store["aurora-queue-v1"])
    expect(saved.currentSongId).toBe(2)
    expect(saved.currentIndex).toBe(1)
  })

  it("restoreQueue maps IDs to songs and sets paused state", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1), makeSong(2), makeSong(3)]

    // Simulate a saved queue
    store["aurora-queue-v1"] = JSON.stringify({
      queueIds: [1, 2, 3],
      originalQueueIds: [],
      currentSongId: 2,
      currentIndex: 1,
      seek: 42,
      repeatMode: "all",
      shuffle: false,
      queuePlaylistId: null,
    })

    usePlayerStore.getState().restoreQueue(songs)
    const state = usePlayerStore.getState()

    expect(state.queue.map((s) => s.id)).toEqual([1, 2, 3])
    expect(state.currentSong?.id).toBe(2)
    expect(state.queueIndex).toBe(1)
    expect(state.isPlaying).toBe(false)
    expect(state.seek).toBe(42)
    expect(state.repeatMode).toBe("all")
    expect(state.isShuffled).toBe(false)
  })

  it("restoreQueue silently drops missing song IDs", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")

    // Songs 2 and 3 were deleted from library — only song 1 remains
    const songs = [makeSong(1)]

    store["aurora-queue-v1"] = JSON.stringify({
      queueIds: [1, 2, 3],
      originalQueueIds: [],
      currentSongId: 2, // deleted song
      currentIndex: 1,
      seek: 10,
      repeatMode: "none",
      shuffle: false,
      queuePlaylistId: null,
    })

    usePlayerStore.getState().restoreQueue(songs)
    const state = usePlayerStore.getState()

    // Only song 1 survives
    expect(state.queue.map((s) => s.id)).toEqual([1])
    // Current song was deleted — falls back to first available
    expect(state.currentSong?.id).toBe(1)
    expect(state.queueIndex).toBe(0)
    expect(state.isPlaying).toBe(false)
    // Seek not restored because current song changed
    expect(state.seek).toBe(0)
  })

  it("restoreQueue with missing originalQueueIds drops them silently", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1), makeSong(2)]

    store["aurora-queue-v1"] = JSON.stringify({
      queueIds: [1, 2],
      originalQueueIds: [1, 5, 2], // 5 is deleted
      currentSongId: 1,
      currentIndex: 0,
      seek: 0,
      repeatMode: "none",
      shuffle: true,
      queuePlaylistId: null,
    })

    usePlayerStore.getState().restoreQueue(songs)
    const state = usePlayerStore.getState()

    expect(state.queue.map((s) => s.id)).toEqual([1, 2])
    expect(state.originalQueue.map((s) => s.id)).toEqual([1, 2])
    expect(state.isShuffled).toBe(true)
  })

  it("restoreQueue clears localStorage when no saved data exists", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1)]

    // No aurora-queue-v1 key
    usePlayerStore.getState().restoreQueue(songs)
    const state = usePlayerStore.getState()

    expect(state.queue).toEqual([])
    expect(state.currentSong).toBeNull()
  })

  it("cycleRepeat updates localStorage", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1)]

    usePlayerStore.getState().playSong(songs[0], songs)
    usePlayerStore.getState().cycleRepeat()

    const saved = JSON.parse(store["aurora-queue-v1"])
    expect(saved.repeatMode).toBe("all")
  })

  it("toggleShuffle updates localStorage with originalQueueIds", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1), makeSong(2), makeSong(3)]

    usePlayerStore.getState().playSong(songs[0], songs)
    usePlayerStore.getState().toggleShuffle()

    const saved = JSON.parse(store["aurora-queue-v1"])
    expect(saved.shuffle).toBe(true)
    expect(saved.originalQueueIds).toEqual([1, 2, 3])
  })

  it("restoreQueue handles malformed localStorage shape without throwing", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1)]

    // Valid JSON but wrong shape — missing queueIds array
    store["aurora-queue-v1"] = JSON.stringify({ foo: "bar", queueIds: "not-an-array" })

    // Must not throw
    usePlayerStore.getState().restoreQueue(songs)
    const state = usePlayerStore.getState()

    // Queue should remain empty (malformed data rejected)
    expect(state.queue).toEqual([])
    expect(state.currentSong).toBeNull()
  })

  it("restoreQueue handles completely empty object without throwing", async () => {
    const { usePlayerStore } = await import("@/stores/playerStore")
    const songs = [makeSong(1)]

    store["aurora-queue-v1"] = JSON.stringify({})

    usePlayerStore.getState().restoreQueue(songs)
    const state = usePlayerStore.getState()

    expect(state.queue).toEqual([])
    expect(state.currentSong).toBeNull()
  })
})
