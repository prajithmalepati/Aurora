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

import { api } from "@/lib/api"

/** Build a mock SmartPlaylistDefinition. */
function makeDef(id: number, name: string) {
  return {
    id,
    name,
    color: null,
    emoji: null,
    image_url: null,
    query: `tag:"${name}"`,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }
}

describe("smartPlaylistStore", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("fetchSmartPlaylists stores returned definitions and clears loading/error", async () => {
    const defs = [makeDef(1, "Favorites"), makeDef(2, "Chill")]
    vi.mocked(api.get).mockResolvedValue({
      data: defs,
      message: "ok",
    })

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()

    const state = useSmartPlaylistStore.getState()
    expect(state.smartPlaylists).toEqual(defs)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(api.get).toHaveBeenCalledWith("/smart-playlists")
  })

  it("rejected request clears loading and records error while preserving empty list", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network down"))

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()

    const state = useSmartPlaylistStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe("Network down")
    expect(state.smartPlaylists).toEqual([])
  })

  it("subsequent successful fetch replaces prior list and clears old error", async () => {
    const first = [makeDef(1, "A")]
    const second = [makeDef(2, "B"), makeDef(3, "C")]

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")

    // First fetch succeeds
    vi.mocked(api.get).mockResolvedValueOnce({ data: first, message: "ok" })
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()
    expect(useSmartPlaylistStore.getState().smartPlaylists).toEqual(first)

    // Second fetch replaces
    vi.mocked(api.get).mockResolvedValueOnce({ data: second, message: "ok" })
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()
    const state = useSmartPlaylistStore.getState()
    expect(state.smartPlaylists).toEqual(second)
    expect(state.smartPlaylists).toHaveLength(2)
    expect(state.error).toBeNull()
  })
})
