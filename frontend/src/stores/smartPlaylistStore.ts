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

export const useSmartPlaylistStore = create<SmartPlaylistState>((set) => ({
  smartPlaylists: [],
  loading: false,
  error: null,
  listReady: "idle",
  editingSmartPlaylist: null,

  fetchSmartPlaylists: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.get<ApiResponse<SmartPlaylistDefinition[]>>("/smart-playlists")
      set({ smartPlaylists: res.data, loading: false, error: null, listReady: "ready" })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to fetch smart playlists"
      set({ smartPlaylists: [], loading: false, error: message, listReady: "error" })
    }
  },

  createSmartPlaylist: async (input) => {
    set({ error: null })
    try {
      const res = await api.post<ApiResponse<SmartPlaylistDefinition>>("/smart-playlists", input)
      const created = res.data
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
