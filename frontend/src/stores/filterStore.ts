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
  appendTerm: (term: string) => void
  executeFilter: () => Promise<void>
  shuffleFilter: () => Promise<void>
  clearResults: () => void
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
      const shuffled = [...res.data]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      set({ results: shuffled, loading: false })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error"
      set({ error: friendlyFilterError(query, message), loading: false, results: [] })
    }
  },

  clearResults: () => set({ query: "", results: [], error: null }),
}))