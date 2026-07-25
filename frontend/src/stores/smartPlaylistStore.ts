import { create } from "zustand"
import { api } from "@/lib/api"
import type { SmartPlaylistDefinition, ApiResponse } from "@/types"

interface CreateSmartPlaylistInput {
  name: string
  color?: string
  emoji?: string
  query: string
}

interface UpdateSmartPlaylistPatch {
  name?: string
  color?: string | null
  emoji?: string | null
  query?: string
}

/** idle = never fetched; ready = last fetch succeeded; error = last fetch failed */
export type ListReadyState = "idle" | "ready" | "error"

interface SmartPlaylistState {
  smartPlaylists: SmartPlaylistDefinition[]
  loading: boolean
  error: string | null
  listReady: ListReadyState
  editingSmartPlaylist: SmartPlaylistDefinition | null

  fetchSmartPlaylists: () => Promise<void>
  createSmartPlaylist: (input: CreateSmartPlaylistInput) => Promise<SmartPlaylistDefinition>
  updateSmartPlaylist: (id: number, patch: UpdateSmartPlaylistPatch) => Promise<SmartPlaylistDefinition>
  deleteSmartPlaylist: (id: number) => Promise<void>
  beginEditing: (definition: SmartPlaylistDefinition) => void
  cancelEditing: () => void
}

/**
 * Monotonic generation counter. Incremented at the start of every
 * `fetchSmartPlaylists()` call AND at the start of every successful
 * mutation (create/update/delete). When a fetch resolves it compares
 * its captured generation to the current value — a mismatch means a
 * mutation committed while the fetch was in flight, so the stale
 * response is silently discarded.
 */
let _fetchGeneration = 0

/** Expose for tests only. */
export function _getFetchGeneration(): number {
  return _fetchGeneration
}

export const useSmartPlaylistStore = create<SmartPlaylistState>((set) => ({
  smartPlaylists: [],
  loading: false,
  error: null,
  listReady: "idle",
  editingSmartPlaylist: null,

  fetchSmartPlaylists: async () => {
    const gen = ++_fetchGeneration
    set({ loading: true, error: null })
    try {
      const res = await api.get<ApiResponse<SmartPlaylistDefinition[]>>("/smart-playlists")
      // Discard stale success — a mutation committed after this fetch began
      if (gen !== _fetchGeneration) return
      set({ smartPlaylists: res.data, loading: false, error: null, listReady: "ready" })
    } catch (e: unknown) {
      // Discard stale failure — a mutation committed after this fetch began
      if (gen !== _fetchGeneration) return
      const message = e instanceof Error ? e.message : "Failed to fetch smart playlists"
      set({ smartPlaylists: [], loading: false, error: message, listReady: "error" })
    }
  },

  createSmartPlaylist: async (input) => {
    set({ error: null })
    try {
      const res = await api.post<ApiResponse<SmartPlaylistDefinition>>("/smart-playlists", input)
      const created = res.data
      ++_fetchGeneration
      set((state) => ({
        smartPlaylists: [...state.smartPlaylists, created],
        editingSmartPlaylist: null,
        error: null,
      }))
      return created
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to create smart playlist"
      set({ error: message })
      throw e
    }
  },

  updateSmartPlaylist: async (id, patch) => {
    set({ error: null })
    try {
      const res = await api.put<ApiResponse<SmartPlaylistDefinition>>(`/smart-playlists/${id}`, patch)
      const updated = res.data
      ++_fetchGeneration
      set((state) => ({
        smartPlaylists: state.smartPlaylists.map((sp) => (sp.id === id ? updated : sp)),
        editingSmartPlaylist: state.editingSmartPlaylist?.id === id ? null : state.editingSmartPlaylist,
        error: null,
      }))
      return updated
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to update smart playlist"
      set({ error: message })
      throw e
    }
  },

  deleteSmartPlaylist: async (id) => {
    set({ error: null })
    try {
      await api.delete<ApiResponse<{ deleted: true }>>(`/smart-playlists/${id}`)
      ++_fetchGeneration
      set((state) => ({
        smartPlaylists: state.smartPlaylists.filter((sp) => sp.id !== id),
        editingSmartPlaylist: state.editingSmartPlaylist?.id === id ? null : state.editingSmartPlaylist,
        error: null,
      }))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete smart playlist"
      set({ error: message })
      throw e
    }
  },

  beginEditing: (definition) => {
    set({ editingSmartPlaylist: definition })
  },

  cancelEditing: () => {
    set({ editingSmartPlaylist: null })
  },
}))
