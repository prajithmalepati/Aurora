/**
 * Tests for buildSmartPlaylistQueue — the helper that builds a playable-only
 * queue from resolved smart-playlist songs, preserving original Song objects
 * and their order.
 */
import { describe, it, expect, vi } from "vitest"

vi.mock("@/stores/playerStore", () => ({
  isPlayable: (song: { file_path?: string | null; source?: string }) =>
    !!song.file_path || !!song.source?.startsWith("addon:"),
}))

import { buildSmartPlaylistQueue } from "@/lib/smartPlaylistQueue"
import type { Song } from "@/types"

function makeSong(overrides: Partial<Song> & { id: number; title: string }): Song {
  return {
    artist: "Test Artist",
    album: null,
    duration: 180,
    file_path: `/music/${overrides.title.toLowerCase().replace(/\s+/g, "_")}.mp3`,
    file_format: "mp3",
    source: "local",
    tags: [],
    playlists: [],
    created_at: "",
    updated_at: "",
    ...overrides,
  }
}

describe("buildSmartPlaylistQueue", () => {
  it("excludes unplayable songs (no file_path and no addon source)", () => {
    const songs: Song[] = [
      makeSong({ id: 1, title: "Playable" }),
      makeSong({ id: 2, title: "Unplayable", file_path: null, source: "local" }),
      makeSong({ id: 3, title: "Also Playable" }),
    ]
    const queue = buildSmartPlaylistQueue(songs)
    expect(queue.length).toBe(2)
    expect(queue.map((s) => s.id)).toEqual([1, 3])
  })

  it("keeps local playable songs", () => {
    const songs: Song[] = [
      makeSong({ id: 1, title: "Local Song", source: "local", file_path: "/music/local.mp3" }),
    ]
    const queue = buildSmartPlaylistQueue(songs)
    expect(queue.length).toBe(1)
    expect(queue[0].source).toBe("local")
    expect(queue[0].file_path).toBe("/music/local.mp3")
  })

  it("keeps addon: playable songs", () => {
    const songs: Song[] = [
      makeSong({ id: 5, title: "Addon Song", source: "addon:spotify", file_path: null }),
    ]
    const queue = buildSmartPlaylistQueue(songs)
    expect(queue.length).toBe(1)
    expect(queue[0].id).toBe(5)
    expect(queue[0].source).toBe("addon:spotify")
  })

  it("preserves original order", () => {
    const songs: Song[] = [
      makeSong({ id: 3, title: "Charlie" }),
      makeSong({ id: 1, title: "Alpha" }),
      makeSong({ id: 2, title: "Beta" }),
    ]
    const queue = buildSmartPlaylistQueue(songs)
    expect(queue.map((s) => s.id)).toEqual([3, 1, 2])
  })

  it("preserves original Song objects (no mapping/normalization)", () => {
    const original: Song = makeSong({
      id: 10,
      title: "Full Song",
      source: "addon:soundcloud",
      file_path: null,
      tags: ["rock", "90s"],
      album: "Best Of",
      artists: ["Artist A", "Artist B"],
    })
    const queue = buildSmartPlaylistQueue([original])
    expect(queue.length).toBe(1)
    // Same reference — no clone or mapping
    expect(queue[0]).toBe(original)
    expect(queue[0].source).toBe("addon:soundcloud")
    expect(queue[0].tags).toEqual(["rock", "90s"])
    expect(queue[0].album).toBe("Best Of")
  })

  it("preserves source values mixed local + addon", () => {
    const songs: Song[] = [
      makeSong({ id: 1, title: "Local A", source: "local", file_path: "/a.mp3" }),
      makeSong({ id: 2, title: "Addon B", source: "addon:spotify", file_path: null }),
      makeSong({ id: 3, title: "Local C", source: "local", file_path: "/c.mp3" }),
    ]
    const queue = buildSmartPlaylistQueue(songs)
    expect(queue.map((s) => s.source)).toEqual(["local", "addon:spotify", "local"])
  })

  it("returns empty array when all songs are unplayable", () => {
    const songs: Song[] = [
      makeSong({ id: 1, title: "No File", file_path: null, source: "local" }),
    ]
    const queue = buildSmartPlaylistQueue(songs)
    expect(queue).toEqual([])
  })

  it("returns empty array for empty input", () => {
    expect(buildSmartPlaylistQueue([])).toEqual([])
  })
})
