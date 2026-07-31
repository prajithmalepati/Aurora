import type { Song } from "@/types"
import { isPlayable } from "@/stores/playerStore"

/**
 * Build a playable-only queue from resolved smart-playlist songs.
 *
 * Filters to playable songs (local files + addon streams) and returns
 * the original full Song objects in their current order. No mapping,
 * cloning, or normalization — the returned array contains references
 * to the same Song objects that were passed in.
 */
export function buildSmartPlaylistQueue(songs: Song[]): Song[] {
  return songs.filter(isPlayable)
}
