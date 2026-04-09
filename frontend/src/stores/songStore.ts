import { create } from "zustand"
import { api } from "@/lib/api"
import type { Song, ApiResponse, Tag } from "@/types"
import { useTagStore } from "./tagStore"

type View =
  | { kind: "all-songs" }
  | { kind: "filter" }
  | { kind: "playlist"; playlistId: number }

interface SongState {
  songs: Song[]
  loading: boolean
  error: string | null
  view: View

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
  removeTagByName: (songId: number, tagName: string) => Promise<void>
  setView: (view: View) => void
}

export const useSongStore = create<SongState>((set, get) => ({
  songs: [],
  loading: false,
  error: null,
  view: { kind: "all-songs" },

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

  removeTagByName: async (songId, tagName) => {
    const state = get()
    const song = state.songs.find((s) => s.id === songId)
    if (!song) {
      throw new Error("Song not found")
    }
    const tag = song.tags.find((t) => t === tagName)
    if (!tag) {
      throw new Error("Tag not found on song")
    }
    // We need to find the tag ID - this requires a separate API call
    // For now, we'll fetch all tags and find the matching one
    const tagStore = useTagStore.getState()
    await tagStore.fetchTags()
    const tagStoreTags: Tag[] = tagStore.tags
    const matchingTag = tagStoreTags.find((t) => t.name === tagName)
    if (!matchingTag) {
      throw new Error("Tag not found")
    }
    await api.delete(`/songs/${songId}/tags/${matchingTag.id}`)
    await get().fetchSongs()
  },

  setView: (view) => {
    set({ view })
  },
}))
