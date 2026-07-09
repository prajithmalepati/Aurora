import type { PlaylistSong, Song } from "@/types"
import { isPlayable } from "@/stores/playerStore"

/**
 * Build the playback queue from the currently displayed playlist songs.
 *
 * The queue must match the visual order (sortedSongs) — not the raw
 * playlist order. This ensures that when a user sorts a playlist by
 * title, artist, album, type, or duration and then clicks Play/Next,
 * the playback follows the displayed sort order.
 *
 * @param displayedSongs  The sorted (and optionally filtered) song list
 *                        currently rendered in the table.
 * @returns               Playable songs mapped to full Song objects,
 *                        preserving the display order.
 */
export function buildPlaylistQueue(displayedSongs: PlaylistSong[]): Song[] {
  return displayedSongs.filter(isPlayable).map((s) => ({
    ...s,
    source: "local" as const,
    playlists: [] as Song["playlists"],
    created_at: "",
    updated_at: "",
  }))
}
