import { create } from "zustand"
import { api } from "@/lib/api"
import type { Addon, AddonSearchTrack, AddonSearchResponse, ApiResponse } from "@/types"
import { toast } from "@/lib/toast"

// ── Online search result, keyed per addon ───────────────────────────────

export interface AddonSearchState {
  tracks: AddonSearchTrack[]
  loading: boolean
  error: string | null
  stale: boolean
}

interface AddonState {
  // Installed addons
  addons: Addon[]
  addonsLoading: boolean

  // Online search: results keyed by addon_id
  searchResults: Record<string, AddonSearchState>
  searchQuery: string

  // ── Actions ─────────────────────────────────────────────────────────

  // CRUD
  fetchAddons: () => Promise<void>
  addAddon: (baseUrl: string) => Promise<void>
  toggleAddon: (addonId: string, enabled: boolean) => Promise<void>
  removeAddon: (addonId: string) => Promise<void>

  // Online search
  searchAll: (query: string) => Promise<void>
  clearSearch: () => void

  // Save track to library
  saveTrack: (addonId: string, track: AddonSearchTrack) => Promise<void>
}

export const useAddonStore = create<AddonState>((set, get) => ({
  addons: [],
  addonsLoading: false,
  searchResults: {},
  searchQuery: "",

  // ── Fetch installed addons ──────────────────────────────────────────

  fetchAddons: async () => {
    set({ addonsLoading: true })
    try {
      const res = await api.get<ApiResponse<Addon[]>>("/addons")
      set({ addons: res.data, addonsLoading: false })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load addons"
      set({ addonsLoading: false })
      toast.error(msg)
    }
  },

  // ── Add addon by URL ────────────────────────────────────────────────

  addAddon: async (baseUrl: string) => {
    try {
      const res = await api.post<ApiResponse<Addon>>("/addons", { base_url: baseUrl })
      set((s) => ({ addons: [res.data, ...s.addons] }))
      toast.success(`Added: ${res.data.name ?? res.data.id}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add addon"
      toast.error(msg)
      throw e
    }
  },

  // ── Toggle addon enabled ────────────────────────────────────────────

  toggleAddon: async (addonId: string, enabled: boolean) => {
    try {
      await api.patch(`/addons/${addonId}`, { enabled })
      set((s) => ({
        addons: s.addons.map((a) =>
          a.id === addonId ? { ...a, enabled } : a
        ),
      }))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to toggle addon"
      toast.error(msg)
    }
  },

  // ── Remove addon ────────────────────────────────────────────────────

  removeAddon: async (addonId: string) => {
    try {
      await api.delete(`/addons/${addonId}`)
      set((s) => ({ addons: s.addons.filter((a) => a.id !== addonId) }))
      toast.success("Addon removed")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to remove addon"
      toast.error(msg)
    }
  },

  // ── Search all enabled addons ───────────────────────────────────────

  searchAll: async (query: string) => {
    const { addons } = get()
    const enabled = addons.filter((a) => a.enabled)
    if (enabled.length === 0 || query.trim().length < 2) {
      set({ searchResults: {}, searchQuery: "" })
      return
    }

    set({ searchQuery: query })

    // Initialize loading state for each addon
    const initial: Record<string, AddonSearchState> = {}
    for (const addon of enabled) {
      initial[addon.id] = { tracks: [], loading: true, error: null, stale: false }
    }
    set({ searchResults: initial })

    // Fan out searches in parallel
    await Promise.allSettled(
      enabled.map(async (addon) => {
        try {
          const res = await api.get<AddonSearchResponse>(
            `/addons/${addon.id}/search?q=${encodeURIComponent(query)}&limit=20`
          )
          // Check if query is still current (user may have typed more)
          if (get().searchQuery !== query) return
          set((s) => ({
            searchResults: {
              ...s.searchResults,
              [addon.id]: {
                tracks: res.data.tracks,
                loading: false,
                error: null,
                stale: false,
              },
            },
          }))
        } catch (e: unknown) {
          if (get().searchQuery !== query) return
          const msg = e instanceof Error ? e.message : "Search failed"
          const isStale = (e as { status?: number })?.status === 503
          set((s) => ({
            searchResults: {
              ...s.searchResults,
              [addon.id]: {
                tracks: [],
                loading: false,
                error: msg,
                stale: isStale,
              },
            },
          }))
        }
      })
    )
  },

  // ── Clear search ────────────────────────────────────────────────────

  clearSearch: () => {
    set({ searchResults: {}, searchQuery: "" })
  },

  // ── Save track to library ───────────────────────────────────────────

  saveTrack: async (addonId: string, track: AddonSearchTrack) => {
    try {
      await api.post(`/addons/${addonId}/save`, {
        title: track.title,
        artist: track.artist,
        album: track.album ?? null,
        duration: track.duration ?? null,
        external_id: track.id,
        artwork_url: track.artworkURL ?? null,
        stream_url: track.streamURL ?? null,
      })
      toast.success(`"${track.title}" added to library`)
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status
      if (status === 409) {
        toast.info(`"${track.title}" is already in your library`)
        return
      }
      const msg = e instanceof Error ? e.message : "Failed to save track"
      toast.error(msg)
    }
  },
}))
