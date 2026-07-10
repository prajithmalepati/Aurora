import type { PlaylistSong } from "@/types"

export type PlaylistSortField = "position" | "title" | "artist" | "album" | "duration" | "file_format"
export type SortOrder = "asc" | "desc"

/**
 * Sort playlist songs by the given field and order.
 *
 * For "position" the input array is returned as-is (no copy) — this
 * preserves the server-provided manual ordering and avoids an
 * unnecessary clone.
 *
 * Null/empty string values sort as "" which is less than any
 * non-empty string, so they naturally sort to the beginning in
 * ascending order and the end in descending order.
 */
export function sortPlaylistSongs(
  songs: PlaylistSong[],
  sortField: PlaylistSortField,
  sortOrder: SortOrder,
): PlaylistSong[] {
  if (sortField === "position") return songs
  return [...songs].sort((a, b) => {
    let va: string | number = ""
    let vb: string | number = ""
    if (sortField === "title")        { va = a.title.toLowerCase();                vb = b.title.toLowerCase() }
    if (sortField === "artist")       { va = (a.artist ?? "").toLowerCase();       vb = (b.artist ?? "").toLowerCase() }
    if (sortField === "album")        { va = (a.album ?? "").toLowerCase();        vb = (b.album ?? "").toLowerCase() }
    if (sortField === "duration")     { va = a.duration ?? 0;                      vb = b.duration ?? 0 }
    if (sortField === "file_format")  { va = (a.file_format ?? "").toLowerCase();  vb = (b.file_format ?? "").toLowerCase() }
    if (va < vb) return sortOrder === "asc" ? -1 : 1
    if (va > vb) return sortOrder === "asc" ? 1 : -1
    return 0
  })
}
