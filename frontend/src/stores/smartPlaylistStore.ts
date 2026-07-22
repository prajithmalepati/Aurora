import { create } from "zustand"
import { api } from "@/lib/api"
import type { SmartPlaylistDefinition, ApiResponse } from "@/types"

interface SmartPlaylistState {
  smartPlaylists: SmartPlaylistDefinition[]
  loading: boolean
  error: string | null
  fetchSmartPlaylists: () => Promise<void>
}

export const useSmartPlaylistStore = create<SmartPlaylistState>((set) => ({
  smartPlaylists: [],
  loading: false,
  error: null,

  fetchSmartPlaylists: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.get<ApiResponse<SmartPlaylistDefinition[]>>("/smart-playlists")
      set({ smartPlaylists: res.data, loading: false, error: null })
    } catch (e: any) {
      set({ smartPlaylists: [], loading: false, error: e.message })
    }
  },
}))
