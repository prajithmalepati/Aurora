/**
 * Playlist sorted queue regression tests.
 *
 * Verifies that the playback queue matches the displayed sort order —
 * not the raw playlist order — when a user sorts a playlist by any column
 * (title, artist, album, type/file_format, duration).
 *
 * Bug report: after sorting a playlist by Type, clicking the first visible
 * song starts it, but Next follows the playlist's default/manual order.
 */
import { describe, it, expect, vi } from "vitest"

// Mock isPlayable — all test songs are playable
vi.mock("@/stores/playerStore", () => ({
  isPlayable: (song: { file_path?: string | null }) => !!song.file_path,
}))

import { buildPlaylistQueue } from "@/lib/playlistQueue"
import type { PlaylistSong } from "@/types"

function makePlaylistSong(overrides: Partial<PlaylistSong> & { id: number; title: string }): PlaylistSong {
  return {
    artist: "Test Artist",
    album: null,
    duration: 180,
    file_path: `/music/${overrides.title.toLowerCase().replace(/\s+/g, "_")}.mp3`,
    file_format: "mp3",
    source: "local",
    tags: [],
    position: overrides.id,
    ...overrides,
  }
}

describe("buildPlaylistQueue", () => {
  it("returns songs in display order (sorted by title ascending)", () => {
    const sortedSongs: PlaylistSong[] = [
      makePlaylistSong({ id: 3, title: "Alpha" }),
      makePlaylistSong({ id: 1, title: "Beta" }),
      makePlaylistSong({ id: 2, title: "Charlie" }),
    ]
    const queue = buildPlaylistQueue(sortedSongs)
    expect(queue.map((s) => s.id)).toEqual([3, 1, 2])
    expect(queue.map((s) => s.title)).toEqual(["Alpha", "Beta", "Charlie"])
  })

  it("returns songs in Type-sorted order (file_format ascending)", () => {
    const sortedSongs: PlaylistSong[] = [
      makePlaylistSong({ id: 5, title: "Song A", file_format: "flac" }),
      makePlaylistSong({ id: 3, title: "Song B", file_format: "mp3" }),
      makePlaylistSong({ id: 7, title: "Song C", file_format: "ogg" }),
    ]
    const queue = buildPlaylistQueue(sortedSongs)
    expect(queue.map((s) => s.id)).toEqual([5, 3, 7])
    expect(queue.map((s) => s.file_format)).toEqual(["flac", "mp3", "ogg"])
  })

  it("returns songs in Type-sorted order (file_format descending)", () => {
    const sortedSongs: PlaylistSong[] = [
      makePlaylistSong({ id: 7, title: "Song C", file_format: "ogg" }),
      makePlaylistSong({ id: 3, title: "Song B", file_format: "mp3" }),
      makePlaylistSong({ id: 5, title: "Song A", file_format: "flac" }),
    ]
    const queue = buildPlaylistQueue(sortedSongs)
    expect(queue.map((s) => s.id)).toEqual([7, 3, 5])
  })

  it("handles null/empty file_format deterministically (sorted to one end)", () => {
    const sortedSongs: PlaylistSong[] = [
      makePlaylistSong({ id: 1, title: "Unknown", file_format: null }),
      makePlaylistSong({ id: 2, title: "Empty", file_format: "" }),
      makePlaylistSong({ id: 3, title: "Flac", file_format: "flac" }),
      makePlaylistSong({ id: 4, title: "Mp3", file_format: "mp3" }),
    ]
    const queue = buildPlaylistQueue(sortedSongs)
    // Order preserved as-is from the sortedSongs array
    expect(queue.map((s) => s.id)).toEqual([1, 2, 3, 4])
  })

  it("filters out non-playable songs (no file_path)", () => {
    const sortedSongs: PlaylistSong[] = [
      makePlaylistSong({ id: 1, title: "Playable" }),
      makePlaylistSong({ id: 2, title: "Unplayable", file_path: null }),
      makePlaylistSong({ id: 3, title: "Also Playable" }),
    ]
    const queue = buildPlaylistQueue(sortedSongs)
    expect(queue.length).toBe(2)
    expect(queue.map((s) => s.id)).toEqual([1, 3])
  })

  it("filtered playlist results use filtered+sorted order as queue", () => {
    // Simulates: playlist has 5 songs, user searches "rock", 3 match,
    // sorted by title descending
    const filteredSorted: PlaylistSong[] = [
      makePlaylistSong({ id: 4, title: "Rock the Night", artist: "Europe" }),
      makePlaylistSong({ id: 2, title: "Rock You", artist: "Queen" }),
      makePlaylistSong({ id: 1, title: "Classic Rock", artist: "Various" }),
    ]
    const queue = buildPlaylistQueue(filteredSorted)
    expect(queue.map((s) => s.id)).toEqual([4, 2, 1])
    // Queue should NOT include songs that were filtered out
    expect(queue.length).toBe(3)
  })

  it("playing first displayed song then Next follows sorted order, not manual order", () => {
    // The core regression: manual order is [1,2,3] but display sorted by title
    const sortedSongs: PlaylistSong[] = [
      makePlaylistSong({ id: 3, title: "Alpha Song" }),
      makePlaylistSong({ id: 1, title: "Beta Song" }),
      makePlaylistSong({ id: 2, title: "Charlie Song" }),
    ]
    const queue = buildPlaylistQueue(sortedSongs)

    // User clicks first displayed song (id=3 "Alpha Song")
    const clickedSong = queue[0]
    expect(clickedSong.id).toBe(3)
    expect(clickedSong.title).toBe("Alpha Song")

    // Next should be id=1 "Beta Song" (second in sorted display)
    const nextIndex = queue.findIndex((s) => s.id === clickedSong.id) + 1
    expect(queue[nextIndex].id).toBe(1)
    expect(queue[nextIndex].title).toBe("Beta Song")

    // Next after that should be id=2 "Charlie Song"
    const nextNextIndex = nextIndex + 1
    expect(queue[nextNextIndex].id).toBe(2)
  })

  it("queue length matches displayed count (no missing or extra songs)", () => {
    const sortedSongs: PlaylistSong[] = Array.from({ length: 50 }, (_, i) =>
      makePlaylistSong({ id: i + 1, title: `Song ${String(i + 1).padStart(3, "0")}` })
    )
    const queue = buildPlaylistQueue(sortedSongs)
    expect(queue.length).toBe(50)
    // First and last match
    expect(queue[0].id).toBe(1)
    expect(queue[49].id).toBe(50)
  })
})
