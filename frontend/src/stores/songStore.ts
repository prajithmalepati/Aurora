import { create } from "zustand"
import { api } from "@/lib/api"
import type { Song, ApiResponse, Tag } from "@/types"
import { useTagStore } from "@/stores/tagStore"
import { useFilterStore } from "@/stores/filterStore"
import { usePlayerStore } from "@/stores/playerStore"
import { toast } from "@/lib/toast"

type View =
  | { kind: "all-songs" }
  | { kind: "filter" }
  | { kind: "playlist"; playlistId: number }
  | { kind: "albums" }
  | { kind: "folders" }
  | { kind: "settings" }
  | { kind: "about" }

type SortField = "title" | "artist" | "album" | "duration" | "created_at"

interface SongState {
  songs: Song[]
  loading: boolean
  error: string | null
  view: View
  sortField: SortField
  sortOrder: "asc" | "desc"

  fetchSongs: (search?: string) => Promise<void>
  sortSongs: (field: SortField, order: "asc" | "desc") => Promise<void>
  createSong: (data: {
    title: string
    artist: string
    album?: string
    duration?: number
    file_path?: string
  }) => Promise<void>
  updateSong: (id: number, data: {
    title?: string
    artist?: string
    album?: string
    duration?: number
  }) => Promise<void>
  deleteSong: (id: number) => Promise<void>
  assignTags: (songId: number, tagNames: string[], options?: { skipRefetch?: boolean }) => Promise<void>
  removeTag: (songId: number, tagId: number) => Promise<void>
  removeTagByName: (songId: number, tagName: string) => Promise<void>
  setView: (view: View) => void
}

let fetchId = 0

export const useSongStore = create<SongState>((set, get) => ({
  songs: [],
  loading: false,
  error: null,
  view: { kind: "filter" },
  sortField: "title",
  sortOrder: "asc",

  fetchSongs: async (search) => {
    const myId = ++fetchId
    set({ loading: true, error: null })
    try {
      const { sortField, sortOrder } = get()
      const params = new URLSearchParams({ limit: "500" })
      if (search) params.set("search", search)
      params.set("sort", sortField)
      params.set("order", sortOrder)
      const res = await api.get<ApiResponse<Song[]>>(`/songs?${params.toString()}`)
      if (myId !== fetchId) return // stale response, discard
      set({ songs: res.data, loading: false })
    } catch (e: any) {
      if (myId !== fetchId) return
      set({ error: e.message, loading: false })
    }
  },

  sortSongs: async (field, order) => {
    set({ sortField: field, sortOrder: order })
    await get().fetchSongs()
  },

  createSong: async (data) => {
    try {
      await api.post("/songs", data)
      await get().fetchSongs()
      toast.success("Song added")
    } catch (e: any) {
      set({ error: e.message })
      toast.error(e.message ?? "Failed to add song")
      throw e  // re-throw so the dialog can show the error
    }
  },

  updateSong: async (id, data) => {
    try {
      await api.put(`/songs/${id}`, data)
      await get().fetchSongs()
      toast.success("Song updated")
    } catch (e: any) {
      set({ error: e.message })
      toast.error(e.message ?? "Failed to update song")
      throw e
    }
  },

  deleteSong: async (id) => {
    try {
      await api.delete(`/songs/${id}`)
      const playerState = usePlayerStore.getState()
      if (playerState.currentSong?.id === id) {
        const queueIdx = playerState.queue.findIndex(s => s.id === id)
        if (queueIdx !== -1) {
          playerState.removeFromQueue(queueIdx)
        } else {
          playerState.stop()
        }
      }
      await get().fetchSongs()
      toast.success("Song deleted")
    } catch (e: any) {
      set({ error: e.message })
      toast.error(e.message ?? "Failed to delete song")
      throw e
    }
  },

  assignTags: async (songId, tagNames, options?: { skipRefetch?: boolean }) => {
    try {
      await api.post(`/songs/${songId}/tags`, { tag_names: tagNames })
      if (!options?.skipRefetch) {
        await get().fetchSongs()
        const filterState = useFilterStore.getState()
        if (filterState.query.trim()) await filterState.executeFilter()
      }
    } catch (e: any) {
      set({ error: e.message })
      toast.error(e.message ?? "Failed to update tags")
      throw e
    }
  },

  removeTag: async (songId, tagId) => {
    try {
      await api.delete(`/songs/${songId}/tags/${tagId}`)
      await get().fetchSongs()
      const filterState = useFilterStore.getState()
      if (filterState.query.trim()) await filterState.executeFilter()
    } catch (e: any) {
      set({ error: e.message })
      toast.error(e.message ?? "Failed to remove tag")
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
    const tagStore = useTagStore.getState()
    await tagStore.fetchTags()
    const tagStoreTags: Tag[] = tagStore.tags
    const matchingTag = tagStoreTags.find((t) => t.name === tagName)
    if (!matchingTag) {
      throw new Error("Tag not found")
    }
    try {
      await api.delete(`/songs/${songId}/tags/${matchingTag.id}`)
      await get().fetchSongs()
      const filterState = useFilterStore.getState()
      if (filterState.query.trim()) await filterState.executeFilter()
      toast.success("Tag removed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove tag")
      throw e
    }
  },

  setView: (view) => {
    set({ view })
  },
}))
