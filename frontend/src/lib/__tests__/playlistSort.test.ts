/**
 * Playlist sort logic regression tests.
 *
 * Verifies that the playlist sort comparator correctly reorders songs
 * by file_format (Type) in ascending and descending order, with
 * deterministic null/empty handling. Also asserts that the sorted output
 * is the correct input for buildPlaylistQueue.
 *
 * Bug report: clicking the Type header in a playlist did nothing —
 * file_format was not part of the sort comparator.
 */
import { describe, it, expect } from "vitest"

import { sortPlaylistSongs } from "@/lib/playlistSort"
import type { PlaylistSong } from "@/types"

function makeSong(overrides: Partial<PlaylistSong> & { id: number; title: string }): PlaylistSong {
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

describe("sortPlaylistSongs", () => {
  it("sorts by file_format ascending when given deliberately unsorted input", () => {
    const unsorted: PlaylistSong[] = [
      makeSong({ id: 1, title: "Song A", file_format: "ogg" }),
      makeSong({ id: 2, title: "Song B", file_format: "flac" }),
      makeSong({ id: 3, title: "Song C", file_format: "mp3" }),
      makeSong({ id: 4, title: "Song D", file_format: "aac" }),
    ]

    const result = sortPlaylistSongs(unsorted, "file_format", "asc")
    expect(result.map((s) => s.file_format)).toEqual(["aac", "flac", "mp3", "ogg"])
    expect(result.map((s) => s.id)).toEqual([4, 2, 3, 1])
  })

  it("sorts by file_format descending when given deliberately unsorted input", () => {
    const unsorted: PlaylistSong[] = [
      makeSong({ id: 1, title: "Song A", file_format: "flac" }),
      makeSong({ id: 2, title: "Song B", file_format: "ogg" }),
      makeSong({ id: 3, title: "Song C", file_format: "aac" }),
      makeSong({ id: 4, title: "Song D", file_format: "mp3" }),
    ]

    const result = sortPlaylistSongs(unsorted, "file_format", "desc")
    expect(result.map((s) => s.file_format)).toEqual(["ogg", "mp3", "flac", "aac"])
    expect(result.map((s) => s.id)).toEqual([2, 4, 1, 3])
  })

  it("sorts null and empty file_format to the beginning in ascending order", () => {
    const unsorted: PlaylistSong[] = [
      makeSong({ id: 1, title: "Null", file_format: null }),
      makeSong({ id: 2, title: "Flac", file_format: "flac" }),
      makeSong({ id: 3, title: "Empty", file_format: "" }),
      makeSong({ id: 4, title: "Mp3", file_format: "mp3" }),
    ]

    const result = sortPlaylistSongs(unsorted, "file_format", "asc")
    // null/empty sort as "" which is less than any non-empty string,
    // so they sort to the BEGINNING in ascending order.
    // This is the deterministic rule: null → "", "" < "flac" < "mp3"
    const formats = result.map((s) => s.file_format)
    expect(formats[formats.length - 1]).toBe("mp3")
    expect(formats[formats.length - 2]).toBe("flac")
    // First two are null/empty (order between them is stable but both are "")
    expect(formats.slice(0, 2)).toEqual([null, ""])
  })

  it("null/empty file_format sorts to the end in descending order", () => {
    const unsorted: PlaylistSong[] = [
      makeSong({ id: 1, title: "Null", file_format: null }),
      makeSong({ id: 2, title: "Flac", file_format: "flac" }),
      makeSong({ id: 3, title: "Empty", file_format: "" }),
      makeSong({ id: 4, title: "Mp3", file_format: "mp3" }),
    ]

    const result = sortPlaylistSongs(unsorted, "file_format", "desc")
    // In descending: "mp3" > "flac" > "" = null, so null/empty go to the end
    const formats = result.map((s) => s.file_format)
    expect(formats[0]).toBe("mp3")
    expect(formats[1]).toBe("flac")
    expect(formats.slice(2)).toEqual([null, ""])
  })

  it("sorted output can be passed directly to buildPlaylistQueue preserving order", () => {
    const unsorted: PlaylistSong[] = [
      makeSong({ id: 1, title: "Song A", file_format: "ogg" }),
      makeSong({ id: 2, title: "Song B", file_format: "flac" }),
      makeSong({ id: 3, title: "Song C", file_format: "mp3" }),
    ]

    const sorted = sortPlaylistSongs(unsorted, "file_format", "asc")
    // Simulate what buildPlaylistQueue does: filter playable, map to Song
    const queue = sorted.filter((s) => !!s.file_path).map((s) => s.id)

    expect(queue).toEqual([2, 3, 1]) // flac, mp3, ogg
  })

  it("preserves existing title sort behavior", () => {
    const unsorted: PlaylistSong[] = [
      makeSong({ id: 3, title: "Charlie" }),
      makeSong({ id: 1, title: "Alpha" }),
      makeSong({ id: 2, title: "Bravo" }),
    ]

    const result = sortPlaylistSongs(unsorted, "title", "asc")
    expect(result.map((s) => s.title)).toEqual(["Alpha", "Bravo", "Charlie"])
  })

  it("preserves existing artist sort behavior", () => {
    const unsorted: PlaylistSong[] = [
      makeSong({ id: 1, title: "A", artist: "Zebra" }),
      makeSong({ id: 2, title: "B", artist: "Apple" }),
      makeSong({ id: 3, title: "C", artist: "Mango" }),
    ]

    const result = sortPlaylistSongs(unsorted, "artist", "asc")
    expect(result.map((s) => s.artist)).toEqual(["Apple", "Mango", "Zebra"])
  })

  it("preserves existing duration sort behavior", () => {
    const unsorted: PlaylistSong[] = [
      makeSong({ id: 1, title: "Long", duration: 300 }),
      makeSong({ id: 2, title: "Short", duration: 120 }),
      makeSong({ id: 3, title: "Medium", duration: 200 }),
    ]

    const result = sortPlaylistSongs(unsorted, "duration", "asc")
    expect(result.map((s) => s.duration)).toEqual([120, 200, 300])
  })

  it("returns songs unmodified when sortField is position", () => {
    const songs: PlaylistSong[] = [
      makeSong({ id: 3, title: "Charlie" }),
      makeSong({ id: 1, title: "Alpha" }),
      makeSong({ id: 2, title: "Bravo" }),
    ]

    const result = sortPlaylistSongs(songs, "position", "asc")
    expect(result.map((s) => s.id)).toEqual([3, 1, 2])
  })
})
