import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the api module before importing the store
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  BASE_URL: "http://localhost:8000/api",
  getAuroraToken: () => undefined,
  getBaseUrl: () => "http://localhost:8000",
}))

// Mock dependencies that the store imports
vi.mock("@/stores/tagStore", () => ({
  useTagStore: { getState: () => ({ tags: [], fetchTags: vi.fn() }) },
}))
vi.mock("@/stores/filterStore", () => ({
  useFilterStore: { getState: () => ({ query: "", executeFilter: vi.fn() }) },
}))
vi.mock("@/stores/playerStore", () => ({
  usePlayerStore: {
    getState: () => ({
      currentSong: null,
      queue: [],
      isPlaying: false,
      stop: vi.fn(),
      removeFromQueue: vi.fn(),
      playSong: vi.fn(),
      addToQueue: vi.fn(),
    }),
  },
}))
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { api } from "@/lib/api"

/** Create a minimal song stub for testing. */
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

/** Build a paginated API response for the songs endpoint. */
function buildPageResponse(allSongs: ReturnType<typeof makeSong>[], offset: number, limit: number) {
  const data = allSongs.slice(offset, offset + limit)
  return {
    data,
    message: "ok",
    meta: { total: allSongs.length },
  }
}

describe("songStore pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the module so the store re-initializes with fresh state
    vi.resetModules()
  })

  it("loads all352 songs across 4 pages without getting stuck at 300", async () => {
    const TOTAL_SONGS = 352
    const PAGE_SIZE = 100
    const allSongs = Array.from({ length: TOTAL_SONGS }, (_, i) => makeSong(i + 1))

    // Mock api.get to return paginated results
    let callCount = 0
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      callCount++
      const params = new URLSearchParams(url.split("?")[1])
      const offset = parseInt(params.get("offset") ?? "0", 10)
      const limit = parseInt(params.get("limit") ?? "50", 10)
      return buildPageResponse(allSongs, offset, limit)
    })

    // Import the store fresh (after mocks are set up)
    const { useSongStore } = await import("@/stores/songStore")

    // Step 1: Initial fetch (page 1, 100 songs)
    await useSongStore.getState().fetchSongs()
    let state = useSongStore.getState()
    expect(state.songs.length).toBe(PAGE_SIZE)
    expect(state.totalCount).toBe(TOTAL_SONGS)
    expect(state.hasMore).toBe(true)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()

    // Step 2: fetchMore (page 2, 200 total)
    await useSongStore.getState().fetchMore()
    state = useSongStore.getState()
    expect(state.songs.length).toBe(200)
    expect(state.hasMore).toBe(true)

    // Step 3: fetchMore (page 3, 300 total) — the "stuck" point
    await useSongStore.getState().fetchMore()
    state = useSongStore.getState()
    expect(state.songs.length).toBe(300)
    expect(state.hasMore).toBe(true) // 300 + 100 = 400 > 352, but 300 < 352

    // Step 4: fetchMore (page 4, 352 total) — this is the one that should NOT get stuck
    await useSongStore.getState().fetchMore()
    state = useSongStore.getState()
    expect(state.songs.length).toBe(TOTAL_SONGS)
    expect(state.hasMore).toBe(false)
    expect(state.totalCount).toBe(TOTAL_SONGS)

    // All songs loaded in order
    expect(state.songs[0].id).toBe(1)
    expect(state.songs[TOTAL_SONGS - 1].id).toBe(TOTAL_SONGS)

    // Exactly 4 API calls were made
    expect(callCount).toBe(4)
  })

  it("fetchMore returns early when loading is true (no double-fetch)", async () => {
    const allSongs = Array.from({ length: 200 }, (_, i) => makeSong(i + 1))

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      const params = new URLSearchParams(url.split("?")[1])
      const offset = parseInt(params.get("offset") ?? "0", 10)
      const limit = parseInt(params.get("limit") ?? "50", 10)
      // Add a small delay to simulate network latency
      await new Promise((r) => setTimeout(r, 10))
      return buildPageResponse(allSongs, offset, limit)
    })

    const { useSongStore } = await import("@/stores/songStore")

    // Initial fetch
    await useSongStore.getState().fetchSongs()
    expect(useSongStore.getState().songs.length).toBe(100)

    // Fire two fetchMore calls concurrently
    const p1 = useSongStore.getState().fetchMore()
    const p2 = useSongStore.getState().fetchMore()
    await Promise.all([p1, p2])

    // Second call should have been a no-op (loading was true)
    // So we should have exactly 200 songs (not 300 from double-fetch)
    const state = useSongStore.getState()
    expect(state.songs.length).toBe(200)
  })

  it("fetchMore returns early when songs.length >= totalCount", async () => {
    const allSongs = Array.from({ length: 50 }, (_, i) => makeSong(i + 1))

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      const params = new URLSearchParams(url.split("?")[1])
      const offset = parseInt(params.get("offset") ?? "0", 10)
      const limit = parseInt(params.get("limit") ?? "50", 10)
      return buildPageResponse(allSongs, offset, limit)
    })

    const { useSongStore } = await import("@/stores/songStore")

    await useSongStore.getState().fetchSongs()
    const state = useSongStore.getState()
    expect(state.songs.length).toBe(50)
    expect(state.hasMore).toBe(false) // 100 > 50

    // fetchMore should be a no-op
    await useSongStore.getState().fetchMore()
    expect(useSongStore.getState().songs.length).toBe(50)
  })

  it("fetchMore guard: songs.length >= totalCount blocks fetch when already loaded all", async () => {
    // Exactly 200 songs (2 full pages)
    const allSongs = Array.from({ length: 200 }, (_, i) => makeSong(i + 1))
    let callCount = 0

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      callCount++
      const params = new URLSearchParams(url.split("?")[1])
      const offset = parseInt(params.get("offset") ?? "0", 10)
      const limit = parseInt(params.get("limit") ?? "50", 10)
      return buildPageResponse(allSongs, offset, limit)
    })

    const { useSongStore } = await import("@/stores/songStore")

    await useSongStore.getState().fetchSongs()
    expect(useSongStore.getState().songs.length).toBe(100)
    expect(useSongStore.getState().hasMore).toBe(true)

    await useSongStore.getState().fetchMore()
    expect(useSongStore.getState().songs.length).toBe(200)
    expect(useSongStore.getState().hasMore).toBe(false)

    callCount = 0 // Reset counter

    // Another fetchMore should be a no-op (200 >= 200)
    await useSongStore.getState().fetchMore()
    expect(callCount).toBe(0) // No API call made
    expect(useSongStore.getState().songs.length).toBe(200)
  })

  it("handles total count via meta.total correctly (not from response data length)", async () => {
    // total is 352 but each page returns fewer than PAGE_SIZE items
    // (simulates the last partial page scenario)
    const TOTAL = 250
    const allSongs = Array.from({ length: TOTAL }, (_, i) => makeSong(i + 1))

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      const params = new URLSearchParams(url.split("?")[1])
      const offset = parseInt(params.get("offset") ?? "0", 10)
      const limit = parseInt(params.get("limit") ?? "50", 10)
      return buildPageResponse(allSongs, offset, limit)
    })

    const { useSongStore } = await import("@/stores/songStore")

    await useSongStore.getState().fetchSongs()
    expect(useSongStore.getState().totalCount).toBe(TOTAL)
    expect(useSongStore.getState().hasMore).toBe(true) // 100 < 250

    await useSongStore.getState().fetchMore()
    expect(useSongStore.getState().songs.length).toBe(200)
    expect(useSongStore.getState().hasMore).toBe(true) // 200 < 250

    await useSongStore.getState().fetchMore()
    expect(useSongStore.getState().songs.length).toBe(TOTAL)
    expect(useSongStore.getState().hasMore).toBe(false) // 300 > 250
    expect(useSongStore.getState().totalCount).toBe(TOTAL)
  })

  it("stale fetchMore response is discarded when fetchId changes", async () => {
    const allSongs = Array.from({ length: 300 }, (_, i) => makeSong(i + 1))
    const pendingResolvers: Array<(v: unknown) => void> = []

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      const params = new URLSearchParams(url.split("?")[1])
      const offset = parseInt(params.get("offset") ?? "0", 10)
      const limit = parseInt(params.get("limit") ?? "50", 10)

      // First fetchMore call gets delayed
      if (offset === 100 && pendingResolvers.length === 0) {
        return new Promise((resolve) => {
          pendingResolvers.push(resolve)
        })
      }
      return buildPageResponse(allSongs, offset, limit)
    })

    const { useSongStore } = await import("@/stores/songStore")

    await useSongStore.getState().fetchSongs()
    expect(useSongStore.getState().songs.length).toBe(100)

    // Start a fetchMore that will be delayed
    const stalePromise = useSongStore.getState().fetchMore()

    // Trigger a fresh fetchSongs (e.g., user searched) which increments fetchId
    await useSongStore.getState().fetchSongs()

    // Now resolve the stale fetchMore
    if (pendingResolvers.length > 0) {
      pendingResolvers[0](buildPageResponse(allSongs, 100, 100))
    }
    await stalePromise

    // The stale fetchMore's response should have been discarded
    // fetchSongs reset the songs to the first 100 of the fresh fetch
    const state = useSongStore.getState()
    expect(state.songs.length).toBe(100)
    expect(state.songs[0].id).toBe(1) // Fresh fetch from offset 0
  })
})
