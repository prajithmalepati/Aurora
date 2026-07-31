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

/** Create a deferred promise the test controls manually. */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
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

  // ══════════════════════════════════════════════════════════════════
  // ── Stale-fetch race tests (deferred-Promise controlled) ─────────
  // ══════════════════════════════════════════════════════════════════

  describe("stale fetch vs mutation races", () => {
    it("stale fetch success after create: created item survives, stale list cannot mark ready", async () => {
      const created = makeDef(2, "New One")
      // Stale fetch returns only the pre-create list (missing the created item)
      const staleList = [makeDef(1, "Existing")]

      const fetchDeferred = deferred<{ data: typeof staleList; message: string }>()

      vi.mocked(api.get).mockReturnValueOnce(fetchDeferred.promise as ReturnType<typeof api.get>)
      vi.mocked(api.post).mockResolvedValue({ data: created, message: "created" })

      const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")

      // 1. Start initial fetch — promise is pending, store list still empty
      const fetchPromise = useSmartPlaylistStore.getState().fetchSmartPlaylists()

      // 2. Complete the create mutation while fetch is in flight
      await useSmartPlaylistStore.getState().createSmartPlaylist({ name: "New One", query: 'tag:"new"' })
      expect(useSmartPlaylistStore.getState().smartPlaylists).toContainEqual(created)
      expect(useSmartPlaylistStore.getState().smartPlaylists).toHaveLength(1)

      // 3. Now resolve the stale fetch (lacks the created item)
      fetchDeferred.resolve({ data: staleList, message: "ok" })
      await fetchPromise

      // Assert: created item is NOT clobbered by the stale response
      const state = useSmartPlaylistStore.getState()
      expect(state.smartPlaylists).toContainEqual(created)
      expect(state.smartPlaylists).toHaveLength(1)
      // Stale fetch cannot mark listReady to ready
      expect(state.listReady).toBe("idle")
    })

    it("stale fetch success after delete: deleted item not resurrected", async () => {
      const initial = [makeDef(1, "Keep"), makeDef(2, "Gone")]
      // Stale fetch still contains the deleted item
      const staleList = [makeDef(1, "Keep"), makeDef(2, "Gone")]

      const fetchDeferred = deferred<{ data: typeof staleList; message: string }>()

      // First fetch succeeds normally
      vi.mocked(api.get).mockResolvedValueOnce({ data: initial, message: "ok" })
      vi.mocked(api.delete).mockResolvedValue({ data: { deleted: true }, message: "deleted" })

      const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
      await useSmartPlaylistStore.getState().fetchSmartPlaylists()
      expect(useSmartPlaylistStore.getState().listReady).toBe("ready")

      // Start second fetch — deferred
      vi.mocked(api.get).mockReturnValueOnce(fetchDeferred.promise as ReturnType<typeof api.get>)
      const fetchPromise = useSmartPlaylistStore.getState().fetchSmartPlaylists()

      // Delete item 2 while fetch is in flight
      await useSmartPlaylistStore.getState().deleteSmartPlaylist(2)
      expect(useSmartPlaylistStore.getState().smartPlaylists).toHaveLength(1)
      expect(useSmartPlaylistStore.getState().smartPlaylists[0].id).toBe(1)

      // Resolve stale fetch (still has item 2)
      fetchDeferred.resolve({ data: staleList, message: "ok" })
      await fetchPromise

      // Assert: deleted item is NOT resurrected
      const state = useSmartPlaylistStore.getState()
      expect(state.smartPlaylists).toHaveLength(1)
      expect(state.smartPlaylists[0].id).toBe(1)
    })

    it("stale fetch failure after mutation: mutation state and readiness preserved", async () => {
      const initial = [makeDef(1, "A")]
      const created = makeDef(2, "B")

      const fetchDeferred = deferred<never>()

      // First fetch succeeds
      vi.mocked(api.get).mockResolvedValueOnce({ data: initial, message: "ok" })
      vi.mocked(api.post).mockResolvedValue({ data: created, message: "created" })

      const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
      await useSmartPlaylistStore.getState().fetchSmartPlaylists()
      expect(useSmartPlaylistStore.getState().listReady).toBe("ready")

      // Start second fetch — deferred
      vi.mocked(api.get).mockReturnValueOnce(fetchDeferred.promise as ReturnType<typeof api.get>)
      const fetchPromise = useSmartPlaylistStore.getState().fetchSmartPlaylists()

      // Create while fetch in flight
      await useSmartPlaylistStore.getState().createSmartPlaylist({ name: "B", query: 'tag:"B"' })
      expect(useSmartPlaylistStore.getState().smartPlaylists).toHaveLength(2)

      // Reject the stale fetch
      fetchDeferred.reject(new Error("Network timeout"))
      await fetchPromise

      // Assert: mutation result preserved, readiness unchanged
      const state = useSmartPlaylistStore.getState()
      expect(state.smartPlaylists).toHaveLength(2)
      expect(state.smartPlaylists).toContainEqual(created)
      expect(state.listReady).toBe("ready") // not clobbered to "error"
      expect(state.error).toBeNull()
    })

    it("non-stale successful fetch replaces list and marks ready", async () => {
      const defs = [makeDef(1, "Fresh"), makeDef(2, "Data")]

      vi.mocked(api.get).mockResolvedValue({ data: defs, message: "ok" })

      const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
      await useSmartPlaylistStore.getState().fetchSmartPlaylists()

      const state = useSmartPlaylistStore.getState()
      expect(state.smartPlaylists).toEqual(defs)
      expect(state.listReady).toBe("ready")
      expect(state.error).toBeNull()
    })

    it("non-stale fetch failure sets error state", async () => {
      vi.mocked(api.get).mockRejectedValue(new Error("Server down"))

      const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
      await useSmartPlaylistStore.getState().fetchSmartPlaylists()

      const state = useSmartPlaylistStore.getState()
      expect(state.listReady).toBe("error")
      expect(state.error).toBe("Server down")
      expect(state.smartPlaylists).toEqual([])
    })

    it("stale fetch success after update: updated definition not reverted", async () => {
      const original = makeDef(1, "Old Name", { query: 'tag:"rock"' })
      const renamed = makeDef(1, "New Name", { query: 'tag:"rock"' })
      const staleList = [makeDef(1, "Old Name", { query: 'tag:"rock"' })]

      const fetchDeferred = deferred<{ data: typeof staleList; message: string }>()

      // First fetch succeeds
      vi.mocked(api.get).mockResolvedValueOnce({ data: [original], message: "ok" })
      vi.mocked(api.put).mockResolvedValue({ data: renamed, message: "updated" })

      const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")
      await useSmartPlaylistStore.getState().fetchSmartPlaylists()

      // Start second fetch — deferred
      vi.mocked(api.get).mockReturnValueOnce(fetchDeferred.promise as ReturnType<typeof api.get>)
      const fetchPromise = useSmartPlaylistStore.getState().fetchSmartPlaylists()

      // Rename while fetch in flight
      await useSmartPlaylistStore.getState().updateSmartPlaylist(1, { name: "New Name" })
      expect(useSmartPlaylistStore.getState().smartPlaylists[0].name).toBe("New Name")

      // Resolve stale fetch (still has old name)
      fetchDeferred.resolve({ data: staleList, message: "ok" })
      await fetchPromise

      // Assert: rename NOT reverted
      const state = useSmartPlaylistStore.getState()
      expect(state.smartPlaylists[0].name).toBe("New Name")
    })

    it("mutation before initial fetch leaves listReady idle until non-stale fetch", async () => {
      const created = makeDef(1, "First")
      const serverList = [makeDef(1, "First")]

      const fetchDeferred = deferred<{ data: typeof serverList; message: string }>()

      vi.mocked(api.get).mockReturnValueOnce(fetchDeferred.promise as ReturnType<typeof api.get>)
      vi.mocked(api.post).mockResolvedValue({ data: created, message: "created" })

      const { useSmartPlaylistStore } = await import("@/stores/smartPlaylistStore")

      // Start initial fetch — deferred
      const fetchPromise = useSmartPlaylistStore.getState().fetchSmartPlaylists()
      expect(useSmartPlaylistStore.getState().listReady).toBe("idle")

      // Create while initial fetch in flight
      await useSmartPlaylistStore.getState().createSmartPlaylist({ name: "First", query: 'tag:"first"' })
      expect(useSmartPlaylistStore.getState().smartPlaylists).toContainEqual(created)

      // Resolve stale initial fetch
      fetchDeferred.resolve({ data: serverList, message: "ok" })
      await fetchPromise

      // listReady should remain idle — stale fetch cannot mark ready
      expect(useSmartPlaylistStore.getState().listReady).toBe("idle")
      // But the created item survives
      expect(useSmartPlaylistStore.getState().smartPlaylists).toContainEqual(created)

      // A fresh non-stale fetch should now mark ready
      vi.mocked(api.get).mockResolvedValueOnce({ data: serverList, message: "ok" })
      await useSmartPlaylistStore.getState().fetchSmartPlaylists()
      expect(useSmartPlaylistStore.getState().listReady).toBe("ready")
    })
  })
})
