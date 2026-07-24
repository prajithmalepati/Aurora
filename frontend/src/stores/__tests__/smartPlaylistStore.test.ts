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
function makeDef(id: number, name: string, overrides?: Partial<{
  color: string | null
  emoji: string | null
  query: string
}>) {
  return {
    id,
    name,
    color: overrides?.color ?? null,
    emoji: overrides?.emoji ?? null,
    image_url: null,
    query: overrides?.query ?? `tag:"${name}"`,
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

  // ── createSmartPlaylist ──────────────────────────────────────────

  it("createSmartPlaylist posts exact full payload and reconciles returned definition", async () => {
    const created = makeDef(5, "New Mix", { color: "#5eead4", emoji: "🎸", query: 'tag:"rock" AND tag:"live"' })
    vi.mocked(api.post).mockResolvedValue({ data: created, message: "created" })

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    const result = await useSmartPlaylistStore.getState().createSmartPlaylist({
      name: "New Mix",
      color: "#5eead4",
      emoji: "🎸",
      query: 'tag:"rock" AND tag:"live"',
    })

    expect(api.post).toHaveBeenCalledWith("/smart-playlists", {
      name: "New Mix",
      color: "#5eead4",
      emoji: "🎸",
      query: 'tag:"rock" AND tag:"live"',
    })
    expect(result).toEqual(created)
    expect(useSmartPlaylistStore.getState().smartPlaylists).toContainEqual(created)
    expect(useSmartPlaylistStore.getState().error).toBeNull()
    expect(useSmartPlaylistStore.getState().editingSmartPlaylist).toBeNull()
  })

  it("createSmartPlaylist without optional fields sends only name + query", async () => {
    const created = makeDef(6, "Minimal", { query: 'tag:"chill"' })
    vi.mocked(api.post).mockResolvedValue({ data: created, message: "created" })

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().createSmartPlaylist({
      name: "Minimal",
      query: 'tag:"chill"',
    })

    expect(api.post).toHaveBeenCalledWith("/smart-playlists", {
      name: "Minimal",
      query: 'tag:"chill"',
    })
  })

  it("createSmartPlaylist rejects and preserves list on API error", async () => {
    const existing = [makeDef(1, "Existing")]
    vi.mocked(api.get).mockResolvedValue({ data: existing, message: "ok" })
    vi.mocked(api.post).mockRejectedValue(new Error("Name cannot be empty"))

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()

    await expect(
      useSmartPlaylistStore.getState().createSmartPlaylist({ name: "", query: 'tag:"x"' })
    ).rejects.toThrow("Name cannot be empty")

    const state = useSmartPlaylistStore.getState()
    expect(state.smartPlaylists).toEqual(existing)
    expect(state.error).toBe("Name cannot be empty")
  })

  // ── updateSmartPlaylist ──────────────────────────────────────────

  it("updateSmartPlaylist sends only the requested patch and reconciles returned definition", async () => {
    const original = makeDef(1, "Old Name", { color: "#aaa", query: 'tag:"rock"' })
    const updated = { ...original, name: "New Name", updated_at: "2026-07-23T00:00:00Z" }
    vi.mocked(api.get).mockResolvedValue({ data: [original], message: "ok" })
    vi.mocked(api.put).mockResolvedValue({ data: updated, message: "updated" })

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()

    const result = await useSmartPlaylistStore.getState().updateSmartPlaylist(1, { name: "New Name" })

    expect(api.put).toHaveBeenCalledWith("/smart-playlists/1", { name: "New Name" })
    expect(result).toEqual(updated)
    expect(useSmartPlaylistStore.getState().smartPlaylists[0].name).toBe("New Name")
    // Unchanged fields preserved
    expect(useSmartPlaylistStore.getState().smartPlaylists[0].color).toBe("#aaa")
    expect(useSmartPlaylistStore.getState().smartPlaylists[0].query).toBe('tag:"rock"')
  })

  it("updateSmartPlaylist clears editingSmartPlaylist when editing same ID", async () => {
    const original = makeDef(1, "Editing")
    const updated = { ...original, name: "Renamed" }
    vi.mocked(api.get).mockResolvedValue({ data: [original], message: "ok" })
    vi.mocked(api.put).mockResolvedValue({ data: updated, message: "updated" })

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()
    useSmartPlaylistStore.getState().beginEditing(original)
    expect(useSmartPlaylistStore.getState().editingSmartPlaylist).toEqual(original)

    await useSmartPlaylistStore.getState().updateSmartPlaylist(1, { name: "Renamed" })
    expect(useSmartPlaylistStore.getState().editingSmartPlaylist).toBeNull()
  })

  it("updateSmartPlaylist rejects and preserves list on API error", async () => {
    const original = makeDef(1, "Original")
    vi.mocked(api.get).mockResolvedValue({ data: [original], message: "ok" })
    vi.mocked(api.put).mockRejectedValue(new Error("Invalid query"))

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()
    useSmartPlaylistStore.getState().beginEditing(original)

    await expect(
      useSmartPlaylistStore.getState().updateSmartPlaylist(1, { query: "garbage" })
    ).rejects.toThrow("Invalid query")

    const state = useSmartPlaylistStore.getState()
    expect(state.smartPlaylists).toEqual([original])
    expect(state.error).toBe("Invalid query")
    // Editing state preserved on failure
    expect(state.editingSmartPlaylist).toEqual(original)
  })

  // ── deleteSmartPlaylist ──────────────────────────────────────────

  it("deleteSmartPlaylist calls only DELETE /smart-playlists/{id} and removes entry", async () => {
    const defs = [makeDef(1, "Keep"), makeDef(2, "Delete Me")]
    vi.mocked(api.get).mockResolvedValue({ data: defs, message: "ok" })
    vi.mocked(api.delete).mockResolvedValue({ data: { deleted: true }, message: "deleted" })

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()

    await useSmartPlaylistStore.getState().deleteSmartPlaylist(2)

    expect(api.delete).toHaveBeenCalledWith("/smart-playlists/2")
    expect(api.delete).toHaveBeenCalledTimes(1)
    const state = useSmartPlaylistStore.getState()
    expect(state.smartPlaylists).toHaveLength(1)
    expect(state.smartPlaylists[0].id).toBe(1)
    expect(state.error).toBeNull()
  })

  it("deleteSmartPlaylist clears editingSmartPlaylist when deleting the edited entry", async () => {
    const defs = [makeDef(1, "Keep"), makeDef(2, "Delete")]
    vi.mocked(api.get).mockResolvedValue({ data: defs, message: "ok" })
    vi.mocked(api.delete).mockResolvedValue({ data: { deleted: true }, message: "deleted" })

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()
    useSmartPlaylistStore.getState().beginEditing(defs[1])
    expect(useSmartPlaylistStore.getState().editingSmartPlaylist).toEqual(defs[1])

    await useSmartPlaylistStore.getState().deleteSmartPlaylist(2)
    expect(useSmartPlaylistStore.getState().editingSmartPlaylist).toBeNull()
  })

  it("deleteSmartPlaylist preserves list and sets error on API failure", async () => {
    const defs = [makeDef(1, "A"), makeDef(2, "B")]
    vi.mocked(api.get).mockResolvedValue({ data: defs, message: "ok" })
    vi.mocked(api.delete).mockRejectedValue(new Error("Not found"))

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()

    await expect(
      useSmartPlaylistStore.getState().deleteSmartPlaylist(999)
    ).rejects.toThrow("Not found")

    const state = useSmartPlaylistStore.getState()
    expect(state.smartPlaylists).toEqual(defs)
    expect(state.error).toBe("Not found")
  })

  // ── editing state ────────────────────────────────────────────────

  it("beginEditing sets editingSmartPlaylist; cancelEditing clears it", async () => {
    const def = makeDef(1, "Edit Me")
    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")

    expect(useSmartPlaylistStore.getState().editingSmartPlaylist).toBeNull()

    useSmartPlaylistStore.getState().beginEditing(def)
    expect(useSmartPlaylistStore.getState().editingSmartPlaylist).toEqual(def)

    useSmartPlaylistStore.getState().cancelEditing()
    expect(useSmartPlaylistStore.getState().editingSmartPlaylist).toBeNull()
  })

  // ── listReady readiness signal ───────────────────────────────────

  it("initial listReady is idle before any fetch", async () => {
    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    expect(useSmartPlaylistStore.getState().listReady).toBe("idle")
  })

  it("successful fetch sets listReady to ready", async () => {
    const defs = [makeDef(1, "A")]
    vi.mocked(api.get).mockResolvedValue({ data: defs, message: "ok" })

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()

    expect(useSmartPlaylistStore.getState().listReady).toBe("ready")
  })

  it("rejected fetch sets listReady to error", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("down"))

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()

    expect(useSmartPlaylistStore.getState().listReady).toBe("error")
  })

  it("listReady remains ready after successful mutation (create)", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [makeDef(1, "A")], message: "ok" })
    vi.mocked(api.post).mockResolvedValue({ data: makeDef(2, "B"), message: "ok" })

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()
    expect(useSmartPlaylistStore.getState().listReady).toBe("ready")

    await useSmartPlaylistStore.getState().createSmartPlaylist({ name: "B", query: 'tag:"B"' })
    expect(useSmartPlaylistStore.getState().listReady).toBe("ready")
  })

  // ── replacement semantics ────────────────────────────────────────

  it("consecutive mutations replace rather than append stale definitions", async () => {
    const defs = [makeDef(1, "A"), makeDef(2, "B")]
    vi.mocked(api.get).mockResolvedValue({ data: defs, message: "ok" })

    const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
    await useSmartPlaylistStore.getState().fetchSmartPlaylists()
    expect(useSmartPlaylistStore.getState().smartPlaylists).toHaveLength(2)

    // Create adds one
    const created = makeDef(3, "C")
    vi.mocked(api.post).mockResolvedValue({ data: created, message: "created" })
    await useSmartPlaylistStore.getState().createSmartPlaylist({ name: "C", query: 'tag:"C"' })
    expect(useSmartPlaylistStore.getState().smartPlaylists).toHaveLength(3)

    // Delete removes one
    vi.mocked(api.delete).mockResolvedValue({ data: { deleted: true }, message: "deleted" })
    await useSmartPlaylistStore.getState().deleteSmartPlaylist(1)
    expect(useSmartPlaylistStore.getState().smartPlaylists).toHaveLength(2)
    expect(useSmartPlaylistStore.getState().smartPlaylists.map(p => p.id)).toEqual([2, 3])
  })
})
