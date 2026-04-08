# Aurora — Frontend State Management
## Document 9 of 12 | 

---

## Overview

Aurora uses Zustand for all global state. Five stores, one per domain. No React Context for app state.

### Design Principles
- One store per domain: songs, playlists, tags, filter, player
- Each store holds: data, loading/error states, and action methods
- Actions call the API client, then update local state
- Components read state with selectors: `const songs = useSongStore(s => s.songs)` — this prevents unnecessary re-renders
- After mutating actions (create, update, delete), the store refetches the relevant data to stay in sync with the backend

### Import pattern
```typescript
import { create } from "zustand"
import { api } from "@/lib/api"
import type { Song, ApiResponse } from "@/types"
```

---

## songStore.ts

`src/stores/songStore.ts`

```typescript
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
```

**Note on `limit=500`:** The backend defaults to 50. For a personal library we want to load all songs. Bump the limit. If the library grows past 500, we'll add pagination later.

**Note on `throw e`:** Actions re-throw errors after setting store error state. This lets dialogs catch the error and show it inline instead of only relying on the store's error field.

---

## playlistStore.ts

`src/stores/playlistStore.ts`

```typescript
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
```

---

## tagStore.ts

`src/stores/tagStore.ts`

```typescript
import { create } from "zustand"
import { api } from "@/lib/api"
import type { Tag, ApiResponse } from "@/types"

interface TagState {
  tags: Tag[]
  loading: boolean

  fetchTags: () => Promise<void>
  deleteTag: (id: number) => Promise<void>
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  loading: false,

  fetchTags: async () => {
    set({ loading: true })
    try {
      const res = await api.get<ApiResponse<Tag[]>>("/tags")
      set({ tags: res.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  deleteTag: async (id) => {
    await api.delete(`/tags/${id}`)
    await get().fetchTags()
  },
}))
```

---

## filterStore.ts

`src/stores/filterStore.ts`

```typescript
import { create } from "zustand"
import { api } from "@/lib/api"
import type { FilterResult, ApiResponse } from "@/types"

interface FilterState {
  query: string
  results: FilterResult[]
  loading: boolean
  error: string | null

  setQuery: (query: string) => void
  appendToQuery: (text: string) => void
  executeFilter: () => Promise<void>
  clearResults: () => void
}

export const useFilterStore = create<FilterState>((set, get) => ({
  query: "",
  results: [],
  loading: false,
  error: null,

  setQuery: (query) => set({ query }),

  appendToQuery: (text) => {
    const current = get().query.trim()
    const separator = current.length > 0 ? " " : ""
    set({ query: current + separator + text })
  },

  executeFilter: async () => {
    const query = get().query.trim()
    if (!query) return

    set({ loading: true, error: null })
    try {
      const res = await api.post<ApiResponse<FilterResult[]>>("/filter", { query })
      set({ results: res.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false, results: [] })
    }
  },

  clearResults: () => set({ query: "", results: [], error: null }),
}))
```

**`appendToQuery`** is used by the click-to-build interface: clicking a tag chip calls `appendToQuery('"3am drive"')`, clicking AND calls `appendToQuery("AND")`. The text input uses `setQuery` for direct editing.

---

## playerStore.ts

`src/stores/playerStore.ts`

```typescript
import { create } from "zustand"
import type { Song } from "@/types"

interface PlayerState {
  currentSong: Song | null
  queue: Song[]
  queueIndex: number
  isPlaying: boolean
  volume: number          // 0 to 1
  seek: number            // current position in seconds
  duration: number        // total duration in seconds

  playSong: (song: Song, queue?: Song[]) => void
  togglePlay: () => void
  next: () => void
  previous: () => void
  setVolume: (v: number) => void
  setSeek: (s: number) => void
  setDuration: (d: number) => void
  updateSeek: (s: number) => void
  stop: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  volume: 0.7,
  seek: 0,
  duration: 0,

  playSong: (song, queue) => {
    // Only play songs that have a file_path (audio available)
    if (!song.file_path) return

    const newQueue = queue?.filter(s => s.file_path) ?? [song]
    const index = newQueue.findIndex(s => s.id === song.id)

    set({
      currentSong: song,
      queue: newQueue,
      queueIndex: index >= 0 ? index : 0,
      isPlaying: true,
      seek: 0,
      duration: song.duration ?? 0,
    })
  },

  togglePlay: () => {
    const { currentSong, isPlaying } = get()
    if (!currentSong) return
    set({ isPlaying: !isPlaying })
  },

  next: () => {
    const { queue, queueIndex } = get()
    if (queueIndex < queue.length - 1) {
      const nextSong = queue[queueIndex + 1]
      set({
        currentSong: nextSong,
        queueIndex: queueIndex + 1,
        isPlaying: true,
        seek: 0,
        duration: nextSong.duration ?? 0,
      })
    } else {
      // End of queue — stop playing
      set({ isPlaying: false })
    }
  },

  previous: () => {
    const { queue, queueIndex, seek } = get()
    // If more than 3 seconds in, restart current song
    if (seek > 3) {
      set({ seek: 0 })
      return
    }
    if (queueIndex > 0) {
      const prevSong = queue[queueIndex - 1]
      set({
        currentSong: prevSong,
        queueIndex: queueIndex - 1,
        isPlaying: true,
        seek: 0,
        duration: prevSong.duration ?? 0,
      })
    }
  },

  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
  setSeek: (s) => set({ seek: s }),
  setDuration: (d) => set({ duration: d }),
  updateSeek: (s) => set({ seek: s }),

  stop: () => set({
    currentSong: null,
    isPlaying: false,
    seek: 0,
    duration: 0,
    queue: [],
    queueIndex: 0,
  }),
}))
```

**Design notes:**
- `playSong` filters the queue to only songs with `file_path` — can't play songs that don't have audio files
- `previous()` restarts the current song if you're more than 3 seconds in (standard music player behavior), otherwise goes to previous track
- `queue` is set whenever the user clicks a song — it becomes whatever list the song came from (all songs, filter results, or playlist songs)
- Volume defaults to 0.7 (not 1.0 — less jarring on first play)

---

## How Stores Connect to Components

```
App.tsx (on mount)
  ├── songStore.fetchSongs()
  ├── playlistStore.fetchPlaylists()
  └── tagStore.fetchTags()

Sidebar
  ├── reads: playlistStore.playlists
  └── writes: view state (which view to show)

SongTable
  ├── reads: songStore.songs (or filterStore.results, or playlistStore.activePlaylist.songs)
  └── writes: playerStore.playSong(), songStore.deleteSong()

TagEditor
  ├── reads: tagStore.tags (for autocomplete)
  └── writes: songStore.assignTags(), songStore.removeTag()

QueryBuilder
  ├── reads: tagStore.tags, playlistStore.playlists, filterStore.query/results
  └── writes: filterStore.setQuery(), filterStore.executeFilter()

PlayerBar
  ├── reads: playerStore.* (everything)
  └── writes: playerStore.togglePlay(), next(), previous(), setVolume(), setSeek()

useAudioPlayer hook (in App.tsx)
  ├── reads: playerStore.currentSong, isPlaying, volume
  └── writes: playerStore.updateSeek(), setDuration(), next()
```
