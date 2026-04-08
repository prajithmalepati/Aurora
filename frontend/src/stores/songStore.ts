import { create } from "zustand"
import { api } from "@/lib/api"
import type { Song, ApiResponse } from "@/types"

interface SongState {
  songs: Song[]
  loading: boolean
  error: string | null

  fetchSongs: (search?: string) => Promise<void>
  createSong: (data: {
    title: string
    artist: string
    album?: string
    duration?: number
  }) => Promise<void>
  updateSong: (id: number, data: {
    title?: string
    artist?: string
    album?: string
    duration?: number
  }) => Promise<void>
  deleteSong: (id: number) => Promise<void>
  assignTags: (songId: number, tagNames: string[]) => Promise<void>
  removeTag: (songId: number, tagId: number) => Promise<void>
}

export const useSongStore = create<SongState>((set, get) => ({
  songs: [],
  loading: false,
  error: null,

  fetchSongs: async (search) => {
    set({ loading: true, error: null })
    try {
      const params = search ? `?search=${encodeURIComponent(search)}&limit=500` : "?limit=500"
      const res = await api.get<ApiResponse<Song[]>>(`/songs${params}`)
      set({ songs: res.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createSong: async (data) => {
    try {
      await api.post("/songs", data)
      await get().fetchSongs()
    } catch (e: any) {
      set({ error: e.message })
      throw e  // re-throw so the dialog can show the error
    }
  },

  updateSong: async (id, data) => {
    try {
      await api.put(`/songs/${id}`, data)
      await get().fetchSongs()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  deleteSong: async (id) => {
    try {
      await api.delete(`/songs/${id}`)
      await get().fetchSongs()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  assignTags: async (songId, tagNames) => {
    try {
      await api.post(`/songs/${songId}/tags`, { tag_names: tagNames })
      await get().fetchSongs()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },

  removeTag: async (songId, tagId) => {
    try {
      await api.delete(`/songs/${songId}/tags/${tagId}`)
      await get().fetchSongs()
    } catch (e: any) {
      set({ error: e.message })
      throw e
    }
  },
}))