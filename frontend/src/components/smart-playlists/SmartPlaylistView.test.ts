import { describe, it, expect, vi } from "vitest"

// playerStore reads localStorage at module level — mock the entire module
vi.mock("@/stores/playerStore", () => ({
  usePlayerStore: { getState: () => ({ playSong: vi.fn() }) },
}))
vi.mock("@/stores/smartPlaylistStore", () => ({
  useSmartPlaylistStore: { getState: () => ({}) },
}))
vi.mock("@/stores/filterStore", () => ({
  useFilterStore: Object.assign(vi.fn(() => ({})), { getState: () => ({}) }),
}))
vi.mock("@/stores/songStore", () => ({
  useSongStore: { getState: () => ({ setView: vi.fn() }) },
}))
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  BASE_URL: "http://localhost:8000/api",
  getAuroraToken: () => undefined,
  getBaseUrl: () => "http://localhost:8000",
}))
vi.mock("@/lib/smartPlaylistQueue", () => ({
  buildSmartPlaylistQueue: vi.fn(() => []),
}))
vi.mock("@/components/songs/SongTable", () => ({
  SongTable: () => null,
}))
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => null,
}))
vi.mock("lucide-react", () => ({
  Sparkles: () => null,
  Play: () => null,
  Shuffle: () => null,
  AlertCircle: () => null,
  Pencil: () => null,
}))

import {
  reconcileActiveSmartPlaylist,
} from "@/components/smart-playlists/SmartPlaylistView"
import type { SmartPlaylistDefinition } from "@/types"

function makeDef(
  id: number,
  name: string,
  overrides?: Partial<Pick<SmartPlaylistDefinition, "color" | "emoji" | "query">>,
): SmartPlaylistDefinition {
  return {
    id,
    name,
    color: overrides?.color ?? null,
    emoji: overrides?.emoji ?? null,
    image_url: null,
    query: overrides?.query ?? `tag:"${name}"`,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }
}

describe("reconcileActiveSmartPlaylist", () => {
  // ── First-fetch safety ─────────────────────────────────────────

  it("does not route away when listReady is idle (before first fetch)", () => {
    const result = reconcileActiveSmartPlaylist(
      99,
      makeDef(99, "Ghost"),
      [],          // empty list
      "idle",      // never fetched
    )
    expect(result).toEqual({ kind: "none" })
  })

  it("does not route away when listReady is error (fetch failed)", () => {
    const result = reconcileActiveSmartPlaylist(
      99,
      makeDef(99, "Ghost"),
      [],          // empty after failed fetch
      "error",
    )
    expect(result).toEqual({ kind: "none" })
  })

  // ── Navigate away ─────────────────────────────────────────────

  it("routes away when active ID is absent from a successfully fetched list", () => {
    const result = reconcileActiveSmartPlaylist(
      99,
      makeDef(99, "Deleted"),
      [makeDef(1, "A"), makeDef(2, "B")],
      "ready",
    )
    expect(result).toEqual({ kind: "navigate-away" })
  })

  // ── Update definition ─────────────────────────────────────────

  it("returns update-definition when name changed", () => {
    const local = makeDef(1, "Old Name")
    const store = makeDef(1, "New Name")
    const result = reconcileActiveSmartPlaylist(1, local, [store], "ready")
    expect(result).toEqual({ kind: "update-definition", definition: store })
  })

  it("returns update-definition when query changed", () => {
    const local = makeDef(1, "Mix", { query: 'tag:"rock"' })
    const store = makeDef(1, "Mix", { query: 'tag:"rock" AND tag:"live"' })
    const result = reconcileActiveSmartPlaylist(1, local, [store], "ready")
    expect(result).toEqual({ kind: "update-definition", definition: store })
  })

  it("returns update-definition when color changed", () => {
    const local = makeDef(1, "Mix", { color: "#aaa" })
    const store = makeDef(1, "Mix", { color: "#5eead4" })
    const result = reconcileActiveSmartPlaylist(1, local, [store], "ready")
    expect(result).toEqual({ kind: "update-definition", definition: store })
  })

  it("returns update-definition when emoji changed", () => {
    const local = makeDef(1, "Mix", { emoji: "🎵" })
    const store = makeDef(1, "Mix", { emoji: "🎸" })
    const result = reconcileActiveSmartPlaylist(1, local, [store], "ready")
    expect(result).toEqual({ kind: "update-definition", definition: store })
  })

  // ── No-op ─────────────────────────────────────────────────────

  it("returns none when definition is unchanged", () => {
    const def = makeDef(1, "Same", { color: "#aaa", emoji: "🎵", query: 'tag:"x"' })
    const result = reconcileActiveSmartPlaylist(1, def, [def], "ready")
    expect(result).toEqual({ kind: "none" })
  })

  it("returns none when active definition is null (initial load in progress)", () => {
    const storeDef = makeDef(1, "Loaded")
    const result = reconcileActiveSmartPlaylist(1, null, [storeDef], "ready")
    expect(result).toEqual({ kind: "none" })
  })

  it("ignores timestamp-only differences", () => {
    const local = makeDef(1, "Mix")
    const store = { ...local, updated_at: "2099-12-31T23:59:59Z" }
    const result = reconcileActiveSmartPlaylist(1, local, [store], "ready")
    expect(result).toEqual({ kind: "none" })
  })
})
