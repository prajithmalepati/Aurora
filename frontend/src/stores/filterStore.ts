import { create } from "zustand"
import { api } from "@/lib/api"
import type { FilterResult, ApiResponse, Song } from "@/types"
import { usePlayerStore } from "./playerStore"
import { toast } from "sonner"

interface FilterState {
  query: string
  results: FilterResult[]
  loading: boolean
  error: string | null

  setQuery: (query: string) => void
  appendToQuery: (text: string) => void
  appendTerm: (term: string) => void
  executeFilter: () => Promise<void>
  shuffleFilter: () => Promise<void>
  jamFilter: () => Promise<void>
  shuffleAndJamFilter: () => Promise<void>
  clearResults: () => void
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function filterResultToSong(r: FilterResult): Song {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    album: r.album,
    duration: r.duration,
    file_path: r.file_path,
    source: r.source,
    tags: r.tags,
    playlists: r.playlists,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function friendlyFilterError(query: string, raw: string): string {
  // Bare terms with no operators — likely missing AND/OR
  if (!/\b(AND|OR|NOT)\b/i.test(query) && /\S+\s+\S+/.test(query)) {
    return 'Use AND, OR, NOT operators between terms. Example: rock AND roll'
  }
  // Common typo: using & or | instead of AND/OR
  if (/[&|]/.test(query) && !/\b(AND|OR)\b/i.test(query)) {
    return 'Use AND / OR instead of & / |. Example: rock AND roll'
  }
  // Unmatched parentheses
  if (/unbalanced|parenthes/i.test(raw)) {
    return 'Unmatched parentheses — check that every ( has a matching )'
  }
  // Empty / trailing operator
  if (/unexpected|expected/i.test(raw)) {
    return 'Incomplete expression — each AND, OR, NOT needs a term on both sides'
  }
  // Fall back to a cleaned-up version of the raw error
  return raw.replace(/^Invalid query syntax:\s*/i, 'Invalid syntax: ')
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

  appendTerm: (term) => {
    const current = get().query.trim()
    if (!current) {
      set({ query: term })
      return
    }
    const lastToken = current.split(/\s+/).pop()?.toUpperCase() ?? ""
    const isLastOperatorOrOpen = ["AND", "OR", "NOT", "("].includes(lastToken)
    if (isLastOperatorOrOpen) {
      set({ query: current + " " + term })
    } else {
      set({ query: current + " AND " + term })
    }
  },

  executeFilter: async () => {
    const query = get().query.trim()
    if (!query) return

    set({ loading: true, error: null })
    try {
      const res = await api.post<ApiResponse<FilterResult[]>>("/filter", { query })
      set({ results: res.data, loading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error"
      set({ error: friendlyFilterError(query, message), loading: false, results: [] })
    }
  },

  shuffleFilter: async () => {
    const query = get().query.trim()
    if (!query) return

    set({ loading: true, error: null })
    try {
      const res = await api.post<ApiResponse<FilterResult[]>>("/filter", { query })
      const shuffled = shuffleArray(res.data)
      set({ results: shuffled, loading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error"
      set({ error: friendlyFilterError(query, message), loading: false, results: [] })
    }
  },

  jamFilter: async () => {
    const query = get().query.trim()
    if (!query) return

    set({ loading: true, error: null })
    try {
      const res = await api.post<ApiResponse<FilterResult[]>>("/filter", { query })
      set({ results: res.data, loading: false })
      const playable = res.data.filter((r) => r.file_path)
      if (playable.length === 0) {
        toast.error("No playable songs in this mix")
        return
      }
      const queue = playable.map(filterResultToSong)
      usePlayerStore.getState().playSong(queue[0], queue)
      toast.success(`Jamming ${queue.length} ${queue.length === 1 ? "song" : "songs"}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error"
      set({ error: friendlyFilterError(query, message), loading: false, results: [] })
    }
  },

  shuffleAndJamFilter: async () => {
    const query = get().query.trim()
    if (!query) return

    set({ loading: true, error: null })
    try {
      const res = await api.post<ApiResponse<FilterResult[]>>("/filter", { query })
      const shuffled = shuffleArray(res.data)
      set({ results: shuffled, loading: false })
      const playable = shuffled.filter((r) => r.file_path)
      if (playable.length === 0) {
        toast.error("No playable songs in this mix")
        return
      }
      const queue = playable.map(filterResultToSong)
      usePlayerStore.getState().playSong(queue[0], queue)
      toast.success(`Shuffled ${queue.length} ${queue.length === 1 ? "song" : "songs"}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error"
      set({ error: friendlyFilterError(query, message), loading: false, results: [] })
    }
  },

  clearResults: () => set({ query: "", results: [], error: null }),
}))