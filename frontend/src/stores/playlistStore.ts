import { create } from "zustand"
import { api } from "@/lib/api"
import type { Playlist, PlaylistDetail, ApiResponse } from "@/types"

interface PlaylistState {
  playlists: Playlist[]
  activePlaylist: PlaylistDetail | null
  loading: boolean
  error: string | null

  fetchPlaylists: () => Promise<void>
  fetchPlaylistDetail: (id: number) => Promise<void>
  createPlaylist: (data: {
    name: string
    color?: string
    emoji?: string
  }) => Promise<void>
  updatePlaylist: (id: number, data: {
    name?: string
    color?: string
    emoji?: string
  }) => Promise<void>
  deletePlaylist: (id: number) => Promise<void>
  addSongToPlaylist: (playlistId: number, songId: number) => Promise<void>
  removeSongFromPlaylist: (playlistId: number, songId: number) => Promise<void>
  reorderSongs: (playlistId: number, songIds: number[]) => Promise<void>
  clearActivePlaylist: () => void
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  activePlaylist: null,
  loading: false,
  error: null,

  fetchPlaylists: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.get<ApiResponse<Playlist[]>>("/playlists")
      set({ playlists: res.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchPlaylistDetail: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await api.get<ApiResponse<PlaylistDetail>>(`/playlists/${id}`)
      set({ activePlaylist: res.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createPlaylist: async (data) => {
    try {
      await api.post("/playlists", data)
      await get().fetchPlaylists()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  updatePlaylist: async (id, data) => {
    try {
      await api.put(`/playlists/${id}`, data)
      await get().fetchPlaylists()
      // If this is the active playlist, refetch its detail too
      if (get().activePlaylist?.id === id) {
        await get().fetchPlaylistDetail(id)
      }
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  deletePlaylist: async (id) => {
    try {
      await api.delete(`/playlists/${id}`)
      // Clear active if we deleted the one being viewed
      if (get().activePlaylist?.id === id) {
        set({ activePlaylist: null })
      }
      await get().fetchPlaylists()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  addSongToPlaylist: async (playlistId, songId) => {
    try {
      await api.post(`/playlists/${playlistId}/songs`, { song_id: songId })
      await get().fetchPlaylists()  // update song_count
      if (get().activePlaylist?.id === playlistId) {
        await get().fetchPlaylistDetail(playlistId)
      }
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  removeSongFromPlaylist: async (playlistId, songId) => {
    try {
      await api.delete(`/playlists/${playlistId}/songs/${songId}`)
      await get().fetchPlaylists()
      if (get().activePlaylist?.id === playlistId) {
        await get().fetchPlaylistDetail(playlistId)
      }
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  reorderSongs: async (playlistId, songIds) => {
    try {
      await api.put(`/playlists/${playlistId}/songs/reorder`, { song_ids: songIds })
      if (get().activePlaylist?.id === playlistId) {
        await get().fetchPlaylistDetail(playlistId)
      }
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  clearActivePlaylist: () => set({ activePlaylist: null }),
}))