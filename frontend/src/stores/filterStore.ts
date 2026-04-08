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