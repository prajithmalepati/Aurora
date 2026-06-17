import { create } from "zustand"
import type { ColumnId } from "@/components/songs/columns"
import { ALL_COLUMN_IDS, getColumn } from "@/components/songs/columns"

// ── Page contexts where columns are independently configured ──
export type ColumnContext = "all-songs" | "playlist" | "album" | "folder" | "tags"

interface ColumnConfig {
  order: ColumnId[]
  hidden: ColumnId[]
  widths: Partial<Record<ColumnId, number>>
}

interface ColumnState {
  // Per-context configs (in-memory, loaded from localStorage)
  configs: Record<ColumnContext, ColumnConfig>
  // Getters
  getConfig: (ctx: ColumnContext) => ColumnConfig
  // Mutations
  setOrder: (ctx: ColumnContext, order: ColumnId[]) => void
  toggleVisible: (ctx: ColumnContext, id: ColumnId) => void
  setWidth: (ctx: ColumnContext, id: ColumnId, width: number) => void
  reset: (ctx: ColumnContext) => void
}

// ── Per-context defaults ──
const CONTEXT_DEFAULTS: Record<ColumnContext, { order: ColumnId[]; hidden: ColumnId[] }> = {
  "all-songs": {
    order: ["index", "title", "type", "duration", "artist", "album", "tags"],
    hidden: [],
  },
  playlist: {
    // R13: trimmed — no Artist/Album/Type by default
    order: ["index", "title", "duration", "tags"],
    hidden: ["type", "artist", "album"],
  },
  album: {
    // Album redundant inside an album
    order: ["index", "title", "duration", "tags"],
    hidden: ["type", "artist", "album"],
  },
  folder: {
    order: ["index", "title", "type", "duration", "artist", "album", "tags"],
    hidden: [],
  },
  tags: {
    order: ["index", "title", "type", "duration", "artist", "album", "tags"],
    hidden: [],
  },
}

const STORAGE_PREFIX = "aurora-cols-"

// ── Migration: validate stored config against current registry ──
function migrateConfig(stored: ColumnConfig, ctx: ColumnContext): ColumnConfig {
  const defaults = CONTEXT_DEFAULTS[ctx]
  const validIds = new Set(ALL_COLUMN_IDS)

  // Drop unknown column ids from order
  const validOrder = stored.order.filter((id) => validIds.has(id))
  // Append any new registry columns not present
  for (const id of ALL_COLUMN_IDS) {
    if (!validOrder.includes(id)) {
      validOrder.push(id)
    }
  }

  // Filter hidden to only valid ids
  const validHidden = stored.hidden.filter((id) => validIds.has(id))

  // Validate widths against minWidth
  const validWidths: Partial<Record<ColumnId, number>> = {}
  for (const [id, width] of Object.entries(stored.widths)) {
    if (validIds.has(id as ColumnId)) {
      try {
        const col = getColumn(id as ColumnId)
        validWidths[id as ColumnId] = Math.max(width, col.minWidth ?? 0)
      } catch {
        // Unknown column, skip
      }
    }
  }

  return {
    order: validOrder.length > 0 ? validOrder : defaults.order,
    hidden: validHidden,
    widths: validWidths,
  }
}

// ── Load config from localStorage ──
function loadConfig(ctx: ColumnContext): ColumnConfig {
  const defaults = CONTEXT_DEFAULTS[ctx]
  const defaultConfig: ColumnConfig = {
    order: defaults.order,
    hidden: defaults.hidden,
    widths: {},
  }

  try {
    const key = STORAGE_PREFIX + ctx
    const raw = localStorage.getItem(key)
    if (!raw) return defaultConfig
    const parsed = JSON.parse(raw) as ColumnConfig
    return migrateConfig(parsed, ctx)
  } catch {
    return defaultConfig
  }
}

// ── Save config to localStorage ──
function saveConfig(ctx: ColumnContext, config: ColumnConfig) {
  try {
    localStorage.setItem(STORAGE_PREFIX + ctx, JSON.stringify(config))
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

// ── Initialize all contexts ──
function loadAllConfigs(): Record<ColumnContext, ColumnConfig> {
  return {
    "all-songs": loadConfig("all-songs"),
    playlist: loadConfig("playlist"),
    album: loadConfig("album"),
    folder: loadConfig("folder"),
    tags: loadConfig("tags"),
  }
}

export const useColumnStore = create<ColumnState>((set, get) => ({
  configs: loadAllConfigs(),

  getConfig: (ctx) => get().configs[ctx],

  setOrder: (ctx, order) => {
    set((state) => {
      const config = { ...state.configs[ctx], order }
      saveConfig(ctx, config)
      return { configs: { ...state.configs, [ctx]: config } }
    })
  },

  toggleVisible: (ctx, id) => {
    set((state) => {
      const current = state.configs[ctx]
      const hidden = current.hidden.includes(id)
        ? current.hidden.filter((h) => h !== id)
        : [...current.hidden, id]
      const config = { ...current, hidden }
      saveConfig(ctx, config)
      return { configs: { ...state.configs, [ctx]: config } }
    })
  },

  setWidth: (ctx, id, width) => {
    set((state) => {
      const current = state.configs[ctx]
      const widths = { ...current.widths, [id]: width }
      const config = { ...current, widths }
      saveConfig(ctx, config)
      return { configs: { ...state.configs, [ctx]: config } }
    })
  },

  reset: (ctx) => {
    const defaults = CONTEXT_DEFAULTS[ctx]
    const config: ColumnConfig = {
      order: defaults.order,
      hidden: defaults.hidden,
      widths: {},
    }
    saveConfig(ctx, config)
    set((state) => ({
      configs: { ...state.configs, [ctx]: config },
    }))
  },
}))
